/**
 * A one-shot confetti burst on a full-screen canvas.
 *
 * Canvas rather than a Lottie file: the equivalent animation ships about 200KB
 * of JSON plus a ~300KB player and draws the same fixed shapes on every device,
 * where this is sixty lines, downloads nothing, and scales to the screen. It also
 * lets the podium and non-podium bursts be provably identical, because they are
 * one function called with one set of numbers.
 */

import { useEffect, useRef } from 'react'

/** Brand purple, the medal gold, the icon pink, court teal, success green, white. */
const COLORS = ['#FFB200', '#6F3E87', '#A84767', '#4FD1C5', '#22C55E', '#FFFFFF', '#C9A6DC']

interface Particle {
  x: number; y: number; vx: number; vy: number
  w: number; h: number; rot: number; spin: number
  color: string; life: number; decay: number
}

export function ConfettiBurst({ pieces = 120 }: { pieces?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    // Capped at 2: beyond that the extra pixels cost more than they show.
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const parts: Particle[] = []
    for (let i = 0; i < pieces; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 3 + Math.random() * 9
      parts.push({
        x: rect.width / 2,
        y: rect.height / 2 - 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        w: 5 + Math.random() * 6,
        h: 8 + Math.random() * 7,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.28,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        life: 1,
        decay: 0.006 + Math.random() * 0.006,
      })
    }

    let raf = 0
    let alive = true

    const tick = () => {
      if (!alive) return
      ctx.clearRect(0, 0, rect.width, rect.height)

      for (const p of parts) {
        p.vy += 0.24          // gravity
        p.vx *= 0.99          // drag
        p.x += p.vx
        p.y += p.vy
        p.rot += p.spin
        p.life -= p.decay

        ctx.save()
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life))
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }

      // Every particle exists from frame one here, so an emptied array really
      // does mean finished. A version that emitted over time would have to stay
      // alive across the gaps between emissions instead.
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i].life <= 0 || parts[i].y > rect.height + 40) parts.splice(i, 1)
      }

      if (parts.length > 0) raf = requestAnimationFrame(tick)
      else ctx.clearRect(0, 0, rect.width, rect.height)
    }

    raf = requestAnimationFrame(tick)
    return () => { alive = false; cancelAnimationFrame(raf) }
  }, [pieces])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60] h-full w-full"
    />
  )
}

export default ConfettiBurst
