import type { CSSProperties } from "react";
import { useTheme } from "../hooks/useTheme";

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
  const [theme] = useTheme();
  const isDark = theme === "dark";
  const h = typeof height === "number" ? `${height}px` : height;

  // Use the original authentic logo for light mode, and dark mode logo for dark mode
  const logoSrc = isDark ? "/mofarreh-logo-dark.png" : "/mofarreh-logo.png";

  const image = (
    <img
      src={logoSrc}
      alt="Mofarreh Group Logo"
      className={`company-logo-img ${className}`}
      style={{ height: h, width: "auto", objectFit: "contain", display: "block", ...style }}
    />
  );

  if (!showBadge) {
    return (
      <div className="company-logo-wrap" style={{ display: "inline-flex", alignItems: "center" }}>
        {image}
      </div>
    );
  }

  return (
    <div className="company-logo-badge" title={title} style={badgeStyle}>
      {image}
    </div>
  );
}
