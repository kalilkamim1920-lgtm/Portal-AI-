/**
 * Language context — Arabic (RTL, default) & English (LTR).
 * Sets <html lang/dir> and persists the choice locally + to the user profile.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ar } from './ar';
import { en } from './en';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export type Lang = 'ar' | 'en';

type Dict = typeof ar;

interface LanguageContextValue {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  t: Dict;
  setLang: (l: Lang) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);
const STORAGE_KEY = 'portal-ai-lang';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user, profile, refreshProfile } = useAuth();
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'en' || saved === 'ar' ? saved : 'ar';
  });

  // When the user signs in, adopt their saved server-side language once
  useEffect(() => {
    if (user && profile?.language && !localStorage.getItem(STORAGE_KEY)) {
      setLangState(profile.language);
    }
  }, [user, profile?.language]);

  const setLang = useCallback(
    (l: Lang) => {
      setLangState(l);
      localStorage.setItem(STORAGE_KEY, l);
      if (user) {
        api.patch('/auth/profile', { language: l }).then(refreshProfile).catch(() => {});
      }
    },
    [user, refreshProfile]
  );

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const value = useMemo<LanguageContextValue>(
    () => ({ lang, dir: lang === 'ar' ? 'rtl' : 'ltr', t: (lang === 'ar' ? ar : en) as Dict, setLang }),
    [lang, setLang]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used inside <LanguageProvider>');
  return ctx;
}
