import type { TransitionState } from './types'

// ── fluid-smoke state ────────────────────────────────────────────────────────

interface Particle {
  x: number
  y: number
  char: string
  age: number
  opacity: number
}

interface FluidSmokeState {
  particles: Particle[]
  vx: Float32Array  // 64×64
  vy: Float32Array  // 64×64
  initialized: boolean
}

const GRID = 64
const FLUID_PARTICLES = 500

const fluidState: FluidSmokeState = {
  particles: [],
  vx: new Float32Array(GRID * GRID),
  vy: new Float32Array(GRID * GRID),
  initialized: false,
}

function getChars(visualPrompt: string): string[] {
  const words = visualPrompt.trim().split(/\s+/)
  const chars: string[] = []
  for (const w of words) {
    for (const c of w) chars.push(c)
  }
  return chars.length > 0 ? chars : ['·']
}

function resetParticle(p: Particle, canvas: HTMLCanvasElement, chars: string[]): void {
  const edge = Math.floor(Math.random() * 4)
  switch (edge) {
    case 0: p.x = Math.random() * canvas.width;  p.y = 0; break
    case 1: p.x = Math.random() * canvas.width;  p.y = canvas.height; break
    case 2: p.x = 0;             p.y = Math.random() * canvas.height; break
    default: p.x = canvas.width; p.y = Math.random() * canvas.height; break
  }
  p.char = chars[Math.floor(Math.random() * chars.length)]
  p.age = 0
  p.opacity = 0.3 + Math.random() * 0.7
}

function initFluid(canvas: HTMLCanvasElement, chars: string[]): void {
  fluidState.particles = []
  for (let i = 0; i < FLUID_PARTICLES; i++) {
    const p: Particle = { x: 0, y: 0, char: '', age: 0, opacity: 1 }
    // scatter randomly across canvas for initial placement
    p.x = Math.random() * canvas.width
    p.y = Math.random() * canvas.height
    p.char = chars[Math.floor(Math.random() * chars.length)]
    p.age = Math.random()
    p.opacity = 0.3 + Math.random() * 0.7
    fluidState.particles.push(p)
  }
  fluidState.initialized = true
}

function updateVelocityGrid(t: number): void {
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const idx = row * GRID + col
      fluidState.vx[idx] = Math.sin(row * 0.3 + t * 0.5)
      fluidState.vy[idx] = Math.cos(col * 0.3 + t * 0.5)
    }
  }
}

function sampleVelocity(
  px: number, py: number,
  canvasW: number, canvasH: number
): [number, number] {
  const gx = (px / canvasW) * (GRID - 1)
  const gy = (py / canvasH) * (GRID - 1)
  const x0 = Math.floor(gx), y0 = Math.floor(gy)
  const x1 = Math.min(x0 + 1, GRID - 1), y1 = Math.min(y0 + 1, GRID - 1)
  const fx = gx - x0, fy = gy - y0

  const i00 = y0 * GRID + x0, i10 = y0 * GRID + x1
  const i01 = y1 * GRID + x0, i11 = y1 * GRID + x1

  const vxVal = fluidState.vx[i00] * (1 - fx) * (1 - fy)
             + fluidState.vx[i10] * fx * (1 - fy)
             + fluidState.vx[i01] * (1 - fx) * fy
             + fluidState.vx[i11] * fx * fy

  const vyVal = fluidState.vy[i00] * (1 - fx) * (1 - fy)
             + fluidState.vy[i10] * fx * (1 - fy)
             + fluidState.vy[i01] * (1 - fx) * fy
             + fluidState.vy[i11] * fx * fy

  return [vxVal, vyVal]
}

function renderFluidSmoke(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  state: TransitionState
): void {
  const chars = getChars(state.visualPrompt)
  const t = state.progress * state.duration * 0.001

  if (!fluidState.initialized || state.progress < 0.05) {
    initFluid(canvas, chars)
  }

  updateVelocityGrid(t)

  // Motion blur trail
  ctx.fillStyle = 'rgba(14,13,11,0.06)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.font = '10px "JetBrains Mono", monospace'
  ctx.textBaseline = 'top'

  for (const p of fluidState.particles) {
    const [vxVal, vyVal] = sampleVelocity(p.x, p.y, canvas.width, canvas.height)
    p.x += vxVal * 1.5
    p.y += vyVal * 1.5
    p.age += 0.004

    const offscreen = p.x < -10 || p.x > canvas.width + 10
                   || p.y < -10 || p.y > canvas.height + 10
    if (offscreen || p.age > 1) {
      resetParticle(p, canvas, chars)
      continue
    }

    ctx.fillStyle = `rgba(232,224,208,${p.opacity.toFixed(3)})`
    ctx.fillText(p.char, p.x, p.y)
  }
}

