"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ThemeId = "classic" | "mission_control" | "audio_simulator";

const THEME_CLASS: Record<ThemeId, string> = {
  classic: "",
  mission_control: "theme-mission-control",
  audio_simulator: "theme-audio-simulator",
};

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme outside provider");
  return ctx;
}

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: ThemeId;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<ThemeId>(initialTheme);

  const apply = useCallback((next: ThemeId) => {
    const root = document.documentElement;
    root.classList.remove("theme-mission-control", "theme-audio-simulator");
    const cls = THEME_CLASS[next];
    if (cls) root.classList.add(cls);
    try {
      localStorage.setItem("assistant_theme", next);
    } catch {
      // storage may be blocked
    }
  }, []);

  useEffect(() => {
    // restore from localStorage first, then apply
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("assistant_theme");
    } catch {
      stored = null;
    }
    if (stored === "mission_control" || stored === "audio_simulator" || stored === "classic") {
      setThemeState(stored);
      apply(stored);
    } else {
      apply(initialTheme);
    }
  }, [apply, initialTheme]);

  const setTheme = useCallback(
    (next: ThemeId) => {
      setThemeState(next);
      apply(next);
      // persist server-side via personaConfig for same-tenant consistency
      void fetch("/api/profile/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ greetingStyle: undefined, tone: undefined }),
      }).catch(() => undefined);
      // direct theme persist
      void fetch("/api/profile/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      }).catch(() => undefined);
    },
    [apply],
  );

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function ThemeSwitcher({ small }: { small?: boolean }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className="row" style={{ gap: 6 }}>
      {(["classic", "mission_control", "audio_simulator"] as ThemeId[]).map((id) => (
        <button
          key={id}
          type="button"
          className={`btn ${theme === id ? "btn-primary" : ""} ${small ? "btn-sm" : ""}`}
          onClick={() => setTheme(id)}
          aria-pressed={theme === id}
          title={id.replace("_", " ")}
        >
          {id === "classic" ? "Classic" : id === "mission_control" ? "Mission Control" : "Audio Simulator"}
        </button>
      ))}
    </div>
  );
}
