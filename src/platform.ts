/**
 * ブラウザ（PWA）とネイティブアプリ（Capacitor: iOS / Android）の差を吸収する。
 * ネイティブの WebView では <a download> が効かないため、書き出しは共有シートを使う。
 */
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Share } from '@capacitor/share'

export const isNative = Capacitor.isNativePlatform()

function download(href: string, filename: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** 画像などのバイナリを保存する。ネイティブでは共有シートから「画像を保存」やほかのアプリへ送れる。 */
export async function saveBlob(blob: Blob, filename: string) {
  if (!isNative) {
    const url = URL.createObjectURL(blob)
    download(url, filename)
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    return
  }
  const data = await blobToBase64(blob)
  const { uri } = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache })
  await Share.share({ title: filename, files: [uri] })
}

export async function saveText(text: string, filename: string, mime: string) {
  if (!isNative) return saveBlob(new Blob([text], { type: mime }), filename)
  const { uri } = await Filesystem.writeFile({ path: filename, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 })
  await Share.share({ title: filename, files: [uri] })
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

export function haptic(strength: 'light' | 'medium' = 'light') {
  if (isNative) {
    void Haptics.impact({ style: strength === 'light' ? ImpactStyle.Light : ImpactStyle.Medium }).catch(() => {})
  } else {
    navigator.vibrate?.(strength === 'light' ? 8 : 14)
  }
}
