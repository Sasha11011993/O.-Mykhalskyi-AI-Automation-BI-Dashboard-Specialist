'use client';

import React, { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import {
  resolveTheme,
  type Locale,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/portfolioLogic';

interface ThemeLocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setThemePreference: (pref: ThemePreference) => void;
  cycleTheme: () => void;
}

const ThemeLocaleContext = createContext<ThemeLocaleContextValue | null>(null);

const THEME_STORAGE_KEY = 'mk-theme-pref';
const LOCALE_STORAGE_KEY = 'mk-locale-pref';

const prefListeners = new Set<() => void>();
let memoryThemePref: ThemePreference | null = null;
let memoryLocalePref: Locale | null = null;

function emitPrefChange(): void {
  prefListeners.forEach((listener) => listener());
}

function subscribeToPrefs(callback: () => void): () => void {
  prefListeners.add(callback);
  const handleStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) {
      memoryThemePref = null;
      callback();
    } else if (event.key === LOCALE_STORAGE_KEY) {
      memoryLocalePref = null;
      callback();
    }
  };
  window.addEventListener('storage', handleStorage);
  return () => {
    prefListeners.delete(callback);
    window.removeEventListener('storage', handleStorage);
  };
}

function subscribeToSystemTheme(callback: () => void): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

function getSystemThemeSnapshot(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getSystemThemeServerSnapshot(): boolean {
  return false;
}

function subscribeToHydration(): () => void {
  return () => {};
}

function getHydratedSnapshot(): boolean {
  return true;
}

function getHydratedServerSnapshot(): boolean {
  return false;
}

function getStoredThemeSnapshot(): ThemePreference {
  if (memoryThemePref) return memoryThemePref;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // Ignore storage failures
  }
  return 'system';
}

function getStoredThemeServerSnapshot(): ThemePreference {
  return 'system';
}

function getStoredLocaleSnapshot(): Locale {
  if (memoryLocalePref) return memoryLocalePref;
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === 'uk' || stored === 'en') {
      return stored;
    }
  } catch {
    // Ignore storage failures
  }
  return 'uk';
}

function getStoredLocaleServerSnapshot(): Locale {
  return 'uk';
}

export function ThemeLocaleProvider({ children }: { children: React.ReactNode }) {
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getHydratedServerSnapshot
  );

  const locale = useSyncExternalStore(
    subscribeToPrefs,
    getStoredLocaleSnapshot,
    getStoredLocaleServerSnapshot
  );

  const themePreference = useSyncExternalStore(
    subscribeToPrefs,
    getStoredThemeSnapshot,
    getStoredThemeServerSnapshot
  );

  const systemPrefersDark = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemThemeSnapshot,
    getSystemThemeServerSnapshot
  );

  const resolvedTheme = resolveTheme(themePreference, systemPrefersDark);

  useEffect(() => {
    if (!isHydrated) return;
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.style.colorScheme = resolvedTheme;
  }, [isHydrated, resolvedTheme]);

  useEffect(() => {
    if (!isHydrated) return;
    document.documentElement.lang = locale;
  }, [isHydrated, locale]);

  const setLocale = (next: Locale) => {
    memoryLocalePref = next;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Ignore storage access failures
    }
    emitPrefChange();
  };

  const toggleLocale = () => {
    setLocale(locale === 'uk' ? 'en' : 'uk');
  };

  const setThemePreference = (next: ThemePreference) => {
    memoryThemePref = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore storage access failures
    }
    emitPrefChange();
  };

  const cycleTheme = () => {
    const order: ThemePreference[] = ['system', 'light', 'dark'];
    const nextIdx = (order.indexOf(themePreference) + 1) % order.length;
    setThemePreference(order[nextIdx]);
  };

  return (
    <ThemeLocaleContext.Provider
      value={{
        locale,
        setLocale,
        toggleLocale,
        themePreference,
        resolvedTheme,
        setThemePreference,
        cycleTheme,
      }}
    >
      {children}
    </ThemeLocaleContext.Provider>
  );
}

export function useThemeLocale(): ThemeLocaleContextValue {
  const ctx = useContext(ThemeLocaleContext);
  if (!ctx) {
    throw new Error('useThemeLocale must be used inside ThemeLocaleProvider');
  }
  return ctx;
}
