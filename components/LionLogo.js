'use client'

export default function LionLogo({ className = '' }) {
  // Golden lion crest — SVG. Uses gradient to render gold shine.
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="lionGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="45%" stopColor="#f5c542" />
          <stop offset="100%" stopColor="#b8860b" />
        </linearGradient>
        <radialGradient id="lionShine" cx="50%" cy="35%" r="55%">
          <stop offset="0%" stopColor="#fff9c4" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#f5c542" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Mane */}
      <g fill="url(#lionGold)" stroke="#7c4a03" strokeWidth="0.8">
        <circle cx="32" cy="32" r="22" />
        {Array.from({ length: 14 }).map((_, i) => {
          const a = (i / 14) * Math.PI * 2
          const r1 = 22
          const r2 = 30
          const x1 = 32 + Math.cos(a) * r1
          const y1 = 32 + Math.sin(a) * r1
          const x2 = 32 + Math.cos(a) * r2
          const y2 = 32 + Math.sin(a) * r2
          return (
            <polygon
              key={i}
              points={`${x1 - 2},${y1 - 2} ${x2},${y2} ${x1 + 2},${y1 + 2}`}
            />
          )
        })}
      </g>
      {/* Face highlight */}
      <circle cx="32" cy="30" r="16" fill="url(#lionShine)" />
      {/* Snout / muzzle */}
      <ellipse cx="32" cy="38" rx="7" ry="5" fill="#fff2b8" stroke="#7c4a03" strokeWidth="0.7" />
      {/* Nose */}
      <path d="M32 33 L35 37 L29 37 Z" fill="#4a2900" />
      {/* Mouth */}
      <path d="M32 37 Q32 42 29 42 M32 37 Q32 42 35 42" fill="none" stroke="#4a2900" strokeWidth="1" strokeLinecap="round" />
      {/* Eyes */}
      <ellipse cx="26" cy="29" rx="1.6" ry="2.2" fill="#2b1400" />
      <ellipse cx="38" cy="29" rx="1.6" ry="2.2" fill="#2b1400" />
      <circle cx="26.5" cy="28.4" r="0.6" fill="#fff" />
      <circle cx="38.5" cy="28.4" r="0.6" fill="#fff" />
      {/* Ears */}
      <ellipse cx="21" cy="20" rx="2.5" ry="3" fill="url(#lionGold)" stroke="#7c4a03" strokeWidth="0.6" />
      <ellipse cx="43" cy="20" rx="2.5" ry="3" fill="url(#lionGold)" stroke="#7c4a03" strokeWidth="0.6" />
    </svg>
  )
}
