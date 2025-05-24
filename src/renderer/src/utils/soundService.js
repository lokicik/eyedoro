class SoundService {
  constructor() {
    this.audioContext = null
    this.enabled = true
    this.init()
  }

  async init() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    } catch (error) {
      console.warn('Web Audio API not supported:', error)
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled
  }

  async playBeep(frequency = 800, duration = 200, volume = 0.3) {
    if (!this.enabled || !this.audioContext) return

    try {
      // Resume audio context if it's suspended (required by some browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)

      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime)
      oscillator.type = 'sine'

      // Create a nice envelope for the sound
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime)
      gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        this.audioContext.currentTime + duration / 1000
      )

      oscillator.start(this.audioContext.currentTime)
      oscillator.stop(this.audioContext.currentTime + duration / 1000)
    } catch (error) {
      console.warn('Error playing beep:', error)
    }
  }

  async playNotificationSound() {
    // Play a pleasant notification sound
    await this.playBeep(600, 150, 0.2)
    setTimeout(() => this.playBeep(800, 150, 0.2), 200)
  }

  async playWarningSound() {
    // Play a more urgent warning sound
    await this.playBeep(400, 100, 0.3)
    setTimeout(() => this.playBeep(600, 100, 0.3), 150)
    setTimeout(() => this.playBeep(800, 100, 0.3), 300)
  }

  async playSuccessSound() {
    // Play a success completion sound
    await this.playBeep(523, 100, 0.2) // C5
    setTimeout(() => this.playBeep(659, 100, 0.2), 120) // E5
    setTimeout(() => this.playBeep(784, 200, 0.2), 240) // G5
  }

  async playTickSound() {
    // Subtle tick sound for countdown
    await this.playBeep(1000, 50, 0.1)
  }
}

export const soundService = new SoundService()
