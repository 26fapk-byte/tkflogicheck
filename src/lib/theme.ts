import React from 'react';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'logicheck_theme';

export function getTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  return stored || 'system';
}

export function setTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

export function applyTheme(theme: Theme) {
  const isDark = theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function useTheme() {
  const [theme, setLocalTheme] = React.useState<Theme>(() => getTheme());

  React.useEffect(() => {
    const handleChange = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    const matcher = window.matchMedia('(prefers-color-scheme: dark)');
    matcher.addEventListener('change', handleChange);

    applyTheme(theme);

    return () => matcher.removeEventListener('change', handleChange);
  }, [theme]);

  return {
    theme,
    setTheme: (newTheme: Theme) => {
      setLocalTheme(newTheme);
      setTheme(newTheme);
    }
  };
}
