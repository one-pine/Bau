import { RotateCcw } from 'lucide-react'
import { BACKGROUNDS } from '../engine/bauhaus'
import { DEFAULT_WEIGHTS, RULES } from '../engine/rules'
import type { ContrastMode, GridMode, RuleId, ToneMode } from '../engine/types'
import { useRuntime } from '../state/runtime'
import { actions, defaultView, useStore } from '../state/store'
import Sheet from './Sheet'
import { SectionTitle, Segmented, Slider, Toggle } from './ui'

const pct = (v: number) => `${Math.round(v * 100)}%`

const TONE_HINT: Record<ToneMode, string> = {
  color: '色相・明るさ・面積で重さが決まる。',
  mono: '重さは明るさと面積だけで決まり、形そのものの対比が主役になる。明るさは 7 段階（イッテンの色彩球）。',
  accent: 'バウハウスの印刷物のように、白黒の中で最も大きな図形にだけ色を残す。',
}

const CONTRASTS: { value: ContrastMode; label: string; hint: string }[] = [
  { value: 'none', label: 'なし', hint: '形と色の対応のまま。背景に溶け込む色だけを補正する。' },
  { value: 'hue', label: '色相', hint: '色相の対比：すべてを純色（イッテンの 6 色相）へ寄せる。' },
  { value: 'lightDark', label: '明暗', hint: '明暗の対比：大きな図形ほど背景から遠い明るさに。7 段階をまんべんなく使う。' },
  { value: 'coldWarm', label: '寒暖', hint: '寒暖の対比：角ばった形は暖色へ、丸い形は寒色へ押し出す。' },
  { value: 'complementary', label: '補色', hint: '補色の対比：最も大きな図形の色と、その補色の 2 色だけで構成する。' },
  { value: 'simultaneous', label: '同時', hint: '同時対比：主役の 1 色と、同じ明るさの灰色。灰色が主役の補色を帯びて見える。' },
  { value: 'saturation', label: '彩度', hint: '彩度の対比：主役だけ鮮やかに、ほかは灰色を混ぜて沈める。' },
  { value: 'extension', label: '面積', hint: '面積の対比：明るい色ほど小さく（黄 3 : 橙 4 : 赤 6 : 緑 6 : 青 8 : 紫 9）。図形の大きさが変わる。' },
]

