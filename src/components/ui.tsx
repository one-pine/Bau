import type { ReactNode } from 'react'
import { KANDINSKY } from '../engine/bauhaus'
import type { ShapeKind } from '../engine/types'

export function IconButton({
  label,
  active,
  disabled,
  onClick,
  children,
  wide,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
  wide?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={[
        'flex h-12 shrink-0 items-center justify-center gap-1.5 text-[11px] font-medium tracking-[0.12em] uppercase transition-colors',
        wide ? 'px-3' : 'w-[min(48px,10vw)]',
        active ? 'bg-ink text-paper ring-1 ring-inset ring-paper/30' : 'bg-paper text-ink hover:bg-ink/5',
        disabled ? 'opacity-30' : '',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export function ShapeGlyph({ kind, size = 22, color }: { kind: ShapeKind; size?: number; color?: string }) {
  const c = color ?? KANDINSKY[kind]
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {kind === 'circle' && <circle cx="12" cy="12" r="10" fill={c} />}
      {kind === 'square' && <rect x="3" y="3" width="18" height="18" fill={c} />}
      {kind === 'triangle' && <polygon points="12,2.5 22.5,21 1.5,21" fill={c} />}
      {kind === 'trapezoid' && <polygon points="7,5.5 17,5.5 22,18.5 2,18.5" fill={c} />}
      {kind === 'spherical' && <path d="M22 18.3 A20 20 0 0 1 2 18.3 A20 20 0 0 1 12 1 A20 20 0 0 1 22 18.3Z" fill={c} />}
      {kind === 'ellipse' && <ellipse cx="12" cy="12" rx="11" ry="6.8" fill={c} />}
      {kind === 'line' && <line x1="2" y1="22" x2="22" y2="2" stroke={c} strokeWidth="3" />}
    </svg>
  )
}

/** 道具のアイコン */
export function ToolGlyph({ tool, size = 22 }: { tool: 'homage' | 'fold' | 'walker'; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {tool === 'homage' && (
        <>
          <rect x="2" y="2" width="20" height="20" fill="#e8762c" />
          <rect x="4" y="5" width="16" height="16" fill="#f0a24a" />
          <rect x="6" y="8" width="12" height="12" fill="#f2c230" />
          <rect x="8" y="11" width="8" height="8" fill="#f6dc7a" />
        </>
      )}
      {tool === 'fold' && (
        <>
          <polygon points="2,4 12,4 12,20 2,20" fill="#1e4fa0" />
          <polygon points="12,4 22,4 22,20 12,20" fill="#1e4fa0" opacity="0.35" />
          <line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
        </>
      )}
      {tool === 'walker' && (
        <polyline points="2,20 8,14 8,8 14,8 20,2 22,4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="miter" />
      )}
    </svg>
  )
}

export const TOOL_LABELS = { homage: 'オマージュ', fold: '折り', walker: '散歩する線' } as const

export const SHAPE_LABELS: Record<ShapeKind, string> = {
  circle: '円',
  triangle: '三角',
  square: '四角',
  line: '直線',
  trapezoid: '台形',
  spherical: '球面三角',
  ellipse: '楕円',
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onStart,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format?: (v: number) => string
  onStart?: () => void
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between text-[11px] tracking-[0.14em] uppercase">
        <span>{label}</span>
        <span className="tabular-nums opacity-60">{format ? format(value) : Math.round(value)}</span>
      </div>
      <input
        type="range"
        className="bau-range w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={onStart}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="grid border border-ink" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={[
            'flex h-10 items-center justify-center text-xs tracking-wider',
            i > 0 ? 'border-l border-ink' : '',
            o.value === value ? 'bg-ink text-paper' : 'bg-paper text-ink',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="flex w-full items-center justify-between gap-4 py-2 text-left">
      <span>
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-[11px] leading-snug opacity-55">{hint}</span>}
      </span>
      <span className={['relative h-6 w-11 shrink-0 border border-ink transition-colors', value ? 'bg-ink' : 'bg-paper'].join(' ')}>
        <span
          className={['absolute top-0.5 h-4 w-4 transition-all', value ? 'left-[22px] bg-paper' : 'left-0.5 bg-ink'].join(' ')}
        />
      </span>
    </button>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-[10px] font-semibold tracking-[0.2em] uppercase opacity-55">{children}</h3>
}
