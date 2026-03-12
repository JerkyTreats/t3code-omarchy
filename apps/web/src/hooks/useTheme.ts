import type { DesktopSystemTheme } from "@t3tools/contracts";
import { useCallback, useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";
type ThemeSnapshot = {
  theme: Theme;
  systemDark: boolean;
  systemTheme: DesktopSystemTheme | null;
};

const STORAGE_KEY = "t3code:theme";
const SYSTEM_THEME_CACHE_KEY = "t3code:desktop-system-theme";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

let listeners: Array<() => void> = [];
let lastSnapshot: ThemeSnapshot | null = null;
let stopSubscriptions: (() => void) | null = null;
let appliedDesktopThemeColorKeys = new Set<string>();
const noopUnsubscribe: () => void = () => undefined;

function getDesktopBridge() {
  return typeof window !== "undefined" ? window.desktopBridge : undefined;
}

function canUseDesktopSystemTheme(): boolean {
  const bridge = getDesktopBridge();
  return (
    typeof bridge?.getSystemTheme === "function" && typeof bridge?.onSystemTheme === "function"
  );
}

function emitChange() {
  lastSnapshot = null;
  for (const listener of listeners) listener();
}

function getBrowserSystemDark(): boolean {
  return window.matchMedia(MEDIA_QUERY).matches;
}

function getStored(): Theme {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

function readCachedDesktopSystemTheme(): DesktopSystemTheme | null {
  if (!canUseDesktopSystemTheme()) return null;

  const raw = localStorage.getItem(SYSTEM_THEME_CACHE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      parsed.source !== "omarchy" ||
      typeof parsed.name !== "string" ||
      (parsed.mode !== "light" && parsed.mode !== "dark") ||
      typeof parsed.colors !== "object" ||
      parsed.colors === null
    ) {
      return null;
    }

    return {
      source: "omarchy",
      name: parsed.name,
      mode: parsed.mode,
      colors: Object.fromEntries(
        Object.entries(parsed.colors).filter(
          (entry): entry is [string, string] =>
            typeof entry[0] === "string" && typeof entry[1] === "string",
        ),
      ),
    };
  } catch {
    return null;
  }
}

let desktopSystemTheme: DesktopSystemTheme | null = readCachedDesktopSystemTheme();

function persistDesktopSystemTheme(theme: DesktopSystemTheme | null): void {
  if (!canUseDesktopSystemTheme()) return;
  if (theme === null) {
    localStorage.removeItem(SYSTEM_THEME_CACHE_KEY);
    return;
  }
  localStorage.setItem(SYSTEM_THEME_CACHE_KEY, JSON.stringify(theme));
}

function clearAppliedDesktopTheme(): void {
  const root = document.documentElement;
  delete root.dataset.systemThemeSource;
  delete root.dataset.systemThemeMode;
  delete root.dataset.systemThemeName;

  for (const colorKey of appliedDesktopThemeColorKeys) {
    root.style.removeProperty(`--desktop-system-theme-${colorKey.replace(/_/g, "-")}`);
  }
  appliedDesktopThemeColorKeys.clear();
}

function applyDesktopSystemTheme(theme: DesktopSystemTheme | null): void {
  const root = document.documentElement;
  clearAppliedDesktopTheme();

  if (theme === null) return;

  root.dataset.systemThemeSource = theme.source;
  root.dataset.systemThemeMode = theme.mode;
  root.dataset.systemThemeName = theme.name;

  for (const [colorKey, colorValue] of Object.entries(theme.colors)) {
    if (!colorValue) continue;
    root.style.setProperty(`--desktop-system-theme-${colorKey.replace(/_/g, "-")}`, colorValue);
    appliedDesktopThemeColorKeys.add(colorKey);
  }
}

function resolveEffectiveSystemTheme(theme: Theme): DesktopSystemTheme | null {
  return theme === "system" && canUseDesktopSystemTheme() ? desktopSystemTheme : null;
}

function resolveDarkMode(theme: Theme): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  const effectiveSystemTheme = resolveEffectiveSystemTheme(theme);
  return effectiveSystemTheme ? effectiveSystemTheme.mode === "dark" : getBrowserSystemDark();
}

