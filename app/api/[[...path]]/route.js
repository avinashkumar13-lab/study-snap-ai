import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import { jsonrepair } from 'jsonrepair'
import { YoutubeTranscript } from 'youtube-transcript'

export const runtime = 'nodejs'
export const maxDuration = 300

// ---------- MongoDB ----------
let client, db
async function connectToMongo() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME || 'studysnap_ai')
  }
  return db
}

function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}
export async function OPTIONS() { return handleCORS(new NextResponse(null, { status: 200 })) }

// ---------- LLM ----------
const EMERGENT_LLM_URL = process.env.EMERGENT_LLM_URL || 'https://integrations.emergentagent.com/llm/v1/chat/completions'
const EMERGENT_LLM_KEY = process.env.EMERGENT_LLM_KEY
// Use Haiku 4.5 for speed. Fallback quality still very high for structured educational content.
const FAST_MODEL = process.env.LLM_MODEL || 'claude-haiku-4-5'

const MATH_STYLE = `MATH & FORMULA FORMATTING (CRITICAL):
- Use CLEAN plain-text math with Unicode symbols. DO NOT use LaTeX delimiters like $...$ or \\[ \\]. DO NOT use the caret ^ for powers.
- Powers/exponents: use Unicode superscripts (a², a³, aⁿ, xⁱ⁺¹). If a superscript is not available, write as "a to the power n" or use a·a·a.
- Subscripts: use Unicode (x₁, x₂, aₙ) when possible.
- Roots: use √ (√2, ³√x). Fractions: a/b or (a+b)/(c-d).
- Greek letters as-is: π, θ, α, β, λ, Δ.
- Operators: · × ÷ ± ≤ ≥ ≠ ≈ ∞ ∫ ∑ ∏ → ⇒.
- NEVER include backslash LaTeX commands. Never include stray $ or ^ characters.
- Formulas in the "formula" field MUST be plain readable expressions, e.g. "E = mc²", "F = ma", "sin²θ + cos²θ = 1", "(a+b)² = a² + 2ab + b²".`

function buildSystemPrompt() {
  return `You are Study Snap AI, an elite academic tutor and exam-notes generator for students. You produce highly structured, exam-ready study notes that mirror what a top teacher would write on the blackboard.

STRICT RULES:
- Output ONLY valid JSON. No prose, no markdown code fences, no commentary.
- Be factually accurate for the given academic level. Do not hallucinate.
- Use clean concise markdown inside string fields (##, -, **bold**), but NEVER wrap the whole response in markdown fences.
- Adapt vocabulary and depth to the student's academic level.
- Focus on exam-relevance.
${MATH_STYLE}`
}

function contextBlock({ degree, program, course, subject, topic, teacher, length, mode }) {
  const modeLine = mode === 'exam_tomorrow'
    ? 'MODE: ONE-DAY-BEFORE-EXAM — aggressive prioritization, minimum-viable-knowledge.'
    : 'MODE: Standard.'
  const lengthLine = length === 'short' ? 'Length: concise' : length === 'detailed' ? 'Length: detailed' : 'Length: medium'
  const teacherLine = teacher ? `Preferred teacher style: ${teacher}` : ''
  return `Degree/Level: ${degree}
Program: ${program || 'N/A'}
Course: ${course || 'N/A'}
Subject: ${subject}
Topic: ${topic}
${teacherLine}
${modeLine}
${lengthLine}`
}

// ---- Prompt A: foundational content ----
function promptFoundations(ctx) {
  return `Generate the FOUNDATIONAL notes as strict JSON with these keys ONLY:
{
  "title": "catchy title",
  "overview": "one paragraph overview (2-4 sentences)",
  "short_notes": "compact bullet notes covering the whole topic (markdown)",
  "detailed_notes": "detailed textbook-quality explanation with headings and examples. Around 300-450 words. Use ## and bullet lists.",
  "key_concepts": [ { "concept": "name", "explanation": "1-3 line explanation" } ],
  "important_definitions": [ { "term": "term", "definition": "precise definition" } ],
  "formula_sheet": [ { "name": "formula name", "formula": "clean plain-text formula using Unicode (e.g. E = mc²)", "when_to_use": "one line usage" } ]
}
Minimum: key_concepts >=5, important_definitions >=4, formula_sheet >=3 (or [] if not applicable).

CONTEXT:
${contextBlock(ctx)}

Return ONLY the JSON object, no fences.`
}

