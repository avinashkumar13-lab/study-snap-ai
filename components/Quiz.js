'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, RotateCcw, Sparkles, ArrowLeft, ArrowRight, Eye, Trophy, Target, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function difficultyColor(d) {
  const x = (d || 'medium').toLowerCase()
  if (x === 'easy') return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
  if (x === 'hard') return 'bg-red-500/15 text-red-500 border-red-500/30'
  return 'bg-amber-500/15 text-amber-500 border-amber-500/30'
}

export default function Quiz({ quiz, onRetry, onNewSet }) {
  const [started, setStarted] = useState(false)
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState({}) // { qIdx: 'A' }
  const [showExplain, setShowExplain] = useState({}) // { qIdx: true }
  const [finished, setFinished] = useState(false)

  const questions = quiz?.questions || []
  const total = questions.length

  const score = useMemo(() => {
    let correct = 0
    for (let i = 0; i < questions.length; i++) {
      if (answers[i] && answers[i] === questions[i].answer) correct++
    }
    return correct
  }, [answers, questions])

  const percentage = total ? Math.round((score / total) * 100) : 0

  const handlePick = (letter) => {
    setAnswers(a => ({ ...a, [idx]: letter }))
  }
  const revealAnswer = () => setAnswers(a => ({ ...a, [idx]: a[idx] || questions[idx].answer }))
  const toggleExplain = () => setShowExplain(s => ({ ...s, [idx]: !s[idx] }))

  const next = () => setIdx(i => Math.min(i + 1, total - 1))
  const prev = () => setIdx(i => Math.max(0, i - 1))
  const finish = () => setFinished(true)
  const restart = () => {
    setStarted(false); setIdx(0); setAnswers({}); setShowExplain({}); setFinished(false)
  }

  if (!started) {
    return (
      <Card className="border-border/60 bg-gradient-to-br from-primary/10 to-chart-4/10">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-chart-4 flex items-center justify-center glow">
              <Target className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">{quiz.exam} — Previous Year Style Quiz</CardTitle>
              <CardDescription>
                {[quiz.subject, quiz.topic].filter(Boolean).join(' • ') || 'Mixed topics'} · {total} questions
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {['easy','medium','hard'].map(d => {
              const n = questions.filter(q => (q.difficulty || 'medium').toLowerCase() === d).length
              return (
                <div key={d} className="rounded-lg border border-border/60 bg-background/50 p-3 text-center">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">{d}</div>
                  <div className="text-2xl font-bold mt-1">{n}</div>
                </div>
              )
            })}
          </div>
          <Button size="lg" onClick={() => setStarted(true)} className="w-full h-12 rounded-xl glow">
            <Sparkles className="mr-2 h-5 w-5" /> Start Quiz
          </Button>
          <div className="mt-3 flex flex-wrap gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={onNewSet}><RotateCcw className="mr-2 h-4 w-4" /> Generate New Set</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (finished) {
    const grade = percentage >= 85 ? 'Excellent!' : percentage >= 70 ? 'Great!' : percentage >= 50 ? 'Good' : 'Keep practicing'
    const gradeColor = percentage >= 70 ? 'text-emerald-400' : percentage >= 50 ? 'text-amber-400' : 'text-red-400'
    return (
      <Card className="border-border/60 bg-gradient-to-br from-primary/10 to-chart-4/10">
        <CardHeader className="text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-gradient-to-br from-primary to-chart-4 flex items-center justify-center glow">
            <Trophy className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-3xl mt-3">{score} / {total}</CardTitle>
          <CardDescription className={`text-lg ${gradeColor}`}>{percentage}% — {grade}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={percentage} className="h-3" />
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={restart} variant="outline" className="h-12"><RotateCcw className="mr-2 h-4 w-4" /> Retry Quiz</Button>
            <Button onClick={onNewSet} className="h-12 glow"><Sparkles className="mr-2 h-4 w-4" /> Generate New Set</Button>
          </div>
          <div className="mt-4 space-y-3">
            <div className="text-sm font-semibold text-muted-foreground">Review</div>
            {questions.map((q, i) => {
              const picked = answers[i]
              const correct = picked === q.answer
              return (
                <div key={i} className="rounded-lg border border-border/60 p-3 bg-background/40">
                  <div className="flex items-start gap-2">
                    {picked ? (correct ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />) : <XCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">Q{i + 1}. {q.question}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Your answer: <b className={correct ? 'text-emerald-500' : 'text-red-500'}>{picked || '—'}</b> · Correct: <b className="text-emerald-500">{q.answer}</b>
                        {q.concept ? <> · <span className="italic">{q.concept}</span></> : null}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    )
  }

  const q = questions[idx]
  if (!q) return null
  const picked = answers[idx]
  const correctLetter = q.answer
  const answered = !!picked

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/40 text-primary">Q {idx + 1} / {total}</Badge>
            <Badge variant="outline" className={difficultyColor(q.difficulty)}>{(q.difficulty || 'medium').toUpperCase()}</Badge>
            {q.concept && <Badge variant="secondary" className="hidden md:inline-flex">{q.concept}</Badge>}
          </div>
          <div className="text-xs text-muted-foreground">Score: <b className="text-foreground">{score}</b> / {Object.keys(answers).length || 0}</div>
        </div>
        <Progress value={((idx + 1) / total) * 100} className="h-1.5 mt-2" />
      </CardHeader>
      <CardContent>
        <div className="text-lg font-semibold leading-snug">{q.question}</div>
        <div className="mt-4 grid gap-2">
          {(q.options || []).map((opt, i) => {
            const letter = String.fromCharCode(65 + i)
            const isPicked = picked === letter
            const isCorrect = correctLetter === letter
            const showResult = answered
            const cls = showResult
              ? isCorrect ? 'border-emerald-500/60 bg-emerald-500/10'
              : isPicked ? 'border-red-500/60 bg-red-500/10'
              : 'border-border/50 opacity-70'
              : 'border-border/50 hover:border-primary/60 hover:bg-primary/5'
            return (
              <button
                key={i}
                onClick={() => !answered && handlePick(letter)}
                disabled={answered}
                className={`text-left rounded-md border px-4 py-3 text-sm transition flex items-start gap-3 ${cls}`}
              >
                <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-current text-xs font-semibold">{letter}</span>
                <span className="flex-1">{String(opt).replace(/^[A-D][\.\)]\s*/i, '')}</span>
                {showResult && isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />}
                {showResult && isPicked && !isCorrect && <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />}
              </button>
            )
          })}
        </div>

        {answered && showExplain[idx] && (
          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="text-xs uppercase tracking-widest text-primary mb-1">Explanation</div>
            <div className="text-sm text-foreground/90"><ReactMarkdown remarkPlugins={[remarkGfm]}>{q.explanation || ''}</ReactMarkdown></div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={prev} disabled={idx === 0}><ArrowLeft className="mr-2 h-4 w-4" /> Previous</Button>
          {!answered ? (
            <Button variant="secondary" onClick={revealAnswer}><Eye className="mr-2 h-4 w-4" /> Show Answer</Button>
          ) : (
            <Button variant="secondary" onClick={toggleExplain}>
              <Eye className="mr-2 h-4 w-4" /> {showExplain[idx] ? 'Hide' : 'Show'} Explanation
            </Button>
          )}
          {idx < total - 1 ? (
            <Button onClick={next} className="ml-auto glow">Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
          ) : (
            <Button onClick={finish} className="ml-auto glow"><Trophy className="mr-2 h-4 w-4" /> Finish</Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
