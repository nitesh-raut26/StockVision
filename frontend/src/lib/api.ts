/**
 * lib/api.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * PUBLIC BARREL — re-exports every function and type from the service modules.
 *
 * WHY THIS FILE EXISTS
 * All pages import from '../lib/api' (e.g. `import { fetchScreener } from '../lib/api'`).
 * To keep those imports working without any changes we centralise all re-exports
 * here.  The actual logic lives in focused, easy-to-navigate service files:
 *
 *   lib/
 *   ├── core.ts                          ← shared HTTP primitives & types
 *   ├── api.ts                           ← ← ← YOU ARE HERE (barrel)
 *   └── services/
 *       ├── authService.ts               ← /auth endpoints
 *       ├── stockService.ts              ← /stocks, /screener, /dcf
 *       ├── portfolioService.ts          ← /portfolio
 *       ├── mutualFundService.ts         ← /mutual-funds
 *       ├── watchlistService.ts          ← /watchlist, /alerts
 *       ├── socialService.ts             ← /research, /leaderboard, /family
 *       ├── brokerService.ts             ← /broker, /ca
 *       ├── subscriptionService.ts       ← /subscriptions
 *       ├── marketDataService.ts         ← /market (FII/DII, breadth)
 *       ├── ipoService.ts                ← /ipo
 *       ├── backtestService.ts           ← /backtest
 *       └── optionsService.ts            ← /options
 *
 * To add a new API call: add it to the appropriate service file, then add a
 * one-line re-export below.  Never add logic directly to this file.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Auth ──────────────────────────────────────────────────────────────────────
export { loginWithEmail, registerUser, updateProfile } from './services/authService';

// ── Stocks ────────────────────────────────────────────────────────────────────
export type { SearchResult }                                    from './services/stockService';
export {
  fetchIndices,
  searchMarket,
  fetchScreener,
  fetchStockDetails,
  fetchDcf,
  fetchHeatmap,
  buildConvictionBreakdown,
  findMockStock,
}                                                               from './services/stockService';

// ── Portfolio ─────────────────────────────────────────────────────────────────
export type { GoalPayload }                                     from './services/portfolioService';
export {
  fetchPortfolioSummary,
  createTransaction,
  fetchTaxSummary,
  fetchGoals,
  saveGoal,
  computePortfolioHealth,
}                                                               from './services/portfolioService';

// ── Mutual Funds ──────────────────────────────────────────────────────────────
export {
  fetchMutualFunds,
  fetchSipProjection,
  fetchELSSFunds,
}                                                               from './services/mutualFundService';

// ── Watchlist & Alerts ────────────────────────────────────────────────────────
export {
  fetchWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  fetchAlerts,
  createAlert,
  toggleAlert,
  deleteAlert,
}                                                               from './services/watchlistService';

// ── Social (Research / Leaderboard / Family) ──────────────────────────────────
export {
  fetchResearchReports,
  fetchLeaderboard,
  fetchFamilyAggregate,
  addFamilyMember,
}                                                               from './services/socialService';

// ── Broker & CA Portal ────────────────────────────────────────────────────────
export {
  fetchBrokerAccounts,
  connectBroker,
  fetchCaClients,
}                                                               from './services/brokerService';

// ── Subscriptions ─────────────────────────────────────────────────────────────
export {
  fetchSubscription,
  createCheckoutSession,
  verifyPayment,
  cancelSubscription,
}                                                               from './services/subscriptionService';

// ── Market Data (FII/DII, Breadth, Movers) ────────────────────────────────────
export type { FiiDiiRow, MarketBreadth }                        from './services/marketDataService';
export {
  fetchFiiDii,
  fetchFiiDiiSummary,
  fetchMarketBreadth,
  fetchTopMovers,
}                                                               from './services/marketDataService';

// ── IPO ───────────────────────────────────────────────────────────────────────
export {
  fetchOpenIPOs,
  fetchUpcomingIPOs,
  fetchListedIPOs,
  fetchSMEIPOs,
}                                                               from './services/ipoService';

// ── Backtesting ───────────────────────────────────────────────────────────────
export type { BacktestPayload }                                 from './services/backtestService';
export {
  runBacktest,
  fetchBacktestStrategies,
}                                                               from './services/backtestService';

// ── Options Chain ─────────────────────────────────────────────────────────────
export {
  fetchOptionsChain,
  fetchOptionExpiries,
}                                                               from './services/optionsService';