// ---- Prompt B: assessment + revision + diagrams ----
function promptAssessment(ctx) {
  return `Generate the REVISION + ASSESSMENT payload as strict JSON. You MUST include EVERY key listed below. Do NOT omit any key.

{
  "quick_revision": "5-minute revision notes as a bullet list (markdown)",
  "exam_summary": "one-page exam-oriented summary highlighting high-yield points (markdown, 120-200 words)",
  "faqs": [ { "question": "q", "answer": "a (markdown)" } ],
  "mcqs": [ { "question": "MCQ", "options": ["A. ...","B. ...","C. ...","D. ..."], "answer": "A", "explanation": "why" } ],
  "mnemonics": [ { "for": "what it helps remember", "trick": "memory trick" } ],
  "likely_exam_questions": [ "question 1", "question 2" ],
  "diagrams": [ { "title": "diagram title", "mermaid": "valid mermaid code" } ]
}

Counts (STRICT): faqs=4, mcqs=5, mnemonics=3, likely_exam_questions=5, diagrams=1.
Keep exam_summary and quick_revision concise. Prefer brevity over verbosity.

DIAGRAM RULES:
- Use mermaid v10 syntax.
- Prefer mindmap for concept maps. Example:
mindmap
  root((Topic))
    Idea1
      Sub1
      Sub2
    Idea2
- Or flowchart TD for processes. Example:
flowchart TD
  A[Start] --> B[Step 1]
  B --> C[End]
- Labels alphanumeric + spaces only. No quotes/special chars inside labels. No parentheses inside node labels (except mindmap root).

CONTEXT:
${contextBlock(ctx)}

Return ONLY the JSON object. Include ALL 7 keys above.`
}

function extractJson(text) {
  if (!text) return null
  let s = text.trim()
  if (s.startsWith('```')) {
    s = s.replace(/^```[a-z]*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
  }
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1) return null
  if (end !== -1) {
    const jsonStr = s.slice(start, end + 1)
    try { return JSON.parse(jsonStr) } catch (_) { /* fall through */ }
    try { return JSON.parse(jsonrepair(jsonStr)) } catch (_) { /* fall through */ }
  }
  try {
    return JSON.parse(jsonrepair(s.slice(start)))
  } catch (e) {
    console.error('JSON parse error after repair:', e.message)
    return null
  }
}

async function callLLM(messages, { maxTokens = 3000, temperature = 0.3, model = FAST_MODEL } = {}) {
  const res = await fetch(EMERGENT_LLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${EMERGENT_LLM_KEY}` },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`LLM error ${res.status}: ${t.slice(0, 300)}`)
  }
  const data = await res.json()
  return data?.choices?.[0]?.message?.content || ''
}

// Post-process: strip any stray $ ... $ delimiters and ^ powers even if LLM slipped up
function sanitizeMath(s) {
  if (typeof s !== 'string') return s
  // Remove $...$ inline latex delimiters, keeping the inner content
  s = s.replace(/\$([^$\n]+)\$/g, '$1')
  s = s.replace(/\\\((.+?)\\\)/g, '$1')
  s = s.replace(/\\\[(.+?)\\\]/g, '$1')
  // Convert simple caret powers like x^2, a^{n+1} to unicode superscripts when possible
  const SUP = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','+':'⁺','-':'⁻','n':'ⁿ','i':'ⁱ' }
  s = s.replace(/\^\{([^}]+)\}/g, (_, g) => g.split('').map(c => SUP[c] || `^${c}`).join(''))
  s = s.replace(/\^([A-Za-z0-9+\-]+)/g, (_, g) => g.split('').map(c => SUP[c] || `^${c}`).join(''))
  // Remove residual backslash latex commands
  s = s.replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
  return s
}