function applyTheme(theme: Theme, suppressTransitions = false) {
  if (suppressTransitions) {
    document.documentElement.classList.add("no-transitions");
  }

  document.documentElement.classList.toggle("dark", resolveDarkMode(theme));
  applyDesktopSystemTheme(resolveEffectiveSystemTheme(theme));

  if (suppressTransitions) {
    // Force a reflow so the no-transitions class takes effect before removal
    // oxlint-disable-next-line no-unused-expressions
    document.documentElement.offsetHeight;
    requestAnimationFrame(() => {
      document.documentElement.classList.remove("no-transitions");
    });
  }
}

function setDesktopSystemTheme(
  nextTheme: DesktopSystemTheme | null,
  suppressTransitions = false,
): void {
  if (JSON.stringify(nextTheme) === JSON.stringify(desktopSystemTheme)) {
    return;
  }

  desktopSystemTheme = nextTheme;
  persistDesktopSystemTheme(nextTheme);

  if (getStored() === "system") {
    applyTheme("system", suppressTransitions);
  }

  emitChange();
}

// Apply immediately on module load to prevent flash
applyTheme(getStored());

function getSnapshot(): ThemeSnapshot {
  const theme = getStored();
  const systemTheme = resolveEffectiveSystemTheme(theme);
  const systemDark = theme === "system" ? resolveDarkMode(theme) : false;

  if (
    lastSnapshot &&
    lastSnapshot.theme === theme &&
    lastSnapshot.systemDark === systemDark &&
    JSON.stringify(lastSnapshot.systemTheme) === JSON.stringify(systemTheme)
  ) {
    return lastSnapshot;
  }

  lastSnapshot = { theme, systemDark, systemTheme };
  return lastSnapshot;
}

function ensureSubscriptions(): void {
  if (stopSubscriptions !== null) return;

  const mq = window.matchMedia(MEDIA_QUERY);
  const handleMediaChange = () => {
    if (getStored() === "system" && resolveEffectiveSystemTheme("system") === null) {
      applyTheme("system", true);
      emitChange();
    }
  };
  mq.addEventListener("change", handleMediaChange);

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    applyTheme(getStored(), true);
    emitChange();
  };
  window.addEventListener("storage", handleStorage);

  const bridge = getDesktopBridge();
  let disposed = false;
  let receivedSubscriptionUpdate = false;
  let unsubscribeSystemTheme = noopUnsubscribe;

  if (canUseDesktopSystemTheme() && bridge) {
    unsubscribeSystemTheme = bridge.onSystemTheme((nextTheme) => {
      if (disposed) return;
      receivedSubscriptionUpdate = true;
      setDesktopSystemTheme(nextTheme, true);
    });

    void bridge
      .getSystemTheme()
      .then((nextTheme) => {
        if (disposed || receivedSubscriptionUpdate) return;
        setDesktopSystemTheme(nextTheme, true);
      })
      .catch(() => undefined);
  } else {
    desktopSystemTheme = null;
  }

  stopSubscriptions = () => {
    disposed = true;
    mq.removeEventListener("change", handleMediaChange);
    window.removeEventListener("storage", handleStorage);
    unsubscribeSystemTheme();
    stopSubscriptions = null;
  };
}

function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  ensureSubscriptions();

  return () => {
    listeners = listeners.filter((candidate) => candidate !== listener);
    if (listeners.length === 0 && stopSubscriptions) {
      stopSubscriptions();
    }
  };
}

export function useTheme() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  const theme = snapshot.theme;

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? (snapshot.systemDark ? "dark" : "light") : theme;

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next, true);
    emitChange();
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme, snapshot.systemTheme]);

  return {
    theme,
    setTheme,
    resolvedTheme,
    systemTheme: snapshot.systemTheme,
  } as const;
}
