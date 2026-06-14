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
 * The voice orb: a cloth-textured sphere (the grayscale silk image from the
 * shared asset) that breathes and swells with real audio amplitude. The image
 * gives the surface; a radial shading overlay makes it read as a lit 3D sphere;
 * a soft halo pulses behind it. Driven by getLevel() + a speaking envelope so it
 * springs on each phrase and settles to a gentle idle when listening.
 */
export function VoiceOrb({ getLevel, active, speaking, size = 240 }: VoiceOrbProps) {
  const sphereRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const levelRef = useRef(0);
  const envRef = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let t = 0;

    const tick = () => {
      t += 0.016;
      const target = active ? Math.max(0, Math.min(1, getLevel())) : 0;
      // Fast attack, slow release so each phrase visibly springs the surface.
      const k = target > levelRef.current ? 0.22 : 0.07;
      levelRef.current += (target - levelRef.current) * k;
      const speakTarget = speaking ? 1 : 0;
      envRef.current += (speakTarget - envRef.current) * (speakTarget > envRef.current ? 0.18 : 0.05);

      const level = levelRef.current;
      const env = envRef.current;
      const idle = active ? Math.sin(t * 1.4) * 0.012 : 0;
      const drive = Math.max(level, env * 0.5);
      const scale = 1 + idle + drive * 0.12;

      if (sphereRef.current) {
        sphereRef.current.style.transform = `scale(${scale.toFixed(3)})`;
      }
      if (haloRef.current) {
        haloRef.current.style.opacity = (0.35 + drive * 0.5).toFixed(3);
        haloRef.current.style.transform = `scale(${(1 + drive * 0.18).toFixed(3)})`;
      }
      raf = requestAnimationFrame(tick);
    };

    if (!reduce) raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getLevel, active, speaking]);

  const sphere = Math.round(size * 0.82);
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div
        ref={haloRef}
        className="pointer-events-none absolute rounded-full"
        style={{
          width: size,
          height: size,
          opacity: 0.35,
          background:
            "radial-gradient(circle, rgba(120,128,140,0.22), rgba(120,128,140,0.06) 55%, rgba(0,0,0,0) 72%)",
        }}
      />
      <div
        ref={sphereRef}
        className="relative overflow-hidden rounded-full"
        style={{ width: sphere, height: sphere, willChange: "transform" }}
      >
        <img
          src="/orb-cloth.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: "grayscale(1)" }}
          draggable={false}
        />
        {/* Spherical shading: lit upper-left highlight, darkened rim. */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 35% 28%, rgba(255,255,255,0.5), rgba(255,255,255,0) 44%, rgba(0,0,0,0.42) 100%)",
          }}
        />
      </div>
    </div>
  );
}