function deepSanitize(obj) {
  if (obj == null) return obj
  if (typeof obj === 'string') return sanitizeMath(obj)
  if (Array.isArray(obj)) return obj.map(deepSanitize)
  if (typeof obj === 'object') {
    const out = {}
    for (const k of Object.keys(obj)) out[k] = deepSanitize(obj[k])
    return out
  }
  return obj
}

// ---------- Note generation orchestrator ----------
async function processNoteJob(noteId, input) {
  try {
    const db = await connectToMongo()
    const sys = { role: 'system', content: buildSystemPrompt() }

    const [rawA, rawB] = await Promise.all([
      callLLM([sys, { role: 'user', content: promptFoundations(input) }], { maxTokens: 3500 }),
      callLLM([sys, { role: 'user', content: promptAssessment(input) }], { maxTokens: 3500 }),
    ])

    const a = extractJson(rawA) || {}
    const b = extractJson(rawB) || {}
    // Provide safe defaults so UI never breaks
    const merged = {
      title: '', overview: '', short_notes: '', detailed_notes: '',
      key_concepts: [], important_definitions: [], formula_sheet: [],
      quick_revision: '', exam_summary: '',
      faqs: [], mcqs: [], mnemonics: [], likely_exam_questions: [], diagrams: [],
      ...a, ...b,
    }
    const content = deepSanitize(merged)

    // Sanity check for basic keys
    if (!content.title && !content.short_notes) {
      await db.collection('notes').updateOne(
        { id: noteId },
        { $set: { status: 'failed', error: 'AI response could not be parsed', updatedAt: new Date() } }
      )
      return
    }
    await db.collection('notes').updateOne(
      { id: noteId },
      { $set: { status: 'done', content, updatedAt: new Date() } }
    )
  } catch (err) {
    console.error('processNoteJob error:', err)
    try {
      const db = await connectToMongo()
      await db.collection('notes').updateOne(
        { id: noteId },
        { $set: { status: 'failed', error: err?.message || 'Unknown error', updatedAt: new Date() } }
      )
    } catch { /* ignore */ }
  }
}

