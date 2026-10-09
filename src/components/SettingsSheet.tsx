import { RotateCcw } from 'lucide-react'
import { BACKGROUNDS } from '../engine/bauhaus'
import type { GridMode } from '../engine/types'
import { actions, defaultView, useStore } from '../state/store'
import Sheet from './Sheet'
import { SectionTitle, Segmented, Toggle } from './ui'

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
          <Toggle label="グリッドと重心を表示" hint="＋ は視覚的重みの重心、○ は画面中心" value={s.showGrid} onChange={(showGrid) => set({ showGrid })} />
        </div>

        <div>
          <SectionTitle>カンディンスキー 対応論</SectionTitle>
          <Toggle
            label="形態 ⇄ 色彩の連動"
            hint="△＝黄、□＝赤、○＝青。手動で色を選んだ図形はその色を保ちます"
            value={s.correspondence}
            onChange={(correspondence) => set({ correspondence })}
          />
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
