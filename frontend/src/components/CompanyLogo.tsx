import type { CSSProperties } from "react";

interface CompanyLogoProps {
  height?: number | string;
  className?: string;
  showBadge?: boolean;
  style?: CSSProperties;
  badgeStyle?: CSSProperties;
  title?: string;
}

export function CompanyLogo({
  height = 36,
  className = "",
  showBadge = true,
  style,
  badgeStyle,
  title = "Mofarreh Group — Engineering & Construction",
}: CompanyLogoProps) {
  const h = typeof height === "number" ? `${height}px` : height;

  const images = (
    <>
      <img
        src="/mofarreh-logo-light.png"
        alt="Mofarreh Group Logo"
        className={`company-logo-img logo-light-only ${className}`}
        style={{ height: h, width: "auto", objectFit: "contain", ...style }}
      />
      <img
        src="/mofarreh-logo-dark.png"
        alt="Mofarreh Group Logo"
        className={`company-logo-img logo-dark-only ${className}`}
        style={{ height: h, width: "auto", objectFit: "contain", ...style }}
      />
    </>
  );

  if (!showBadge) {
    return (
      <div className="company-logo-wrap" style={{ display: "inline-flex", alignItems: "center" }}>
        {images}
      </div>
    );
  }

  return (
    <div className="company-logo-badge" title={title} style={badgeStyle}>
      {images}
    </div>
  );
}
