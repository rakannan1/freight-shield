import { useId } from "react";

/** FreightShield mark: a shield protecting a freight truck. */
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
      {/* truck: trailer, cab with slanted windscreen, two wheels */}
      <rect x="8.5" y="12.5" width="14" height="11.5" rx="1.6" fill="#fff" />
      <path d="M24.2 15.5h3.9c.6 0 1.1.3 1.5.8l2.2 3.1c.2.3.3.6.3 1V24h-7.9V15.5Z" fill="#fff" />
      <path d="M26 17.4h2.1l1.7 2.4H26v-2.4Z" fill="#0f766e" />
      <circle cx="14" cy="26.4" r="2.5" fill="#fff" stroke="#0f766e" strokeWidth="1.3" />
      <circle cx="27" cy="26.4" r="2.5" fill="#fff" stroke="#0f766e" strokeWidth="1.3" />
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
