import { useId } from "react";

/** FreightShield mark: a shield with a pulse line through it (a record being watched). */
export function LogoMark({ size = 34 }: { size?: number }) {
  // Unique per instance: a hidden duplicate id would break the gradient on the visible one.
  const gid = `fs-g-${useId().replace(/:/g, "")}`;
  return (
    <svg width={size} height={Math.round(size * 1.1)} viewBox="0 0 40 44" role="img" aria-label="FreightShield" fill="none">
      <defs>
        <linearGradient id={gid} x1="6" y1="2" x2="34" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2dd4bf" />
          <stop offset="1" stopColor="#0b6f7a" />
        </linearGradient>
      </defs>
      <path d="M20 2 36 8v14c0 10-7 17-16 20C11 39 4 32 4 22V8L20 2Z" fill={`url(#${gid})`} />
      <path d="M20 2 36 8v14c0 10-7 17-16 20" stroke="#fff" strokeOpacity=".28" strokeWidth="1.2" />
      <path
        d="M9.5 23H16l3.4-9.5L24 31l3-8h3.5"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ light = false, href = "/" }: { light?: boolean; href?: string }) {
  return (
    <a href={href} className={`mk-logo${light ? " light" : ""}`} aria-label="FreightShield home">
      <LogoMark />
      <span className="mk-wordmark">
        Freight<b>Shield</b>
      </span>
    </a>
  );
}
