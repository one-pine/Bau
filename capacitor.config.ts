import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // ストア公開後は変更できない ID（確定）
  appId: 'com.onepine.bau',
  appName: 'BAU',
  webDir: 'dist',
  backgroundColor: '#f2eee3',
  ios: {
    contentInset: 'never',
  },
  android: {
    backgroundColor: '#f2eee3',
  },
}

export default config
