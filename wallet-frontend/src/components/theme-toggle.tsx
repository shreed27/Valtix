"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="h-4 w-4 rounded-full border border-current opacity-50"></span>
        <div className="w-10 h-5 bg-muted rounded-full relative">
          <div className="absolute left-0.5 top-0.5 h-4 w-4 bg-background rounded-full shadow-sm"></div>
        </div>
        <span className="h-4 w-4 rounded-full border border-current opacity-50"></span>
      </div>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      <Sun className={`h-4 w-4 transition-opacity ${isDark ? "opacity-50" : "opacity-100 text-yellow-500"}`} />
      <div
        className={`w-10 h-5 rounded-full relative transition-colors ${
          isDark ? "bg-primary" : "bg-muted"
        }`}
      >
        <div
          className={`absolute top-0.5 h-4 w-4 bg-background rounded-full shadow-sm transition-all ${
            isDark ? "left-[22px]" : "left-0.5"
          }`}
        />
      </div>
      <Moon className={`h-4 w-4 transition-opacity ${isDark ? "opacity-100 text-primary" : "opacity-50"}`} />
    </button>
  );
}
