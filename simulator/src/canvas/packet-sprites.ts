import { PACKET_GLOW_PX, PACKET_RADIUS, type PacketColor } from '../simulation/packets'

const SPRITE_RESOLUTION = 6
const RESPONSE_RING_WIDTH_PX = 1.2
const RESPONSE_RADIUS_SCALE = 0.7
const RESPONSE_GLOW_SCALE = 0.5
const RESPONSE_STROKE_ALPHA = 0.75
const RESPONSE_TOKEN: Record<PacketColor, string> = {
  default: '--color-status-healthy',
  write: '--color-status-healthy',
  blocked: '--color-status-error',
}

const COLOR_TOKEN: Record<PacketColor, string> = {
  default: '--color-border-interaction',
  write: '--color-status-warning',
  blocked: '--color-status-error',
}

const GLOW_ALPHA: Record<PacketColor, number> = {
  default: 0.45,
  write: 0.45,
  blocked: 0.5,
}

export const SPRITE_SIZE_PX = (PACKET_RADIUS + PACKET_GLOW_PX) * 2

export type PacketShape = 'request' | 'response'

export interface PacketSprites {
  request: Record<PacketColor, HTMLCanvasElement>
  response: Record<PacketColor, HTMLCanvasElement>
}

function readToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function toRgb(color: string): [number, number, number] {
  const hex = color.replace('#', '')
  const full = hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex
  const value = Number.parseInt(full, 16)

  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function drawSprite(token: string, requestGlowAlpha: number, shape: PacketShape): HTMLCanvasElement {
  const glowAlpha = shape === 'response' ? requestGlowAlpha * RESPONSE_GLOW_SCALE : requestGlowAlpha
  const size = SPRITE_SIZE_PX * SPRITE_RESOLUTION
  const sprite = document.createElement('canvas')
  sprite.width = size
  sprite.height = size

  const context = sprite.getContext('2d')
  if (!context) return sprite

  const [red, green, blue] = toRgb(readToken(token) || '#3b82f6')
  const centre = size / 2
  const core = PACKET_RADIUS * SPRITE_RESOLUTION
  const solid = `rgb(${red}, ${green}, ${blue})`

  const glow = context.createRadialGradient(centre, centre, core * 0.6, centre, centre, centre)
  glow.addColorStop(0, `rgba(${red}, ${green}, ${blue}, ${glowAlpha})`)
  glow.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 0)`)

  context.fillStyle = glow
  context.fillRect(0, 0, size, size)

  if (shape === 'request') {
    context.beginPath()
    context.arc(centre, centre, core, 0, Math.PI * 2)
    context.fillStyle = solid
    context.fill()

    return sprite
  }

  const ringWidth = RESPONSE_RING_WIDTH_PX * SPRITE_RESOLUTION

  context.beginPath()
  context.arc(centre, centre, core * RESPONSE_RADIUS_SCALE - ringWidth / 2, 0, Math.PI * 2)
  context.lineWidth = ringWidth
  context.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${RESPONSE_STROKE_ALPHA})`
  context.stroke()

  return sprite
}

export function buildPacketSprites(): PacketSprites {
  return {
    request: {
      default: drawSprite(COLOR_TOKEN.default, GLOW_ALPHA.default, 'request'),
      write: drawSprite(COLOR_TOKEN.write, GLOW_ALPHA.write, 'request'),
      blocked: drawSprite(COLOR_TOKEN.blocked, GLOW_ALPHA.blocked, 'request'),
    },
    response: {
      default: drawSprite(RESPONSE_TOKEN.default, 0.5, 'response'),
      write: drawSprite(RESPONSE_TOKEN.write, 0.5, 'response'),
      blocked: drawSprite(RESPONSE_TOKEN.blocked, 0.5, 'response'),
    },
  }
}
