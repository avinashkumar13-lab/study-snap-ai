import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'

// MongoDB connection (cached)
let client
let db

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

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

const EMERGENT_LLM_URL = process.env.EMERGENT_LLM_URL || 'https://integrations.emergentagent.com/llm/v1/chat/completions'
const EMERGENT_LLM_KEY = process.env.EMERGENT_LLM_KEY
const LLM_MODEL = process.env.LLM_MODEL || 'claude-sonnet-4-5-20250929'

function buildSystemPrompt() {
  return `You are Study Snap AI, an elite academic tutor and exam-notes generator for students. You produce highly structured, exam-ready study notes that mirror what a top teacher would write on the blackboard.

STRICT RULES:
- Output ONLY valid JSON matching the requested schema. No prose, no markdown fences, no commentary.
- Be factually accurate for the given academic level. Do not hallucinate.
- Use clean concise markdown inside string fields (headings with ##, bullet lists with -, bold with **, code/math with backticks or LaTeX-style inline like $E=mc^2$).
- Adapt vocabulary and depth to the student's academic level.
- Focus on exam-relevance: what is asked, what earns marks, common mistakes.`
}

function buildUserPrompt({ degree, program, course, subject, topic, teacher, length, mode }) {
  const modeLine = mode === 'exam_tomorrow'
    ? 'MODE: ONE-DAY-BEFORE-EXAM — aggressive prioritization, minimum-viable-knowledge, memory tricks, and "most likely to be asked" flagging.'
    : 'MODE: Standard — balanced coverage of concepts.'
  const lengthLine = length === 'short' ? 'Length: concise' : length === 'detailed' ? 'Length: detailed and thorough' : 'Length: medium'
  const teacherLine = teacher ? `Preferred teacher style: ${teacher} — emulate their board-teaching style and shortcuts.` : ''

  return `Generate a complete Study Snap for the following context.

Degree/Level: ${degree}
Program: ${program || 'N/A'}
Course: ${course || 'N/A'}
Subject: ${subject}
Topic: ${topic}
${teacherLine}
${modeLine}
${lengthLine}

Return a JSON object with EXACTLY these fields (all strings use markdown):
{
  "title": "catchy title for the notes",
  "overview": "one paragraph overview of the topic",
  "short_notes": "a compact set of bullet notes covering the whole topic (markdown)",
  "detailed_notes": "a detailed, textbook-quality explanation with headings, examples, and derivations if applicable (markdown)",
  "key_concepts": [ { "concept": "name", "explanation": "1-3 line explanation" } ],
  "important_definitions": [ { "term": "term", "definition": "precise definition" } ],
  "formula_sheet": [ { "name": "formula name", "formula": "LaTeX-style or plain text formula", "when_to_use": "one line usage" } ],
  "quick_revision": "5-minute revision notes as a bullet list (markdown)",
  "exam_summary": "one-page exam-oriented summary highlighting high-yield points (markdown)",
  "faqs": [ { "question": "question", "answer": "answer (markdown)" } ],
  "mcqs": [ { "question": "MCQ question", "options": ["A ...","B ...","C ...","D ..."], "answer": "A/B/C/D", "explanation": "why" } ],
  "mnemonics": [ { "for": "what it helps remember", "trick": "the mnemonic/memory trick" } ],
  "likely_exam_questions": [ "question 1", "question 2" ]
}

Minimum counts: key_concepts >=5, important_definitions >=4, formula_sheet >=3 (or [] if not applicable), faqs >=4, mcqs >=5, mnemonics >=2, likely_exam_questions >=4. Keep detailed_notes focused (do not exceed ~500 words).
If formulas do not apply (e.g., pure history), return formula_sheet: [].
Return ONLY the JSON object.`
}

function extractJson(text) {
  if (!text) return null
  // Strip code fences if present
  let s = text.trim()
  if (s.startsWith('```')) {
    s = s.replace(/^```(json)?/i, '').replace(/```$/,'').trim()
  }
  // Find first { and last }
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  const jsonStr = s.slice(start, end + 1)
  try { return JSON.parse(jsonStr) } catch { return null }
}

async function callLLM(messages, { maxTokens = 4000, temperature = 0.3 } = {}) {
  const res = await fetch(EMERGENT_LLM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${EMERGENT_LLM_KEY}`,
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`LLM error ${res.status}: ${t.slice(0, 300)}`)
  }
  const data = await res.json()
  return data?.choices?.[0]?.message?.content || ''
}

async function handleRoute(request, { params }) {
  const { path = [] } = await params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    const db = await connectToMongo()

    if ((route === '/' || route === '/root') && method === 'GET') {
      return handleCORS(NextResponse.json({ message: 'Study Snap AI backend live', model: LLM_MODEL }))
    }

    // Generate notes
    if (route === '/generate' && method === 'POST') {
      const body = await request.json()
      const { degree, program, course, subject, topic, teacher, length, mode } = body || {}
      if (!degree || !subject || !topic) {
        return handleCORS(NextResponse.json({ error: 'degree, subject and topic are required' }, { status: 400 }))
      }

      const messages = [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt({ degree, program, course, subject, topic, teacher, length, mode }) },
      ]

      const raw = await callLLM(messages, { maxTokens: 4500, temperature: 0.3 })
      const parsed = extractJson(raw)
      if (!parsed) {
        return handleCORS(NextResponse.json({ error: 'Failed to parse AI response', raw: raw.slice(0, 500) }, { status: 502 }))
      }

      const note = {
        id: uuidv4(),
        degree, program: program || '', course: course || '', subject, topic,
        teacher: teacher || '', length: length || 'medium', mode: mode || 'standard',
        content: parsed,
        model: LLM_MODEL,
        createdAt: new Date(),
      }

      await db.collection('notes').insertOne(note)
      const { _id, ...clean } = note
      return handleCORS(NextResponse.json(clean))
    }

    // List recent notes
    if (route === '/notes' && method === 'GET') {
      const items = await db.collection('notes')
        .find({}, { projection: { _id: 0, content: 0 } })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray()
      return handleCORS(NextResponse.json(items))
    }

    // Get single note by id -> /notes/<id>
    if (path[0] === 'notes' && path[1] && method === 'GET') {
      const item = await db.collection('notes').findOne({ id: path[1] }, { projection: { _id: 0 } })
      if (!item) return handleCORS(NextResponse.json({ error: 'not found' }, { status: 404 }))
      return handleCORS(NextResponse.json(item))
    }

    // Delete note
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
