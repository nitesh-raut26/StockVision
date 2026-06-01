import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AppUser {
  id?: string;
  name: string;
  email: string;
  phone: string;
  plan: 'free' | 'premium' | 'pro' | 'enterprise';
  language: 'en' | 'hi';
  investingStyle: 'beginner' | 'intermediate' | 'pro';
  riskAppetite: number; // 1-10
  sectors: string[];
}

interface AppState {
  // Auth
  isLoggedIn: boolean;
  user: AppUser | null;
  // authToken is kept in-memory only (NOT persisted to localStorage).
  // The backend sets an httpOnly cookie on login — that cookie is the durable credential.
  authToken: string | null;
  onboardingComplete: boolean;
  onboardingStep: number;

  // UI
  sidebarOpen: boolean;
  language: 'en' | 'hi';
  watchlist: string[];

  // Actions
  login: (user: AppUser, authToken?: string | null) => void;
  logout: () => void;
  updateUser: (patch: Partial<AppUser>) => void;
  setAuthToken: (authToken: string | null) => void;
  setOnboardingStep: (step: number) => void;
  completeOnboarding: (patch?: Partial<AppUser>) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setLanguage: (lang: 'en' | 'hi') => void;
  addToWatchlist: (ticker: string) => void;
  removeFromWatchlist: (ticker: string) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      user: null,
      authToken: null,
      onboardingComplete: false,
      onboardingStep: 1,
      sidebarOpen: true,
      language: 'en',
      watchlist: ['BEL', 'HAL', 'IDEAFORGE'],

      login: (user, authToken = null) => set({
        isLoggedIn: true,
        authToken,
        user,
        language: user.language,
        onboardingComplete: false,
      }),
      logout: () => set({
        isLoggedIn: false,
        user: null,
        authToken: null,
        onboardingComplete: false,
      }),
      updateUser: (patch) => set((state) => ({
        user: state.user ? { ...state.user, ...patch } : state.user,
        language: patch.language ?? state.language,
      })),
      setAuthToken: (authToken) => set({ authToken }),
      setOnboardingStep: (step) => set({ onboardingStep: step }),
      completeOnboarding: (patch) => set((state) => ({
        onboardingComplete: true,
        user: state.user ? { ...state.user, ...patch } : state.user,
        language: patch?.language ?? state.language,
      })),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setLanguage: (lang) => set((state) => ({
        language: lang,
        user: state.user ? { ...state.user, language: lang } : state.user,
      })),
      addToWatchlist: (ticker) => set((state) => ({
        watchlist: [...state.watchlist.filter((item) => item !== ticker), ticker],
      })),
      removeFromWatchlist: (ticker) => set((state) => ({
        watchlist: state.watchlist.filter((item) => item !== ticker),
      })),
    }),
    {
      name: 'stockvision-store',
      // Persist only non-PII session hints.
      // Full user profile (email, phone, plan, sectors) is re-fetched from the backend
      // on every app load via /auth/me — never stored in localStorage.
      partialize: (state) => ({
        isLoggedIn: state.isLoggedIn,
        onboardingComplete: state.onboardingComplete,
        onboardingStep: state.onboardingStep,
        sidebarOpen: state.sidebarOpen,
        language: state.language,
        watchlist: state.watchlist,
        // user.id and user.name are low-sensitivity — kept for UI continuity before /auth/me resolves.
        // email, phone, plan, sectors are NOT persisted.
        user: state.user ? {
          id: state.user.id,
          name: state.user.name,
          email: '',
          phone: '',
          plan: 'free' as const,
          language: state.user.language,
          investingStyle: state.user.investingStyle,
          riskAppetite: state.user.riskAppetite,
          sectors: [],
        } : null,
      }),
    },
  ),
);