export default function SettingsSheet() {
  const s = useStore((st) => st.settings)
  const set = actions.setSettings

  return (
    <Sheet title="理論 / Theory" onClose={actions.toggleSettings}>
      <div className="space-y-6">
        <div>
          <SectionTitle>モジュール・グリッド</SectionTitle>
          <Segmented<GridMode>
            value={s.grid}
            onChange={(grid) => set({ grid })}
            options={[
              { value: '8', label: '8 × 8' },
              { value: '12', label: '12 × 12' },
              { value: 'golden', label: '黄金比 φ' },
            ]}
          />
          <Toggle
            label="グリッドと天秤を表示"
            hint="▲ の支点が均衡の目標、● が視覚的重みの重心。竿は重い側へ傾く"
            value={s.showGrid}
            onChange={(showGrid) => set({ showGrid })}
          />
        </div>

        <div className="space-y-4">
          <SectionTitle>均衡と緊張 — カンディンスキーの基礎平面</SectionTitle>
          <Slider
            label="均衡　静的 ⟷ 動的"
            value={s.dynamism}
            min={0}
            max={1}
            step={0.01}
            format={(v) => (v < 0.1 ? '中央' : v > 0.9 ? '黄金分割点' : pct(v))}
            onChange={(dynamism) => set({ dynamism })}
          />
          <Slider
            label="緊張　安定 ⟷ 劇的"
            value={s.tension}
            min={-1}
            max={1}
            step={0.01}
            format={(v) => (Math.abs(v) < 0.05 ? 'なし' : v < 0 ? `安定 ${pct(-v)}` : `劇的 ${pct(v)}`)}
            onChange={(tension) => set({ tension })}
          />
          <p className="text-[11px] leading-relaxed opacity-60">
            画面の下・右は重く、上・左は軽く感じられる。安定では重い形が下へ、劇的では重い形が上へ集まる。
          </p>
          <Evaluation />
          <WeightEditor />
        </div>

        <div>
          <SectionTitle>カンディンスキー 対応論</SectionTitle>
          <Toggle
            label="形態 ⇄ 色彩の連動"
            hint="□赤 △黄 ○青 台形橙 球面三角緑 楕円紫。三角形は頂角で 鋭角＝黄 → 鈍角＝青、直線は 水平＝寒色 → 垂直＝暖色。手動で色を選んだ図形はその色を保つ"
            value={s.correspondence}
            onChange={(correspondence) => set({ correspondence })}
          />
        </div>

        <div>
          <SectionTitle>色調 Tone</SectionTitle>
          <Segmented<ToneMode>
            value={s.tone}
            onChange={(tone) => set({ tone })}
            options={[
              { value: 'color', label: 'カラー' },
              { value: 'mono', label: 'モノトーン' },
              { value: 'accent', label: '＋1色' },
            ]}
          />
          <p className="mt-2 text-[11px] leading-relaxed opacity-60">{TONE_HINT[s.tone]}</p>
        </div>

        <div>
          <SectionTitle>イッテン 7 つの色彩対比</SectionTitle>
          <div className="grid grid-cols-4 border-t border-l border-ink">
            {CONTRASTS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => set({ contrastMode: c.value })}
                className={[
                  'flex h-10 items-center justify-center border-r border-b border-ink text-xs',
                  s.contrastMode === c.value ? 'bg-ink text-paper' : 'bg-paper text-ink',
                ].join(' ')}
              >
                {c.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed opacity-60">{CONTRASTS.find((c) => c.value === s.contrastMode)?.hint}</p>
        </div>

        <div>
          <SectionTitle>イッテン 対比 — 背景</SectionTitle>
          <div className="grid grid-cols-4 gap-2">
            {BACKGROUNDS.map((b) => (
              <button
                key={b.value}
                type="button"
                onClick={() => set({ background: b.value })}
                className="flex flex-col items-center gap-1 text-[10px]"
              >
                <span
                  className={['h-10 w-full border', s.background === b.value ? 'border-ink ring-2 ring-ink ring-offset-2 ring-offset-paper' : 'border-ink/30'].join(' ')}
                  style={{ background: b.value }}
                />
                <span className={s.background === b.value ? 'font-semibold' : 'opacity-60'}>{b.name}</span>
              </button>
            ))}
          </div>
          <Toggle label="重ね合わせ（乗算）" hint="版画のように色が重なる。暗い背景ではスクリーン合成" value={s.blend === 'multiply'} onChange={(v) => set({ blend: v ? 'multiply' : 'normal' })} />
        </div>

        <div>
          <SectionTitle>万華鏡 Symmetry</SectionTitle>
          <Toggle label="ミラーリング" value={s.symmetry} onChange={(symmetry) => set({ symmetry })} />
          <div className="mt-2 space-y-2">
            <Segmented<number>
              value={s.folds}
              onChange={(folds) => set({ folds, symmetry: true })}
              options={[2, 3, 4, 6, 8].map((n) => ({ value: n, label: `${n}回` }))}
            />
            <Toggle label="線対称を加える" hint="オフで点対称（回転）のみ" value={s.mirror} onChange={(mirror) => set({ mirror, symmetry: true })} />
          </div>
        </div>

        <div>
          <SectionTitle>Auto Flow の動き</SectionTitle>
          <Segmented<'energy' | 'chess'>
            value={s.flowStyle}
            onChange={(flowStyle) => set({ flowStyle, flow: true })}
            options={[
              { value: 'energy', label: 'エネルギー' },
              { value: 'chess', label: 'チェス（形の文法）' },
            ]}
          />
          <p className="mt-2 text-[11px] leading-relaxed opacity-60">
            {s.flowStyle === 'chess'
              ? 'ハルトヴィヒのチェス：□は縦横、△は斜め、○は自由に、グリッドを一手ずつ進んで戻る。'
              : '△は鋭く往復、○は円を描き、□は静止と 90° の回転を繰り返す。'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => actions.setView(defaultView)}
          className="flex h-11 w-full items-center justify-center gap-2 border border-ink text-xs tracking-wider"
        >
          <RotateCcw size={15} /> 表示をリセット（ズーム・回転）
        </button>
      </div>
    </Sheet>
  )
}

/** いまの構図で、各ルールがどれだけ満たされていないか（重み付きコスト） */
function Evaluation() {
  const report = useRuntime((r) => r.report)
  if (!report) return <p className="text-[11px] opacity-50">カオスモードでは理論は休んでいます。</p>
  const max = Math.max(1, ...Object.values(report.rules).map((r) => r.weighted))
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-[10px] tracking-[0.14em] uppercase opacity-60">
        <span>いまの構図の評価（短いほど良い）</span>
        <span className="tabular-nums">{report.total.toFixed(2)}</span>
      </div>
      <div className="space-y-1">
        {RULES.map((r) => {
          const v = report.rules[r.id]?.weighted ?? 0
          return (
            <div key={r.id} className="flex items-center gap-2 text-[11px]">
              <span className="w-14 shrink-0">{r.label}</span>
              <span className="relative h-2 flex-1 border border-ink/40">
                <span className="absolute inset-y-0 left-0 bg-ink" style={{ width: `${(v / max) * 100}%` }} />
              </span>
              <span className="w-9 shrink-0 text-right tabular-nums opacity-60">{v.toFixed(2)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeightEditor() {
  const weights = useStore((st) => st.settings.weights)
  const setWeight = (id: RuleId, v: number) => actions.setSettings({ weights: { ...weights, [id]: v } })
  return (
    <details className="group">
      <summary className="cursor-pointer text-[11px] tracking-wide opacity-70 select-none">ルールの重み（詳細）</summary>
      <div className="mt-3 space-y-3">
        {RULES.map((r) => (
          <Slider
            key={r.id}
            label={r.label}
            value={weights[r.id] ?? DEFAULT_WEIGHTS[r.id]}
            min={0}
            max={3}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={(v) => setWeight(r.id, v)}
          />
        ))}
        <button
          type="button"
          className="h-9 w-full border border-ink text-[11px] tracking-wider"
          onClick={() => actions.setSettings({ weights: DEFAULT_WEIGHTS })}
        >
          重みを初期値に戻す
        </button>
      </div>
    </details>
  )
}
