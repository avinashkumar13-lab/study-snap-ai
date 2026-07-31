'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import {
  Sparkles, Brain, Zap, GraduationCap, BookOpen, Timer, FileDown, Printer,
  Sun, Moon, Loader2, ListChecks, ClipboardList, Lightbulb, HelpCircle,
  Calculator, ScrollText, BookMarked, PenTool, History, Trash2, Search,
  Youtube, Network, ArrowRight
} from 'lucide-react'
import { DEGREES, getPrograms, getCourses, getSubjects } from '@/lib/curriculum'
import ErrorBoundary from '@/components/ErrorBoundary'

const MermaidChart = dynamic(() => import('@/components/MermaidChart'), { ssr: false })

const NOTE_LENGTHS = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'detailed', label: 'Detailed' },
]

function Markdown({ children }) {
  return (
    <div className="prose-notes text-sm leading-relaxed text-foreground/90">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children || ''}</ReactMarkdown>
    </div>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="rounded-full">
      {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  )
}

function NavBar() {
  return (
    <nav className="sticky top-0 z-40 no-print border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-chart-4 glow">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-lg font-bold tracking-tight">Study Snap <span className="gradient-text">AI</span></div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Exam-ready in seconds</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="hidden md:inline-flex">Claude Haiku 4.5</Badge>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
}

function Hero({ onScrollToForm }) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-70" />
      <div className="absolute -left-40 top-10 h-96 w-96 rounded-full bg-primary/25 blur-3xl" />
      <div className="absolute -right-40 top-40 h-96 w-96 rounded-full bg-chart-4/25 blur-3xl" />
      <div className="container relative py-14 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <Badge className="mb-4 bg-primary/15 text-primary hover:bg-primary/20 border-primary/20" variant="outline">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Topic • YouTube • Diagrams • PDF
          </Badge>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05]">
            Turn any topic into <span className="gradient-text">exam-ready notes</span> in seconds
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Pick a topic or paste a YouTube lecture. Instantly get short notes, detailed explanations, formulas,
            MCQs, mnemonics, concept-map diagrams and a one-page exam summary — downloadable as PDF.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" onClick={onScrollToForm} className="text-base h-12 px-6 rounded-xl glow">
              <Zap className="mr-2 h-5 w-5" /> Generate My Notes
            </Button>
          </div>
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: BookOpen, label: '10+ Note Formats' },
              { icon: Youtube, label: 'YouTube → Notes' },
              { icon: Network, label: 'Concept Diagrams' },
              { icon: FileDown, label: 'One-click PDF' },
            ].map(({ icon: Icon, label }, i) => (
              <div key={i} className="rounded-xl border border-border/60 bg-card/50 backdrop-blur px-4 py-3 flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

const emptyTopicForm = {
  degree: '', program: '', course: '', subject: '', topic: '',
  teacher: '', length: 'medium', mode: 'standard',
}

async function safeJson(res) {
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) { try { return await res.json() } catch { return null } }
  return null
}

async function pollNote(id, onProgress) {
  const start = Date.now()
  for (let i = 0; i < 150; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const r = await fetch(`/api/notes/${id}`, { cache: 'no-store' })
    if (r.status === 404) continue
    const data = await safeJson(r)
    if (!data) continue
    if (onProgress) onProgress(Math.min(95, Math.round((Date.now() - start) / 500)))
    if (data.status === 'done') return data
    if (data.status === 'failed') throw new Error(data.error || 'AI generation failed')
  }
  throw new Error('Notes are taking too long. Please try again.')
}

function TopicForm({ onGenerated }) {
  const [form, setForm] = useState(emptyTopicForm)
  const [loading, setLoading] = useState(false)
  const [customSubject, setCustomSubject] = useState(false)
  const [progress, setProgress] = useState(0)

  const programs = useMemo(() => getPrograms(form.degree), [form.degree])
  const courses = useMemo(() => getCourses(form.degree, form.program), [form.degree, form.program])
  const subjects = useMemo(() => getSubjects(form.degree, form.program, form.course), [form.degree, form.program, form.course])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setDegree = v => setForm({ ...emptyTopicForm, degree: v, length: form.length, mode: form.mode })
  const setProgram = v => setForm(f => ({ ...f, program: v, course: '', subject: '' }))
  const setCourse = v => setForm(f => ({ ...f, course: v, subject: '' }))

  const canSubmit = form.degree && form.subject && form.topic && !loading

  const submit = async (modeOverride) => {
    if (!canSubmit) { toast.error('Please fill Degree, Subject, and Topic'); return }
    const payload = { ...form, mode: modeOverride || form.mode }
    setLoading(true); setProgress(3)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await safeJson(res)
      if (!res.ok || !data) throw new Error(data?.error || `Server error (${res.status})`)
      setProgress(15)
      const note = await pollNote(data.id, setProgress)
      setProgress(100)
      toast.success('Notes ready!')
      onGenerated(note)
    } catch (e) {
      toast.error(e.message || 'Something went wrong')
    } finally {
      setLoading(false)
      setTimeout(() => setProgress(0), 800)
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2 flex items-center gap-3 rounded-lg border border-border/60 bg-secondary/50 px-3 py-2 justify-between">
        <div className="flex items-center gap-3">
          <Timer className="h-4 w-4 text-primary" />
          <div className="text-sm">
            <div className="font-medium leading-tight">Exam is Tomorrow</div>
            <div className="text-xs text-muted-foreground">Ultra-compact + mnemonics</div>
          </div>
        </div>
        <Switch checked={form.mode === 'exam_tomorrow'} onCheckedChange={(v) => set('mode', v ? 'exam_tomorrow' : 'standard')} />
      </div>

      <div className="space-y-2">
        <Label>Degree / Level</Label>
        <Select value={form.degree} onValueChange={setDegree}>
          <SelectTrigger><SelectValue placeholder="Select degree" /></SelectTrigger>
          <SelectContent>{DEGREES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Program / Stream</Label>
        <Select value={form.program} onValueChange={setProgram} disabled={!programs.length}>
          <SelectTrigger><SelectValue placeholder={programs.length ? 'Select program' : 'Choose degree first'} /></SelectTrigger>
          <SelectContent>{programs.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Course / Year / Semester</Label>
        <Select value={form.course} onValueChange={setCourse} disabled={!courses.length}>
          <SelectTrigger><SelectValue placeholder={courses.length ? 'Select course' : 'Choose program first'} /></SelectTrigger>
          <SelectContent>{courses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Subject</Label>
          <button type="button" onClick={() => setCustomSubject(v => !v)} className="text-xs text-primary hover:underline">
            {customSubject ? 'Pick from list' : 'Type custom'}
          </button>
        </div>
        {customSubject || !subjects.length ? (
          <Input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="e.g. Data Structures" />
        ) : (
          <Select value={form.subject} onValueChange={v => set('subject', v)}>
            <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
            <SelectContent>{subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Topic</Label>
        <Input value={form.topic} onChange={e => set('topic', e.target.value)} placeholder="e.g. Binary Search Trees — insertion, deletion, traversal" />
      </div>
      <div className="space-y-2">
        <Label>Preferred Teacher Style (optional)</Label>
        <Input value={form.teacher} onChange={e => set('teacher', e.target.value)} placeholder="e.g. Khan Academy, Physics Wallah, Gate Smashers…" />
      </div>
      <div className="space-y-2">
        <Label>Note Length</Label>
        <Select value={form.length} onValueChange={v => set('length', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{NOTE_LENGTHS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="md:col-span-2 flex flex-wrap items-center gap-3 pt-2">
        <Button size="lg" disabled={!canSubmit} onClick={() => submit()} className="h-12 px-6 rounded-xl glow">
          {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
          Generate Notes
        </Button>
        <Button size="lg" variant="outline" disabled={!canSubmit} onClick={() => submit('exam_tomorrow')} className="h-12 rounded-xl">
          <Timer className="mr-2 h-5 w-5" /> Exam Tomorrow Mode
        </Button>
        <span className="text-xs text-muted-foreground">Typically 25–60 seconds.</span>
      </div>
      {loading && (
        <div className="md:col-span-2 space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            {progress < 20 && 'Understanding the topic…'}
            {progress >= 20 && progress < 45 && 'Consulting Claude Haiku 4.5…'}
            {progress >= 45 && progress < 75 && 'Crafting notes, formulas, MCQs & diagrams…'}
            {progress >= 75 && 'Almost done — polishing your Study Snap…'}
          </div>
        </div>
      )}
    </div>
  )
}

function YouTubeForm({ onGenerated }) {
  const [url, setUrl] = useState('')
  const [topic, setTopic] = useState('')
  const [subject, setSubject] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  const canSubmit = url.trim() && !loading

  const submit = async () => {
    if (!canSubmit) { toast.error('Paste a YouTube URL'); return }
    setLoading(true); setProgress(3)
    try {
      const res = await fetch('/api/generate-youtube', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), topic, subject, degree: 'YouTube Lecture' }),
      })
      const data = await safeJson(res)
      if (!res.ok || !data) throw new Error(data?.error || `Server error (${res.status})`)
      setProgress(15)
      const note = await pollNote(data.id, setProgress)
      setProgress(100)
      toast.success('Notes from video ready!')
      onGenerated(note)
    } catch (e) {
      toast.error(e.message || 'Something went wrong')
    } finally {
      setLoading(false)
      setTimeout(() => setProgress(0), 800)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/60 bg-secondary/30 p-3 text-sm text-muted-foreground flex gap-2 items-start">
        <Youtube className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
        <div>Paste any YouTube lecture URL. We&apos;ll fetch the transcript and generate structured notes, flashcards, MCQs and diagrams. Works best with videos that have captions.</div>
      </div>
      <div className="space-y-2">
        <Label>YouTube Lecture URL</Label>
        <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Subject (optional)</Label>
          <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Physics" />
        </div>
        <div className="space-y-2">
          <Label>Topic (optional)</Label>
          <Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Rotational motion" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" disabled={!canSubmit} onClick={submit} className="h-12 px-6 rounded-xl glow">
          {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ArrowRight className="mr-2 h-5 w-5" />}
          Generate from Video
        </Button>
        <span className="text-xs text-muted-foreground">Typically 40–80 seconds depending on video length.</span>
      </div>
      {loading && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            {progress < 15 && 'Fetching video transcript…'}
            {progress >= 15 && progress < 55 && 'Summarising the lecture…'}
            {progress >= 55 && 'Generating MCQs, mnemonics & diagrams…'}
          </div>
        </div>
      )}
    </div>
  )
}

function GeneratorCard({ onGenerated }) {
  return (
    <Card id="generator" className="border-border/60 bg-card/70 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-2xl">Generate Study Snap</CardTitle>
        <CardDescription>Choose Topic-to-Notes or YouTube-to-Notes.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="topic">
          <TabsList className="mb-4 no-print">
            <TabsTrigger value="topic"><BookOpen className="h-4 w-4 mr-1" /> Topic → Notes</TabsTrigger>
            <TabsTrigger value="youtube"><Youtube className="h-4 w-4 mr-1" /> YouTube → Notes</TabsTrigger>
          </TabsList>
          <TabsContent value="topic"><TopicForm onGenerated={onGenerated} /></TabsContent>
          <TabsContent value="youtube"><YouTubeForm onGenerated={onGenerated} /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function MCQItem({ idx, m }) {
  const [picked, setPicked] = useState(null)
  const correctLetter = (m.answer || '').trim().charAt(0).toUpperCase()
  return (
    <div className="rounded-lg border border-border/60 p-4 bg-background/50">
      <div className="font-medium">Q{idx + 1}. {m.question}</div>
      <div className="mt-3 grid gap-2">
        {(m.options || []).map((opt, i) => {
          const letter = String.fromCharCode(65 + i)
          const isPicked = picked === letter
          const isCorrect = correctLetter === letter
          const showResult = picked !== null
          const cls = showResult
            ? isCorrect ? 'border-green-500/60 bg-green-500/10' : isPicked ? 'border-red-500/60 bg-red-500/10' : 'border-border/50'
            : 'border-border/50 hover:border-primary/60'
          return (
            <button key={i} onClick={() => setPicked(letter)} className={`text-left rounded-md border px-3 py-2 text-sm transition ${cls}`}>
              <span className="mr-2 font-semibold">{letter}.</span>{String(opt).replace(/^[A-D][\.\)]\s*/i, '')}
            </button>
          )
        })}
      </div>
      {picked && (
        <div className="mt-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Answer: {correctLetter}.</span> <Markdown>{m.explanation}</Markdown>
        </div>
      )}
    </div>
  )
}

function NotesDisplay({ note }) {
  const { theme } = useTheme()
  const printRef = useRef(null)
  const [downloading, setDownloading] = useState(false)

  if (!note) return null
  const c = note.content || {}
  const meta = [note.degree, note.program, note.course, note.subject].filter(Boolean).join(' • ')

  const downloadPdf = async () => {
    setDownloading(true)
    try {
      const html2pdf = (await import('html2pdf.js')).default
      const el = printRef.current
      if (!el) return
      const filename = `${(c.title || note.topic || 'study-snap').replace(/[^a-z0-9]+/gi, '_').slice(0, 60)}.pdf`
      await html2pdf().set({
        margin: [10, 10, 10, 10],
        filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      }).from(el).save()
    } catch (e) {
      toast.error('PDF export failed: ' + (e?.message || e))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Card id="notes-result" className="border-border/60 bg-card/70 backdrop-blur">
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest">{meta}</div>
            <CardTitle className="text-2xl mt-1">{c.title || note.topic}</CardTitle>
            <div className="mt-1 max-w-3xl text-sm text-muted-foreground">
              <Markdown>{c.overview || ''}</Markdown>
            </div>
          </div>
          <div className="flex items-center gap-2 no-print">
            {note.mode === 'exam_tomorrow' && (
              <Badge className="bg-chart-3/20 text-chart-3 border-chart-3/30" variant="outline"><Timer className="mr-1 h-3 w-3" /> Exam Tomorrow</Badge>
            )}
            {note.source === 'youtube' && (
              <Badge className="bg-red-500/15 text-red-400 border-red-500/30" variant="outline"><Youtube className="mr-1 h-3 w-3" /> YouTube</Badge>
            )}
            <Button variant="outline" size="sm" onClick={downloadPdf} disabled={downloading}>
              {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
              Download PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="short" className="w-full">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1 bg-secondary/60 no-print">
            <TabsTrigger value="short"><BookOpen className="h-4 w-4 mr-1" />Short</TabsTrigger>
            <TabsTrigger value="detailed"><BookMarked className="h-4 w-4 mr-1" />Detailed</TabsTrigger>
            <TabsTrigger value="concepts"><Lightbulb className="h-4 w-4 mr-1" />Concepts</TabsTrigger>
            <TabsTrigger value="defs"><ScrollText className="h-4 w-4 mr-1" />Definitions</TabsTrigger>
            <TabsTrigger value="formulas"><Calculator className="h-4 w-4 mr-1" />Formulas</TabsTrigger>
            <TabsTrigger value="diagrams"><Network className="h-4 w-4 mr-1" />Diagrams</TabsTrigger>
            <TabsTrigger value="revision"><Zap className="h-4 w-4 mr-1" />Revision</TabsTrigger>
            <TabsTrigger value="exam"><ClipboardList className="h-4 w-4 mr-1" />Exam Summary</TabsTrigger>
            <TabsTrigger value="mcqs"><ListChecks className="h-4 w-4 mr-1" />MCQs</TabsTrigger>
            <TabsTrigger value="faqs"><HelpCircle className="h-4 w-4 mr-1" />FAQs</TabsTrigger>
            <TabsTrigger value="mnem"><PenTool className="h-4 w-4 mr-1" />Mnemonics</TabsTrigger>
          </TabsList>

          <div className="mt-6 space-y-6">
            <TabsContent value="short" className="mt-0"><Markdown>{c.short_notes}</Markdown></TabsContent>
            <TabsContent value="detailed" className="mt-0"><Markdown>{c.detailed_notes}</Markdown></TabsContent>

            <TabsContent value="concepts" className="mt-0 space-y-3">
              {(c.key_concepts || []).map((k, i) => (
                <div key={i} className="rounded-lg border border-border/60 p-4 bg-background/50">
                  <div className="font-semibold text-primary">{k.concept}</div>
                  <div className="mt-1 text-sm"><Markdown>{k.explanation}</Markdown></div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="defs" className="mt-0 space-y-3">
              {(c.important_definitions || []).map((d, i) => (
                <div key={i} className="rounded-lg border border-border/60 p-4 bg-background/50">
                  <div className="font-semibold">{d.term}</div>
                  <div className="mt-1 text-sm text-muted-foreground"><Markdown>{d.definition}</Markdown></div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="formulas" className="mt-0">
              {(c.formula_sheet || []).length === 0 ? (
                <div className="text-sm text-muted-foreground">No formulas applicable for this topic.</div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {c.formula_sheet.map((f, i) => (
                    <div key={i} className="rounded-lg border border-border/60 p-4 bg-background/50">
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">{f.name}</div>
                      <div className="mt-2 font-mono text-primary text-base break-words">{f.formula}</div>
                      <div className="mt-2 text-xs text-muted-foreground">When: {f.when_to_use}</div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="diagrams" className="mt-0 space-y-4">
              {(c.diagrams || []).length === 0 ? (
                <div className="text-sm text-muted-foreground">No diagram generated for this topic.</div>
              ) : (
                (c.diagrams || []).map((d, i) => (
                  <div key={i} className="rounded-lg border border-border/60 p-4 bg-background/50">
                    <div className="text-sm font-semibold mb-3">{d.title || `Diagram ${i + 1}`}</div>
                    <ErrorBoundary>
                      <MermaidChart code={d.mermaid} theme={theme} />
                    </ErrorBoundary>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="revision" className="mt-0">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="text-sm font-semibold text-primary mb-2 flex items-center gap-2"><Zap className="h-4 w-4" /> 5-Minute Revision</div>
                <Markdown>{c.quick_revision}</Markdown>
              </div>
            </TabsContent>

            <TabsContent value="exam" className="mt-0 space-y-4">
              <div className="rounded-lg border border-chart-3/30 bg-chart-3/5 p-4">
                <div className="text-sm font-semibold mb-2 flex items-center gap-2"><ClipboardList className="h-4 w-4 text-chart-3" /> One-Page Exam Summary</div>
                <Markdown>{c.exam_summary}</Markdown>
              </div>
              {(c.likely_exam_questions || []).length > 0 && (
                <div className="rounded-lg border border-border/60 p-4">
                  <div className="text-sm font-semibold mb-2">Most Likely Exam Questions</div>
                  <ol className="list-decimal pl-6 space-y-1 text-sm">
                    {c.likely_exam_questions.map((q, i) => <li key={i}>{q}</li>)}
                  </ol>
                </div>
              )}
            </TabsContent>

            <TabsContent value="mcqs" className="mt-0 space-y-4">
              {(c.mcqs || []).map((m, i) => <MCQItem key={i} idx={i} m={m} />)}
            </TabsContent>

            <TabsContent value="faqs" className="mt-0 space-y-3">
              {(c.faqs || []).map((f, i) => (
                <div key={i} className="rounded-lg border border-border/60 p-4 bg-background/50">
                  <div className="font-semibold">Q{i + 1}. {f.question}</div>
                  <div className="mt-2 text-sm"><Markdown>{f.answer}</Markdown></div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="mnem" className="mt-0 grid gap-3 md:grid-cols-2">
              {(c.mnemonics || []).map((m, i) => (
                <div key={i} className="rounded-lg border border-border/60 p-4 bg-background/50">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">For: {m.for}</div>
                  <div className="mt-1 font-medium text-primary">{m.trick}</div>
                </div>
              ))}
            </TabsContent>
          </div>
        </Tabs>

        {/* Off-screen printable PDF layout — rendered but visually hidden. */}
        <div className="pdf-only" style={{ position: 'absolute', left: '-10000px', top: 0, width: '780px' }}>
          <div ref={printRef} style={{ background: '#ffffff', color: '#111', padding: '24px', fontFamily: 'Inter, Arial, sans-serif' }}>
            <PdfContent note={note} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PdfContent({ note }) {
  const c = note.content || {}
  const meta = [note.degree, note.program, note.course, note.subject].filter(Boolean).join(' • ')
  const Sec = ({ title, children }) => (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#6d28d9', borderBottom: '2px solid #ede9fe', paddingBottom: 4, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 12, lineHeight: 1.55 }}>{children}</div>
    </div>
  )
  const md = (s) => <div style={{ whiteSpace: 'pre-wrap' }}><ReactMarkdown remarkPlugins={[remarkGfm]}>{s || ''}</ReactMarkdown></div>
  return (
    <div>
      <div style={{ borderBottom: '3px solid #6d28d9', paddingBottom: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 2 }}>{meta || 'Study Snap AI'}</div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{c.title || note.topic}</div>
        <div style={{ fontSize: 12, color: '#444', marginTop: 4 }}>{c.overview}</div>
      </div>

      <Sec title="Short Notes">{md(c.short_notes)}</Sec>
      <Sec title="Detailed Notes">{md(c.detailed_notes)}</Sec>

      <Sec title="Key Concepts">
        {(c.key_concepts || []).map((k, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <b>{k.concept}:</b> {k.explanation}
          </div>
        ))}
      </Sec>

      <Sec title="Important Definitions">
        {(c.important_definitions || []).map((d, i) => (
          <div key={i} style={{ marginBottom: 6 }}><b>{d.term}:</b> {d.definition}</div>
        ))}
      </Sec>

      {(c.formula_sheet || []).length > 0 && (
        <Sec title="Formula Sheet">
          {c.formula_sheet.map((f, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase' }}>{f.name}</div>
              <div style={{ fontFamily: 'monospace', color: '#6d28d9', fontSize: 13 }}>{f.formula}</div>
              <div style={{ fontSize: 11, color: '#555' }}>When: {f.when_to_use}</div>
            </div>
          ))}
        </Sec>
      )}

      <Sec title="5-Minute Revision">{md(c.quick_revision)}</Sec>
      <Sec title="One-Page Exam Summary">{md(c.exam_summary)}</Sec>

      {(c.likely_exam_questions || []).length > 0 && (
        <Sec title="Most Likely Exam Questions">
          <ol style={{ paddingLeft: 20 }}>
            {c.likely_exam_questions.map((q, i) => <li key={i}>{q}</li>)}
          </ol>
        </Sec>
      )}

      {(c.mcqs || []).length > 0 && (
        <Sec title="MCQs">
          {c.mcqs.map((m, i) => (
            <div key={i} style={{ marginBottom: 10, pageBreakInside: 'avoid' }}>
              <div><b>Q{i + 1}.</b> {m.question}</div>
              <ul style={{ paddingLeft: 20, marginTop: 4 }}>
                {(m.options || []).map((o, j) => <li key={j}>{o}</li>)}
              </ul>
              <div style={{ fontSize: 11, color: '#555' }}><b>Answer:</b> {m.answer}. {m.explanation}</div>
            </div>
          ))}
        </Sec>
      )}

      {(c.faqs || []).length > 0 && (
        <Sec title="FAQs">
          {c.faqs.map((f, i) => (
            <div key={i} style={{ marginBottom: 8, pageBreakInside: 'avoid' }}>
              <div><b>Q{i + 1}.</b> {f.question}</div>
              <div style={{ marginLeft: 12 }}>{md(f.answer)}</div>
            </div>
          ))}
        </Sec>
      )}

      {(c.mnemonics || []).length > 0 && (
        <Sec title="Mnemonics & Memory Tricks">
          {c.mnemonics.map((m, i) => (
            <div key={i} style={{ marginBottom: 6 }}><b>{m.for}:</b> {m.trick}</div>
          ))}
        </Sec>
      )}

      <div style={{ marginTop: 24, fontSize: 10, color: '#999', textAlign: 'center' }}>
        Generated by Study Snap AI • studysnap.ai
      </div>
    </div>
  )
}

function RecentNotes({ items, onSelect, onDelete }) {
  if (!items?.length) return (
    <Card className="border-border/60 bg-card/70 backdrop-blur no-print">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><History className="h-5 w-5" /> Recent Study Snaps</CardTitle>
        <CardDescription>Nothing yet — generate your first notes!</CardDescription>
      </CardHeader>
    </Card>
  )
  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur no-print">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><History className="h-5 w-5" /> Recent Study Snaps</CardTitle>
        <CardDescription>Your last generated notes</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[320px] pr-2">
          <div className="space-y-2">
            {items.map(it => (
              <div key={it.id} className="group flex items-center justify-between gap-2 rounded-lg border border-border/50 p-3 hover:border-primary/60 transition">
                <button onClick={() => onSelect(it.id)} className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-1.5">
                    {it.source === 'youtube' && <Youtube className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                    <div className="font-medium truncate">{it.topic}</div>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{[it.degree, it.subject].filter(Boolean).join(' • ')}</div>
                </button>
                <button onClick={() => onDelete(it.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function App() {
  const [note, setNote] = useState(null)
  const [recent, setRecent] = useState([])
  const [query, setQuery] = useState('')

  const loadRecent = async () => {
    try {
      const r = await fetch('/api/notes')
      if (r.ok) setRecent(await r.json())
    } catch (e) { /* ignore */ }
  }

  useEffect(() => { loadRecent() }, [])

  const onGenerated = (n) => {
    setNote(n)
    loadRecent()
    setTimeout(() => document.getElementById('notes-result')?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const openNote = async (id) => {
    const r = await fetch(`/api/notes/${id}`)
    if (r.ok) {
      const n = await r.json()
      setNote(n)
      setTimeout(() => document.getElementById('notes-result')?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  const deleteNote = async (id) => {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    loadRecent()
    if (note?.id === id) setNote(null)
    toast.success('Deleted')
  }

  const scrollForm = () => document.getElementById('generator')?.scrollIntoView({ behavior: 'smooth' })

  const filtered = query
    ? recent.filter(r => (r.topic + ' ' + r.subject + ' ' + r.degree).toLowerCase().includes(query.toLowerCase()))
    : recent

  return (
    <div className="min-h-screen">
      <NavBar />
      <Hero onScrollToForm={scrollForm} />

      <main className="container pb-24 space-y-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="space-y-8">
            <ErrorBoundary><GeneratorCard onGenerated={onGenerated} /></ErrorBoundary>
            <ErrorBoundary><NotesDisplay note={note} /></ErrorBoundary>
          </div>

          <aside className="space-y-4 no-print">
            <Card className="border-border/60 bg-card/70 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Search className="h-4 w-4" /> Search</CardTitle>
              </CardHeader>
              <CardContent>
                <Input placeholder="Search your notes…" value={query} onChange={e => setQuery(e.target.value)} />
              </CardContent>
            </Card>
            <RecentNotes items={filtered} onSelect={openNote} onDelete={deleteNote} />

            <Card className="border-border/60 bg-gradient-to-br from-primary/10 to-chart-4/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Pro Tips</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>• Be specific in the Topic field — e.g. &quot;Photosynthesis: light &amp; dark reactions&quot;.</p>
                <p>• Paste a YouTube lecture URL to auto-generate notes from its transcript.</p>
                <p>• Open <b>Diagrams</b> tab to see auto-generated concept maps.</p>
                <p>• Click <b>Download PDF</b> to save clean printable notes.</p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>

      <footer className="no-print border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
        Built with Claude Haiku 4.5 • Study Snap AI • Study smarter, not harder.
      </footer>
    </div>
  )
}

export default App