// ---------- YouTube ----------
function extractYouTubeId(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1)
    if (u.searchParams.get('v')) return u.searchParams.get('v')
    const m = u.pathname.match(/\/(shorts|embed|v)\/([^/?#]+)/)
    if (m) return m[2]
  } catch { /* ignore */ }
  return null
}

async function fetchYouTubeTranscript(url) {
  const id = extractYouTubeId(url)
  if (!id) throw new Error('Could not parse YouTube URL')
  const items = await YoutubeTranscript.fetchTranscript(id, { lang: 'en' }).catch(async () => {
    return await YoutubeTranscript.fetchTranscript(id)
  })
  if (!items?.length) throw new Error('No transcript available for this video')
  const text = items.map(i => i.text).join(' ').replace(/\s+/g, ' ')
  return { id, text }
}

async function processYouTubeJob(noteId, input) {
  try {
    const db = await connectToMongo()
    const { url } = input
    const { id: videoId, text } = await fetchYouTubeTranscript(url)
    const transcript = text.length > 18000 ? text.slice(0, 18000) + '…(truncated)' : text
    const enrichedInput = { ...input, subject: input.subject || 'YouTube Lecture', topic: input.topic || `Lecture (${videoId})` }
    const sys = { role: 'system', content: buildSystemPrompt() }
    const userA = { role: 'user', content: `You are given a YouTube lecture transcript. Summarize into structured foundational notes.\n\n${promptFoundations(enrichedInput)}\n\nTRANSCRIPT:\n"""\n${transcript}\n"""` }
    const userB = { role: 'user', content: `You are given a YouTube lecture transcript. Generate revision + assessment JSON.\n\n${promptAssessment(enrichedInput)}\n\nTRANSCRIPT:\n"""\n${transcript}\n"""` }

    const [rawA, rawB] = await Promise.all([
      callLLM([sys, userA], { maxTokens: 3500 }),
      callLLM([sys, userB], { maxTokens: 3500 }),
    ])
    const a = extractJson(rawA) || {}
    const b = extractJson(rawB) || {}
    const merged = {
      title: '', overview: '', short_notes: '', detailed_notes: '',
      key_concepts: [], important_definitions: [], formula_sheet: [],
      quick_revision: '', exam_summary: '',
      faqs: [], mcqs: [], mnemonics: [], likely_exam_questions: [], diagrams: [],
      ...a, ...b,
    }
    const content = deepSanitize(merged)
    await db.collection('notes').updateOne(
      { id: noteId },
      { $set: { status: 'done', content, videoId, updatedAt: new Date() } }
    )
  } catch (err) {
    console.error('processYouTubeJob error:', err)
    try {
      const db = await connectToMongo()
      await db.collection('notes').updateOne(
        { id: noteId },
        { $set: { status: 'failed', error: err?.message || 'Unknown error', updatedAt: new Date() } }
      )
    } catch { /* ignore */ }
  }
}

// ---------- Router ----------
async function handleRoute(request, { params }) {
  const { path = [] } = await params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    const db = await connectToMongo()

    if ((route === '/' || route === '/root') && method === 'GET') {
      return handleCORS(NextResponse.json({ message: 'Study Snap AI backend live', model: FAST_MODEL }))
    }

    // Topic -> Notes (async)
    if (route === '/generate' && method === 'POST') {
      const body = await request.json()
      const { degree, program, course, subject, topic, teacher, length, mode } = body || {}
      if (!degree || !subject || !topic) {
        return handleCORS(NextResponse.json({ error: 'degree, subject and topic are required' }, { status: 400 }))
      }
      const noteId = uuidv4()
      await db.collection('notes').insertOne({
        id: noteId,
        source: 'topic',
        degree, program: program || '', course: course || '', subject, topic,
        teacher: teacher || '', length: length || 'medium', mode: mode || 'standard',
        status: 'pending', content: null,
        model: FAST_MODEL,
        createdAt: new Date(), updatedAt: new Date(),
      })
      processNoteJob(noteId, { degree, program, course, subject, topic, teacher, length, mode })
        .catch(err => console.error('background job failed', err))
      return handleCORS(NextResponse.json({ id: noteId, status: 'pending' }, { status: 202 }))
    }

    // YouTube -> Notes (async)
    if (route === '/generate-youtube' && method === 'POST') {
      const body = await request.json()
      const { url, degree, program, course, subject, topic, teacher, length, mode } = body || {}
      if (!url) return handleCORS(NextResponse.json({ error: 'url is required' }, { status: 400 }))
      const noteId = uuidv4()
      await db.collection('notes').insertOne({
        id: noteId,
        source: 'youtube',
        url,
        degree: degree || 'YouTube Lecture', program: program || '', course: course || '',
        subject: subject || 'YouTube Lecture', topic: topic || 'YouTube Lecture',
        teacher: teacher || '', length: length || 'medium', mode: mode || 'standard',
        status: 'pending', content: null,
        model: FAST_MODEL,
        createdAt: new Date(), updatedAt: new Date(),
      })
      processYouTubeJob(noteId, { url, degree, program, course, subject, topic, teacher, length, mode })
        .catch(err => console.error('yt background job failed', err))
      return handleCORS(NextResponse.json({ id: noteId, status: 'pending' }, { status: 202 }))
    }

    // List recent (exclude content, only completed)
    if (route === '/notes' && method === 'GET') {
      const items = await db.collection('notes')
        .find({ status: { $ne: 'pending' } }, { projection: { _id: 0, content: 0 } })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray()
      return handleCORS(NextResponse.json(items))
    }

    // Single note by id
    if (path[0] === 'notes' && path[1] && method === 'GET') {
      const item = await db.collection('notes').findOne({ id: path[1] }, { projection: { _id: 0 } })
      if (!item) return handleCORS(NextResponse.json({ error: 'not found' }, { status: 404 }))
      return handleCORS(NextResponse.json(item))
    }

    if (path[0] === 'notes' && path[1] && method === 'DELETE') {
      await db.collection('notes').deleteOne({ id: path[1] })
      return handleCORS(NextResponse.json({ ok: true }))
    }

    return handleCORS(NextResponse.json({ error: `Route ${route} not found` }, { status: 404 }))
  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 }))
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
