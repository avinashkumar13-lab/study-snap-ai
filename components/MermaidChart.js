'use client'

import { useEffect, useRef, useState } from 'react'

// Generate a random id so multiple charts on the same page don't collide.
function makeId() {
  return 'm-' + Math.random().toString(36).slice(2, 10)
}

function looksLikeMermaid(code) {
  if (!code || typeof code !== 'string') return false
  const s = code.trim()
  return /^(mindmap|flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey|timeline)\b/i.test(s)
}

// Try to auto-fix common mermaid problems produced by LLMs (e.g. parentheses in labels).
function sanitizeMermaid(code) {
  if (!code) return code
  let s = code.replace(/\r\n/g, '\n').trim()
  // Strip code fences if any survived
  s = s.replace(/^```[a-z]*\n?/i, '').replace(/\n?```\s*$/i, '')
  return s
}

export default function MermaidChart({ code, theme = 'dark' }) {
  const ref = useRef(null)
  const [error, setError] = useState(null)
  const [svg, setSvg] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function render() {
      setError(null)
      setSvg(null)
      const cleaned = sanitizeMermaid(code)
      if (!looksLikeMermaid(cleaned)) {
        setError('Invalid diagram source')
        return
      }
      try {
        const mermaidModule = await import('mermaid')
        const mermaid = mermaidModule.default || mermaidModule
        const isDark = theme === 'dark'
        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          securityLevel: 'loose',
          fontFamily: 'Inter, ui-sans-serif, system-ui',
          suppressErrorRendering: true,
          themeVariables: {
            // Premium palette
            primaryColor: isDark ? '#7c3aed' : '#8b5cf6',
            primaryTextColor: '#ffffff',
            primaryBorderColor: isDark ? '#a78bfa' : '#7c3aed',
            lineColor: isDark ? '#94a3b8' : '#475569',
            secondaryColor: isDark ? '#0284c7' : '#38bdf8',
            tertiaryColor: isDark ? '#059669' : '#10b981',
            background: 'transparent',
            mainBkg: isDark ? '#7c3aed' : '#8b5cf6',
            secondBkg: isDark ? '#0284c7' : '#38bdf8',
            tertiaryBkg: isDark ? '#059669' : '#10b981',
            nodeBorder: isDark ? '#a78bfa' : '#7c3aed',
            clusterBkg: isDark ? 'rgba(124,58,237,0.08)' : 'rgba(139,92,246,0.1)',
            clusterBorder: isDark ? '#a78bfa' : '#7c3aed',
            titleColor: isDark ? '#f5f5ff' : '#111',
            edgeLabelBackground: isDark ? '#0b0b12' : '#ffffff',
            textColor: isDark ? '#e2e8f0' : '#1e293b',
            fontSize: '14px',
          },
          flowchart: { curve: 'basis', padding: 12, htmlLabels: true, useMaxWidth: true },
          mindmap: { padding: 12, useMaxWidth: true },
        })

        // Validate first — throws on syntax error
        try { await mermaid.parse(cleaned) } catch (parseErr) {
          if (!cancelled) setError('Diagram syntax error: ' + (parseErr?.message?.split('\n')[0] || 'unknown'))
          return
        }

        const id = makeId()
        const result = await mermaid.render(id, cleaned)
        if (!cancelled && result?.svg) setSvg(result.svg)
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to render diagram')
      }
    }
    render()
    return () => { cancelled = true }
  }, [code, theme])

  if (error) {
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
        <div className="font-semibold text-amber-500 mb-1">Diagram unavailable</div>
        <div className="text-muted-foreground">{error}</div>
      </div>
    )
  }

  if (!svg) {
    return <div className="text-xs text-muted-foreground py-6 text-center">Rendering diagram…</div>
  }

  return (
    <div
      ref={ref}
      className="w-full overflow-auto flex justify-center [&>svg]:max-w-full [&>svg]:h-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
