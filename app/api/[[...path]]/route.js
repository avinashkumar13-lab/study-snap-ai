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
  "diagrams": [ { "title": "diagram title", "kind": "mindmap|flowchart|process|comparison", "mermaid": "valid mermaid code" } ]
}

Counts (STRICT): faqs=4, mcqs=5, mnemonics=3, likely_exam_questions=5, diagrams=2.
For MCQ answer, return just the letter (A/B/C/D). Keep exam_summary and quick_revision concise.

DIAGRAM RULES — MAKE THEM VISUALLY RICH AND EXAM-FRIENDLY:
- Provide TWO diagrams of DIFFERENT kinds. Choose two from: mindmap (concept map), flowchart (process/decision), or a comparison layout using flowchart LR.
- Use mermaid v10 syntax that renders without extra config.
- COLOR the diagrams using classDef blocks — one classDef per category, with distinct fills. Example:
  classDef primary fill:#7c3aed,stroke:#a78bfa,color:#fff,stroke-width:2px;
  classDef success fill:#059669,stroke:#34d399,color:#fff,stroke-width:2px;
  classDef warn    fill:#d97706,stroke:#fbbf24,color:#fff,stroke-width:2px;
  classDef info    fill:#0284c7,stroke:#38bdf8,color:#fff,stroke-width:2px;
  classDef danger  fill:#dc2626,stroke:#f87171,color:#fff,stroke-width:2px;
  Then apply with:  class NodeA,NodeB primary;  class NodeC success;
- For MINDMAP: use root((Topic)) and expressive sub-branches (up to 3 levels). Prefix branches with emoji-free short keyphrases only.
  Example:
  mindmap
    root((Photosynthesis))
      Light Reactions
        PSII splits water
        ATP formed
      Dark Reactions
        Calvin cycle
        Sugar synthesis
      Factors
        Light intensity
        CO2 level
- For FLOWCHART: use "flowchart TD" or "flowchart LR". Use shapes: rectangles A[Text], rhombus for decisions A{Question?}, rounded A(Text), stadium A([Text]). Add labelled arrows: A -- yes --> B; A -- no --> C.
- KEEP labels short (max 5 words). No parentheses/quotes inside labels. Use plain ASCII letters, digits, spaces, dashes.
- Prefer 8-15 nodes per diagram — rich enough to be useful, not overwhelming.

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

// ---------- Previous Year MCQ generation ----------
const EXAM_STYLE_HINTS = {
  'NEET': 'NEET (India) — Biology 50%, Physics 25%, Chemistry 25%. NCERT-based. Assertion-reason and matrix-match style included.',
  'JEE Main': 'JEE Main (India) — Physics, Chemistry, Math. Conceptual + numerical single-correct MCQs. Application-heavy.',
  'JEE Advanced': 'JEE Advanced (India) — hardest reasoning, multi-step problems, integer/multi-correct patterns simplified to single-correct.',
  'CBSE Class 10': 'CBSE Class 10 Board style — case-based & competency questions. Aligned with NCERT.',
  'CBSE Class 12': 'CBSE Class 12 Board style — assertion-reason, case-based, NCERT-aligned.',
  'State Boards': 'Indian State Boards — textbook-aligned, moderate difficulty.',
  'SSC': 'SSC style — general awareness, quant, reasoning, English.',
  'SSC CGL': 'SSC CGL (Tier 1) — GA, Quant, Reasoning, English. Speed + accuracy focused.',
  'SSC CHSL': 'SSC CHSL — 10+2 level GA, Quant, Reasoning, English.',
  'Railway Group D': 'Railway Group D — Math, Reasoning, GS, General Science (10th level).',
  'Railway Group C': 'Railway Group C (RRB NTPC-like) — Math, Reasoning, GA. Moderate difficulty.',
  'Banking Exams': 'Banking (IBPS/SBI PO) — Quant DI, Reasoning, English, GA (banking/current affairs).',
  'UPSC': 'UPSC CSE Prelims — analytical, factual, current-affairs-tinged. Multi-statement type simplified to single-correct.',
  'CUET': 'CUET UG — domain-specific + general test. NCERT-based domain MCQs.',
  'NDA': 'NDA — Math (10+2), GAT (English, GK, Physics, Chem, GS, History, Geography).',
  'Defence Exams': 'Defence exams (CDS/AFCAT) — English, GK, Elementary Mathematics.',
  'Other Competitive Exams': 'General competitive exam style — mixed difficulty, PYQ-inspired.',
}

