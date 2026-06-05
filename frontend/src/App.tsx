import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStore } from './store/useStore';
import { useTheme } from './hooks/useTheme';
import ErrorBoundary from './components/ErrorBoundary';

// ── Eagerly loaded: shell + auth critical path ─────────────────────────────
import AppLayout from './components/layout/AppLayout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';

// ── Lazy loaded: all app pages (reduces initial bundle ~1.1MB → ~180KB) ───
const Onboarding      = lazy(() => import('./pages/Onboarding'));
const Dashboard       = lazy(() => import('./pages/Dashboard'));
const Screener        = lazy(() => import('./pages/Screener'));
const StockDetail     = lazy(() => import('./pages/StockDetail'));
const DCFBuilder      = lazy(() => import('./pages/DCFBuilder'));
const CompsAnalysis   = lazy(() => import('./pages/CompsAnalysis'));
const MutualFunds     = lazy(() => import('./pages/MutualFunds'));
const Heatmap         = lazy(() => import('./pages/Heatmap'));
const GoalPlanner     = lazy(() => import('./pages/GoalPlanner'));
const TaxTracker      = lazy(() => import('./pages/TaxTracker'));
const Leaderboard     = lazy(() => import('./pages/Leaderboard'));
const ResearchLibrary = lazy(() => import('./pages/ResearchLibrary'));
const Watchlist       = lazy(() => import('./pages/Watchlist'));
const FamilyPortfolio = lazy(() => import('./pages/FamilyPortfolio'));
const CAPortal        = lazy(() => import('./pages/CAPortal'));
const Settings        = lazy(() => import('./pages/Settings'));
const OptionsChain    = lazy(() => import('./pages/OptionsChain'));
const IPOTracker      = lazy(() => import('./pages/IPOTracker'));
const Backtesting     = lazy(() => import('./pages/Backtesting'));
const NotFound        = lazy(() => import('./pages/NotFound'));
const LegalPage       = lazy(() => import('./pages/LegalPage'));
const DeveloperAPI    = lazy(() => import('./pages/DeveloperAPI'));
const PublicStock     = lazy(() => import('./pages/PublicStock'));
const AIAssistant     = lazy(() => import('./pages/AIAssistant'));
const Calculators     = lazy(() => import('./pages/Calculators'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
    },
  },
});

function PageLoader() {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--tx-3)',
      fontSize: 13,
    }}>
      Loading…
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, onboardingComplete } = useStore();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (!onboardingComplete) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  useTheme();
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/onboarding" element={
                  <ErrorBoundary>
                    <Onboarding />
                  </ErrorBoundary>
                } />
                <Route path="/app" element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={<Navigate to="/app/dashboard" replace />} />
                  <Route path="dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                  <Route path="screener" element={<ErrorBoundary><Screener /></ErrorBoundary>} />
                  <Route path="stock/:ticker" element={<ErrorBoundary><StockDetail /></ErrorBoundary>} />
                  <Route path="dcf" element={<Navigate to="/app/dcf/RELIANCE" replace />} />
                  <Route path="dcf/:ticker" element={<ErrorBoundary><DCFBuilder /></ErrorBoundary>} />
                  <Route path="comps" element={<Navigate to="/app/comps/RELIANCE" replace />} />
                  <Route path="comps/:ticker" element={<ErrorBoundary><CompsAnalysis /></ErrorBoundary>} />
                  <Route path="funds" element={<Navigate to="/app/mutual-funds" replace />} />
                  <Route path="mutual-funds" element={<ErrorBoundary><MutualFunds /></ErrorBoundary>} />
                  <Route path="heatmap" element={<ErrorBoundary><Heatmap /></ErrorBoundary>} />
                  <Route path="goals" element={<ErrorBoundary><GoalPlanner /></ErrorBoundary>} />
                  <Route path="tax" element={<ErrorBoundary><TaxTracker /></ErrorBoundary>} />
                  <Route path="watchlist" element={<ErrorBoundary><Watchlist /></ErrorBoundary>} />
                  <Route path="leaderboard" element={<ErrorBoundary><Leaderboard /></ErrorBoundary>} />
                  <Route path="research" element={<ErrorBoundary><ResearchLibrary /></ErrorBoundary>} />
                  <Route path="family" element={<ErrorBoundary><FamilyPortfolio /></ErrorBoundary>} />
                  <Route path="ca-portal" element={<ErrorBoundary><CAPortal /></ErrorBoundary>} />
                  <Route path="settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
                  <Route path="options" element={<ErrorBoundary><OptionsChain /></ErrorBoundary>} />
                  <Route path="ipo" element={<ErrorBoundary><IPOTracker /></ErrorBoundary>} />
                  <Route path="backtest" element={<ErrorBoundary><Backtesting /></ErrorBoundary>} />
                  <Route path="ai" element={<ErrorBoundary><AIAssistant /></ErrorBoundary>} />
                  <Route path="calculators" element={<ErrorBoundary><Calculators /></ErrorBoundary>} />
                </Route>
                <Route path="/legal/:slug" element={<LegalPage />} />
                <Route path="/developers" element={<DeveloperAPI />} />
                <Route path="/stock/:ticker" element={<PublicStock />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
