import type { CSSProperties } from "react";

// Inline SVG icon set. 24-grid, 1.75 stroke, currentColor — no icon library
// dependency for ~25 glyphs. Size follows font-size (1em) so an icon sits
// correctly in any button, badge, or heading.
const PATHS: Record<string, string> = {
  check: "M20 6 9 17l-5-5",
  x: "M18 6 6 18M6 6l12 12",
  "alert-triangle":
    "m10.29 3.86-8.6 14.86A1.5 1.5 0 0 0 3 21h18a1.5 1.5 0 0 0 1.3-2.28L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01",
  ban: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.6 5.6l12.8 12.8",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v5l3 2",
  calendar: "M4 6h16v14H4zM8 3v4m8-4v4M4 10h16",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  users: "M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm13 17v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75",
  user: "M19 20v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  "file-text": "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8m-8 4h8",
  clipboard: "M9 3h6v3H9zM8 5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V18a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H4a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H10a1.6 1.6 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V10a1.6 1.6 0 0 0 1.5 1H20a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z",
  download: "M12 3v12m-5-5 5 5 5-5M4 21h16",
  repeat: "M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4m14-3v2a4 4 0 0 1-4 4H3",
  "rotate-ccw": "M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5",
  video: "M15 8l6-3v14l-6-3zM3 6h12v12H3z",
  camera: "M4 8h3l2-3h6l2 3h3v12H4zm8 3a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z",
  mail: "M4 5h16v14H4zm0 2 8 6 8-6",
  unlock: "M7 11V7a5 5 0 0 1 9.9-1M5 11h14v10H5z",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0-6v2m0 16v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M2 12h2m16 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z",
};

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  size?: number | string;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
  /** Set when the icon carries meaning on its own (no adjacent text). */
  label?: string;
}

export function Icon({ name, size = "1em", strokeWidth = 1.75, className, style, label }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      style={{ display: "inline-block", verticalAlign: "-0.15em", flexShrink: 0, ...style }}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