function promptQuiz({ exam, subject, topic, count = 20 }) {
  const hint = EXAM_STYLE_HINTS[exam] || 'General competitive exam style.'
  return `Generate exactly ${count} previous-year-style MCQs for a student preparing for the following exam. Base them on typical PYQ trends, high-yield concepts, and common traps.

EXAM: ${exam}
SUBJECT: ${subject || 'General'}
TOPIC: ${topic || 'Overall'}
EXAM STYLE: ${hint}

Return strict JSON only:
{
  "exam": "${exam}",
  "subject": ${JSON.stringify(subject || '')},
  "topic": ${JSON.stringify(topic || '')},
  "questions": [
    {
      "question": "the question stem (concise)",
      "options": ["A. option 1", "B. option 2", "C. option 3", "D. option 4"],
      "answer": "A",
      "explanation": "1-3 line explanation focused on why the answer is correct and common wrong assumptions",
      "concept": "the key concept/topic tested",
      "difficulty": "easy" 
    }
  ]
}

Rules:
- EXACTLY ${count} questions.
- Mix of difficulty: ~7 easy, ~8 medium, ~5 hard.
- Vary the questions each time. Do NOT repeat classic textbook definitions in every question — mix conceptual, application, numerical, statement-based, and assertion-style items (each rewritten as a single-correct MCQ).
- Only ONE correct option per question.
- "answer" is JUST the letter (A/B/C/D).
- "difficulty" is one of "easy","medium","hard".
- Options must all be plausible; do not include "None of the above" more than twice total.
${MATH_STYLE}

Return ONLY the JSON.`
}

async function processQuizJob(quizId, input) {
  try {
    const db = await connectToMongo()
    const sys = { role: 'system', content: 'You are an expert exam-question setter for Indian competitive exams. Output strict JSON only.\n' + MATH_STYLE }
    const raw = await callLLM(
      [sys, { role: 'user', content: promptQuiz(input) }],
      { maxTokens: 6000, temperature: 0.7 }
    )
    const parsed = extractJson(raw)
    if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      await db.collection('quizzes').updateOne(
        { id: quizId },
        { $set: { status: 'failed', error: 'AI response could not be parsed', updatedAt: new Date() } }
      )
      return
    }
    // Sanitize math in questions/options/explanations
    const questions = parsed.questions.map(q => deepSanitize({
      question: q.question || '',
      options: Array.isArray(q.options) ? q.options.slice(0, 4) : [],
      answer: (q.answer || '').trim().toUpperCase().charAt(0),
      explanation: q.explanation || '',
      concept: q.concept || '',
      difficulty: (q.difficulty || 'medium').toLowerCase(),
    })).filter(q => q.question && q.options.length === 4 && ['A','B','C','D'].includes(q.answer))

    await db.collection('quizzes').updateOne(
      { id: quizId },
      { $set: { status: 'done', questions, count: questions.length, updatedAt: new Date() } }
    )
  } catch (err) {
    console.error('processQuizJob error:', err)
    try {
      const db = await connectToMongo()
      await db.collection('quizzes').updateOne(
        { id: quizId },
        { $set: { status: 'failed', error: err?.message || 'Unknown error', updatedAt: new Date() } }
      )
    } catch { /* ignore */ }
  }
}


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

    // ---- Previous Year MCQ Quiz Generation (async) ----
    if (route === '/generate-quiz' && method === 'POST') {
      const body = await request.json()
      const { exam, subject, topic, count } = body || {}
      if (!exam) return handleCORS(NextResponse.json({ error: 'exam is required' }, { status: 400 }))
      const quizId = uuidv4()
      const n = Math.min(Math.max(parseInt(count) || 20, 5), 30)
      await db.collection('quizzes').insertOne({
        id: quizId,
        exam, subject: subject || '', topic: topic || '',
        status: 'pending', questions: null, count: n,
        model: FAST_MODEL,
        createdAt: new Date(), updatedAt: new Date(),
      })
      processQuizJob(quizId, { exam, subject, topic, count: n })
        .catch(err => console.error('quiz job failed', err))
      return handleCORS(NextResponse.json({ id: quizId, status: 'pending' }, { status: 202 }))
    }

    if (route === '/quizzes' && method === 'GET') {
      const items = await db.collection('quizzes')
        .find({ status: { $ne: 'pending' } }, { projection: { _id: 0, questions: 0 } })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray()
      return handleCORS(NextResponse.json(items))
    }

    if (path[0] === 'quizzes' && path[1] && method === 'GET') {
      const item = await db.collection('quizzes').findOne({ id: path[1] }, { projection: { _id: 0 } })
      if (!item) return handleCORS(NextResponse.json({ error: 'not found' }, { status: 404 }))
      return handleCORS(NextResponse.json(item))
    }

    if (path[0] === 'quizzes' && path[1] && method === 'DELETE') {
      await db.collection('quizzes').deleteOne({ id: path[1] })
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
