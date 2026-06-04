import { useEffect, useRef } from "react";

interface VoiceOrbProps {
  /** Returns current audio loudness 0..1 (mic + assistant). */
  getLevel: () => number;
  /** Whether a session is live (orb animates) vs idle. */
  active: boolean;
  /** Whether the tutor is currently speaking (subtle emphasis). */
  speaking: boolean;
  size?: number;
}

/**
 * Black & white audio-reactive orb. Unlike predint's timer-driven shader orb,
 * this one is driven by real audio amplitude (getLevel) — it moves on voice.
 * An organic blob whose radius, edge wobble, and glow scale with loudness.
 */
export function VoiceOrb({ getLevel, active, speaking, size = 280 }: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const levelRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let raf = 0;
    let t = 0;
    const cx = size / 2;
    const cy = size / 2;
    const baseR = size * 0.26;

    // Read the CSS foreground color so the orb respects the B&W theme (light/dark).
    const fg = getComputedStyle(canvas).getPropertyValue("color") || "rgb(10,10,10)";

    const draw = () => {
      t += 0.016;
      const target = active ? getLevel() : 0;
      // smooth toward target so the orb eases rather than jitters
      levelRef.current += (target - levelRef.current) * 0.18;
      const level = levelRef.current;

      ctx.clearRect(0, 0, size, size);

      const idle = active ? 0.04 + Math.sin(t * 1.6) * 0.02 : 0;
      const amp = baseR * (0.18 + level * 0.9 + idle);
      const r = baseR + amp;

      // outer glow
      const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.9);
      glow.addColorStop(0, withAlpha(fg, 0.18 + level * 0.3));
      glow.addColorStop(1, withAlpha(fg, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.9, 0, Math.PI * 2);
      ctx.fill();

      // organic blob edge
      ctx.beginPath();
      const points = 96;
      const wobble = (0.06 + level * 0.22) * baseR;
      const speed = speaking ? 2.4 : 1.4;
      for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2;
        const n =
          Math.sin(a * 3 + t * speed) * 0.5 +
          Math.sin(a * 5 - t * speed * 0.8) * 0.3 +
          Math.sin(a * 2 + t * 0.6) * 0.2;
        const rr = r + n * wobble;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      const fill = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r * 1.2);
      fill.addColorStop(0, withAlpha(fg, 0.95));
      fill.addColorStop(0.7, withAlpha(fg, 0.82));
      fill.addColorStop(1, withAlpha(fg, 0.6));
      ctx.fillStyle = fill;
      ctx.fill();

      // inner highlight
      const hl = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 1, cx - r * 0.35, cy - r * 0.4, r);
      hl.addColorStop(0, "rgba(255,255,255,0.55)");
      hl.addColorStop(0.5, "rgba(255,255,255,0.0)");
      ctx.fillStyle = hl;
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [getLevel, active, speaking, size]);

  return <canvas ref={canvasRef} style={{ width: size, height: size }} aria-hidden="true" />;
}

function withAlpha(color: string, alpha: number): string {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b] = m[1]!.split(",").map((v) => parseFloat(v));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(10,10,10,${alpha})`;
}
