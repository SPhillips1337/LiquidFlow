import type { InlineEntity, TransitionState, BookScene } from './types'

// Mood → movement parameters
const MOOD_PARAMS: Record<string, { speedMin: number; speedMax: number; path: string; amplitude: number }> = {
  melancholic: { speedMin: 0.4, speedMax: 0.8, path: 'sine',    amplitude: 20 },
  wonder:      { speedMin: 0.6, speedMax: 1.0, path: 'arc',     amplitude: 40 },
  tense:       { speedMin: 1.5, speedMax: 2.5, path: 'zigzag',  amplitude: 10 },
  ominous:     { speedMin: 0.3, speedMax: 0.6, path: 'drift',   amplitude: 30 },
  joyful:      { speedMin: 1.2, speedMax: 1.8, path: 'bounce',  amplitude: 35 },
  neutral:     { speedMin: 0.8, speedMax: 1.2, path: 'drift',   amplitude: 15 },
}

const DEFAULT_PARAMS = MOOD_PARAMS['neutral']

// Module-level time counter incremented in tick()
let t = 0

export class AnimationDriver {
  private entities: InlineEntity[] = []
  private transition: TransitionState | null = null
  private canvasW = 800
  private canvasH = 600
  private lastChapterIndex = -1

  setCanvasSize(w: number, h: number): void {
    this.canvasW = w
    this.canvasH = h
  }

  spawnEntities(scene: BookScene, lineHeight: number): void {
    this.entities = []

    const hints = scene.animationHints
    const entityNames: string[] = (hints?.entities?.length ? hints.entities : scene.entities) ?? []
    const mood = hints?.mood ?? scene.mood ?? 'neutral'
    const params = MOOD_PARAMS[mood] ?? DEFAULT_PARAMS
    const fontSize = lineHeight / 1.6

    const count = Math.min(3, entityNames.length)
    for (let i = 0; i < count; i++) {
      const name = entityNames[i]
      const speed = params.speedMin + Math.random() * (params.speedMax - params.speedMin)
      const vx = (Math.random() * 2 - 1) * 0.3 * speed
      const vy = speed

      this.entities.push({
        id: `entity-${i}-${name}`,
        name,
        x: Math.random() * this.canvasW,
        y: -lineHeight,
        vx,
        vy,
        width: name.length * fontSize * 0.6,
        height: lineHeight,
        phase: Math.random() * Math.PI * 2,
        mood,
      })
    }
  }

  tick(dt: number): boolean {
    if (this.entities.length === 0) return false

    t += dt

    const before = this.entities.length
    const surviving: InlineEntity[] = []

    for (const e of this.entities) {
      const params = MOOD_PARAMS[e.mood] ?? DEFAULT_PARAMS
      const { path, amplitude } = params

      // Apply path-specific lateral movement
      if (path === 'sine' || path === 'bounce') {
        e.x += Math.sin(e.phase + t * 0.02) * amplitude * dt * 0.06
      } else if (path === 'zigzag') {
        e.x += (Math.sin(e.phase + t * 0.05) > 0 ? 1 : -1) * amplitude * dt * 0.06
      } else {
        // arc / drift
        e.x += Math.sin(e.phase + t * 0.01) * amplitude * dt * 0.04
      }

      // Advance phase
      e.phase += 0.02 * dt

      // Move downward
      e.y += e.vy * dt

      // Bounce off left/right edges
      if (e.x < 0) {
        e.x = 0
        e.vx = Math.abs(e.vx)
      } else if (e.x + e.width > this.canvasW) {
        e.x = this.canvasW - e.width
        e.vx = -Math.abs(e.vx)
      }

      // Keep entity if still on screen
      if (e.y <= this.canvasH + e.height) {
        surviving.push(e)
      }
    }

    this.entities = surviving
    return surviving.length > 0 || surviving.length !== before
  }

  getEntityObstacles(): Array<{ x: number; y: number; w: number; h: number }> {
    return this.entities.map(e => ({ x: e.x, y: e.y, w: e.width, h: e.height }))
  }

  getEntities(): InlineEntity[] {
    return this.entities
  }

  triggerTransition(scene: BookScene, chapterIndex: number, _sceneIndex: number): void {
    if (chapterIndex <= this.lastChapterIndex) return

    this.lastChapterIndex = chapterIndex

    const hints = scene.animationHints
    const style = hints?.transitionStyle ?? 'particle-drift'
    const visualPrompt = hints?.visualPrompt ?? scene.visualPrompt ?? ''
    const duration = 2000 + Math.random() * 3000

    this.transition = {
      style,
      visualPrompt,
      progress: 0,
      duration,
      startTime: performance.now(),
    }
  }

  updateTransition(): TransitionState | null {
    if (!this.transition) return null

    const progress = (performance.now() - this.transition.startTime) / this.transition.duration
    if (progress >= 1) {
      this.transition = null
      return null
    }

    this.transition.progress = progress
    return this.transition
  }

  clearEntities(): void {
    this.entities = []
  }

  isTransitioning(): boolean {
    return this.transition !== null
  }
}
