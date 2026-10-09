import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // ストア公開後は変更できない ID（確定）
  appId: 'com.lomaloma.bau',
  appName: 'BAU',
  webDir: 'dist',
  backgroundColor: '#f2eee3',
  ios: {
    contentInset: 'never',
  },
  android: {
    backgroundColor: '#f2eee3',
  },
  plugins: {
    SystemBars: {
      // index.html が viewport-fit=cover なので、起動時のレイアウトのずれを防ぐ
      initialViewportFitValueHint: 'cover',
    },
  },
}

export default config