// ── typographic-ascii state ──────────────────────────────────────────────────

interface AsciiState {
  t: number
  initialized: boolean
}

const asciiState: AsciiState = { t: 0, initialized: false }

const DENSITY = ' ·.:;+*#@█'
const ASCII_COLS = 80
const ASCII_ROWS = 40

function renderTypographicAscii(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  state: TransitionState
): void {
  if (!asciiState.initialized || state.progress < 0.05) {
    asciiState.t = 0
    asciiState.initialized = true
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const cellW = canvas.width / ASCII_COLS
  const cellH = canvas.height / ASCII_ROWS
  const t = asciiState.t

  ctx.font = '8px "JetBrains Mono", monospace'
  ctx.textBaseline = 'top'

  for (let row = 0; row < ASCII_ROWS; row++) {
    for (let col = 0; col < ASCII_COLS; col++) {
      const brightness = (Math.sin(col * 0.15 + t * 0.03) + Math.cos(row * 0.2 + t * 0.02) + 2) / 4
      const charIdx = Math.min(Math.floor(brightness * DENSITY.length), DENSITY.length - 1)
      const ch = DENSITY[charIdx]
      ctx.fillStyle = `rgba(200,146,42,${brightness.toFixed(3)})`
      ctx.fillText(ch, col * cellW, row * cellH)
    }
  }

  asciiState.t += 0.5
}

// ── particle-drift state ─────────────────────────────────────────────────────

interface DriftState {
  particles: Particle[]
  initialized: boolean
}

const DRIFT_PARTICLES = 200

const driftState: DriftState = { particles: [], initialized: false }

function resetDriftParticle(p: Particle, canvas: HTMLCanvasElement, chars: string[]): void {
  p.x = Math.random() * canvas.width
  p.y = canvas.height + 5
  p.char = chars[Math.floor(Math.random() * chars.length)]
  p.age = 0
  p.opacity = 0.3 + Math.random() * 0.7
}

function initDrift(canvas: HTMLCanvasElement, chars: string[]): void {
  driftState.particles = []
  for (let i = 0; i < DRIFT_PARTICLES; i++) {
    const p: Particle = {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      char: chars[Math.floor(Math.random() * chars.length)],
      age: Math.random(),
      opacity: 0.3 + Math.random() * 0.7,
    }
    driftState.particles.push(p)
  }
  driftState.initialized = true
}

function renderParticleDrift(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  state: TransitionState
): void {
  const chars = getChars(state.visualPrompt)
  const t = state.progress * state.duration * 0.001

  if (!driftState.initialized || state.progress < 0.05) {
    initDrift(canvas, chars)
  }

  // Motion blur trail
  ctx.fillStyle = 'rgba(14,13,11,0.06)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.font = '10px "JetBrains Mono", monospace'
  ctx.textBaseline = 'top'

  for (const p of driftState.particles) {
    // Drift upward with horizontal oscillation
    p.y -= 0.8
    p.x += Math.sin(p.age * Math.PI * 4 + t) * 0.5
    p.age += 0.003

    if (p.y < -10 || p.age > 1) {
      resetDriftParticle(p, canvas, chars)
      continue
    }

    ctx.fillStyle = `rgba(232,224,208,${p.opacity.toFixed(3)})`
    ctx.fillText(p.char, p.x, p.y)
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function renderTransition(
  canvas: HTMLCanvasElement,
  state: TransitionState
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  switch (state.style) {
    case 'fluid-smoke':
      renderFluidSmoke(canvas, ctx, state)
      break
    case 'typographic-ascii':
      renderTypographicAscii(canvas, ctx, state)
      break
    case 'particle-drift':
    default:
      renderParticleDrift(canvas, ctx, state)
      break
  }
}
