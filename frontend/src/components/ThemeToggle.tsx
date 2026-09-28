import type { CSSProperties } from "react";
import { useTheme } from "../hooks/useTheme";
import { Icon } from "./Icon";

interface ThemeToggleProps {
  className?: string;
  style?: CSSProperties;
  showLabel?: boolean;
}

export function ThemeToggle({ className = "", style, showLabel = true }: ThemeToggleProps) {
  const [theme, toggleTheme] = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className={`theme-toggle-btn ${className}`}
      onClick={toggleTheme}
      style={style}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      <Icon name={isDark ? "sun" : "moon"} size={15} />
      {showLabel && <span className="theme-toggle-label">{isDark ? "Light" : "Dark"}</span>}
    </button>
  );
}
