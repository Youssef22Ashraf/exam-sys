import { useEffect } from "react";

export type Theme = "light";

/**
 * Ensures system stays on the unified, clean corporate light theme.
 */
export function useTheme(): [Theme, () => void] {
  useEffect(() => {
    delete document.documentElement.dataset.theme;
    try {
      localStorage.removeItem("exam_admin_theme");
    } catch {
      /* ignore */
    }
  }, []);

  return ["light", () => {}];
}
