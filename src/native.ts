/**
 * ネイティブアプリ（Capacitor）固有の振る舞い。Web では復帰の記録だけ行う。
 */
import { App } from '@capacitor/app'
import { SystemBars, SystemBarsStyle } from '@capacitor/core'
import { isDark } from './engine/export'
import { isNative } from './platform'
import { recordActivity } from './state/activity'
import { actions, store } from './state/store'

export function initNative() {
  // アプリに戻ってきたことを記録する（指揮者が「新しい師匠で迎える」ために使う）
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') recordActivity('resume')
  })
  if (!isNative) return

  // Android の戻るボタン: 開いているパネル → 選択 → アプリを背面へ、の順に閉じる
  void App.addListener('backButton', () => {
    const st = store.get()
    if (st.editorOpen) actions.closeEditor()
    else if (st.settingsOpen) actions.toggleSettings()
    else if (st.selectedId) actions.select(null)
    else void App.minimizeApp()
  })

  // 背景色に合わせてステータスバーの文字色を切り替える
  let lastBg = ''
  const syncBars = () => {
    const bg = store.get().settings.background
    if (bg === lastBg) return
    lastBg = bg
    void SystemBars.setStyle({ style: isDark(bg) ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {})
  }
  syncBars()
  store.subscribe(syncBars)
}
