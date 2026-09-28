import { useState, useEffect, useCallback } from "react";

export type Theme = "light" | "dark";

const listeners = new Set<(theme: Theme) => void>();

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem("app_theme") as Theme | null;
    if (saved === "light" || saved === "dark") return saved;
    const oldAdmin = localStorage.getItem("exam_admin_theme") as Theme | null;
    if (oldAdmin === "light" || oldAdmin === "dark") return oldAdmin;
    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
  } catch {
    /* ignore */
  }
  return "light";
}

let currentTheme: Theme = getInitialTheme();

function applyTheme(theme: Theme) {
  currentTheme = theme;
  if (typeof document !== "undefined") {
    if (theme === "dark") {
      document.documentElement.dataset.theme = "dark";
    } else {
      delete document.documentElement.dataset.theme;
    }
    document.documentElement.style.colorScheme = theme;
  }
  try {
    localStorage.setItem("app_theme", theme);
  } catch {
    /* ignore */
  }
  listeners.forEach((listener) => listener(theme));
}

// Ensure theme is applied on script execution
if (typeof document !== "undefined") {
  applyTheme(currentTheme);
}

/**
 * Hook to read and toggle between Light and Dark mode globally across the application.
 */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    listeners.add(setTheme);
    applyTheme(currentTheme);
    return () => {
      listeners.delete(setTheme);
    };
  }, []);

  const toggleTheme = useCallback(() => {
    const next = currentTheme === "light" ? "dark" : "light";
    applyTheme(next);
  }, []);

  return [theme, toggleTheme];
}
