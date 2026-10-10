/**
 * 描画側で計算された「いまの画面の評価」を UI に渡すための小さな共有状態。
 * レイアウトを計算するたびに更新される（保存はしない）。
 */
import { useSyncExternalStore } from 'react'
import type { Features } from '../engine/features'
import type { LayoutResult } from '../engine/layout'

export interface RuntimeState {
  report: LayoutResult['report']
  features: Features | null
}

let state: RuntimeState = { report: null, features: null }
const listeners = new Set<() => void>()

export const runtime = {
  get: () => state,
  set(next: RuntimeState) {
    state = next
    listeners.forEach((l) => l())
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

export function useRuntime<T>(sel: (s: RuntimeState) => T): T {
  return useSyncExternalStore(runtime.subscribe, () => sel(state))
}
