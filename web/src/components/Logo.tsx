interface LogoProps {
  /** Mark size in px. */
  size?: number;
  /** Wordmark font size class. Omit the word with showWord={false}. */
  showWord?: boolean;
  className?: string;
}

/** Docent logo: a ring-with-arc mark (echoing the understanding ring) + wordmark. */
export function Logo({ size = 26, showWord = true, className }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
        <circle cx="16" cy="16" r="13" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
        <path
          d="M16 3 a13 13 0 0 1 11.3 19.5"
          fill="none"
          stroke="hsl(var(--foreground))"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="16" cy="16" r="4" fill="hsl(var(--foreground))" />
      </svg>
      {showWord && <span className="text-[19px] font-medium tracking-tight">Docent</span>}
    </div>
  );
}
