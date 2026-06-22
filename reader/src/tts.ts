import type { TtsPlaybackState, TtsSettings, TtsVoiceOption } from './types'

export class TtsController {
  private state: TtsPlaybackState = 'idle'
  private onStateChange: (state: TtsPlaybackState) => void

  constructor(onStateChange: (state: TtsPlaybackState) => void) {
    this.onStateChange = onStateChange
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
  }

  getVoices(): TtsVoiceOption[] {
    if (!this.isSupported()) return []
    return window.speechSynthesis.getVoices()
      .map(voice => ({
        voiceURI: voice.voiceURI,
        name: voice.name,
        lang: voice.lang,
        localService: voice.localService,
        isDefault: voice.default
      }))
      .sort((a, b) => this.voiceRank(a) - this.voiceRank(b) || a.name.localeCompare(b.name))
  }

  onVoicesChanged(callback: () => void): () => void {
    if (!this.isSupported()) return () => {}
    window.speechSynthesis.addEventListener('voiceschanged', callback)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', callback)
  }

  speak(text: string, settings: TtsSettings): void {
    if (!this.isSupported()) return
    const trimmed = text.trim()
    if (!trimmed) return

    const synth = window.speechSynthesis
    synth.cancel()

    const utterance = new SpeechSynthesisUtterance(trimmed)
    const voice = synth.getVoices().find(v => v.voiceURI === settings.voiceURI)
    if (voice) utterance.voice = voice
    utterance.rate = settings.rate
    utterance.pitch = settings.pitch
    utterance.onstart = () => this.setState('speaking')
    utterance.onend = () => this.setState('idle')
    utterance.onerror = () => this.setState('idle')

    synth.speak(utterance)
  }

  togglePause(): void {
    if (!this.isSupported()) return
    const synth = window.speechSynthesis
    if (synth.speaking && !synth.paused) {
      synth.pause()
      this.setState('paused')
    } else if (synth.paused) {
      synth.resume()
      this.setState('speaking')
    }
  }

  stop(): void {
    if (!this.isSupported()) return
    window.speechSynthesis.cancel()
    this.setState('idle')
  }

  private voiceRank(voice: TtsVoiceOption): number {
    const name = voice.name.toLowerCase()
    if (name.includes('microsoft') && name.includes('natural')) return 0
    if (name.includes('natural')) return 1
    if (voice.isDefault) return 2
    if (voice.localService) return 3
    return 4
  }

  private setState(next: TtsPlaybackState): void {
    this.state = next
    this.onStateChange(this.state)
  }
}
