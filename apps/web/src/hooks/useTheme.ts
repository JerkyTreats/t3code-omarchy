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
const DEFAULT_THEME_SNAPSHOT: ThemeSnapshot = {
  theme: "system",
  systemDark: false,
  systemTheme: null,
};
const THEME_COLOR_META_NAME = "theme-color";
const DYNAMIC_THEME_COLOR_SELECTOR = `meta[name="${THEME_COLOR_META_NAME}"][data-dynamic-theme-color="true"]`;

let listeners: Array<() => void> = [];
let lastSnapshot: ThemeSnapshot | null = null;
let stopSubscriptions: (() => void) | null = null;
let appliedDesktopThemeColorKeys = new Set<string>();
let lastDesktopTheme: Theme | null = null;
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

function hasThemeStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function getBrowserSystemDark(): boolean {
  if (typeof window === "undefined") return DEFAULT_THEME_SNAPSHOT.systemDark;
  return window.matchMedia(MEDIA_QUERY).matches;
}

function getStored(): Theme {
  if (!hasThemeStorage()) return DEFAULT_THEME_SNAPSHOT.theme;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return DEFAULT_THEME_SNAPSHOT.theme;
}

function readCachedDesktopSystemTheme(): DesktopSystemTheme | null {
  if (!hasThemeStorage()) return null;
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
  if (!hasThemeStorage()) return;
  if (!canUseDesktopSystemTheme()) return;
  if (theme === null) {
    localStorage.removeItem(SYSTEM_THEME_CACHE_KEY);
    return;
  }
  localStorage.setItem(SYSTEM_THEME_CACHE_KEY, JSON.stringify(theme));
}

function clearAppliedDesktopTheme(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const dataset = "dataset" in root ? root.dataset : null;
  if (dataset) {
    delete dataset.systemThemeSource;
    delete dataset.systemThemeMode;
    delete dataset.systemThemeName;
  }

  const style = "style" in root ? root.style : null;
  if (style) {
    for (const colorKey of appliedDesktopThemeColorKeys) {
      style.removeProperty(`--desktop-system-theme-${colorKey.replace(/_/g, "-")}`);
    }
  }
  appliedDesktopThemeColorKeys.clear();
}

function applyDesktopSystemTheme(theme: DesktopSystemTheme | null): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  clearAppliedDesktopTheme();

  if (theme === null) return;

  const dataset = "dataset" in root ? root.dataset : null;
  if (dataset) {
    dataset.systemThemeSource = theme.source;
    dataset.systemThemeMode = theme.mode;
    dataset.systemThemeName = theme.name;
  }

  const style = "style" in root ? root.style : null;
  if (style) {
    for (const [colorKey, colorValue] of Object.entries(theme.colors)) {
      if (!colorValue) continue;
      style.setProperty(`--desktop-system-theme-${colorKey.replace(/_/g, "-")}`, colorValue);
      appliedDesktopThemeColorKeys.add(colorKey);
    }
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
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (suppressTransitions) {
    document.documentElement.classList.add("no-transitions");
  }

  document.documentElement.classList.toggle("dark", resolveDarkMode(theme));
  applyDesktopSystemTheme(resolveEffectiveSystemTheme(theme));
  syncBrowserChromeTheme();
  syncDesktopTheme(theme);

  if (suppressTransitions) {
    // Force a reflow so the no-transitions class takes effect before removal
    // oxlint-disable-next-line no-unused-expressions
    document.documentElement.offsetHeight;
    requestAnimationFrame(() => {
      document.documentElement.classList.remove("no-transitions");
    });
  }
}

function ensureThemeColorMetaTag(): HTMLMetaElement {
  let element = document.querySelector<HTMLMetaElement>(DYNAMIC_THEME_COLOR_SELECTOR);
  if (element) {
    return element;
  }

  element = document.createElement("meta");
  element.name = THEME_COLOR_META_NAME;
  element.setAttribute("data-dynamic-theme-color", "true");
  document.head.append(element);
  return element;
}

function normalizeThemeColor(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim().toLowerCase();
  if (
    !normalizedValue ||
    normalizedValue === "transparent" ||
    normalizedValue === "rgba(0, 0, 0, 0)" ||
    normalizedValue === "rgba(0 0 0 / 0)"
  ) {
    return null;
  }

  return value?.trim() ?? null;
}

function resolveBrowserChromeSurface(): HTMLElement {
  return (
    document.querySelector<HTMLElement>("main[data-slot='sidebar-inset']") ??
    document.querySelector<HTMLElement>("[data-slot='sidebar-inner']") ??
    document.body
  );
}

export function syncBrowserChromeTheme() {
  if (typeof document === "undefined" || typeof getComputedStyle === "undefined") return;
  const surfaceColor = normalizeThemeColor(
    getComputedStyle(resolveBrowserChromeSurface()).backgroundColor,
  );
  const fallbackColor = normalizeThemeColor(getComputedStyle(document.body).backgroundColor);
  const backgroundColor = surfaceColor ?? fallbackColor;
  if (!backgroundColor) return;

  document.documentElement.style.backgroundColor = backgroundColor;
  document.body.style.backgroundColor = backgroundColor;
  ensureThemeColorMetaTag().setAttribute("content", backgroundColor);
}

function syncDesktopTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  const bridge = window.desktopBridge;
  if (!bridge || lastDesktopTheme === theme) {
    return;
  }

  lastDesktopTheme = theme;
  void bridge.setTheme(theme).catch(() => {
    if (lastDesktopTheme === theme) {
      lastDesktopTheme = null;
    }
  });
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
if (typeof document !== "undefined" && hasThemeStorage()) {
  applyTheme(getStored());
}

function getSnapshot(): ThemeSnapshot {
  if (!hasThemeStorage()) return DEFAULT_THEME_SNAPSHOT;
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

function getServerSnapshot() {
  return DEFAULT_THEME_SNAPSHOT;
}

function ensureSubscriptions(): void {
  if (typeof window === "undefined") return;
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

  const getSystemTheme = bridge?.getSystemTheme;
  const onSystemTheme = bridge?.onSystemTheme;
  if (typeof getSystemTheme === "function" && typeof onSystemTheme === "function") {
    unsubscribeSystemTheme = onSystemTheme((nextTheme) => {
      if (disposed) return;
      receivedSubscriptionUpdate = true;
      setDesktopSystemTheme(nextTheme, true);
    });

    void getSystemTheme()
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
  if (typeof window === "undefined") return () => {};
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
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const theme = snapshot.theme;

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? (snapshot.systemDark ? "dark" : "light") : theme;

  const setTheme = useCallback((next: Theme) => {
    if (!hasThemeStorage()) return;
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
