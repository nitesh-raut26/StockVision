import {
  mockHeatmapData,
  mockLeaderboard,
  mockMarketIndices,
  mockMutualFunds,
  mockPortfolio,
  mockResearchReports,
  mockStocks,
  mockTaxData,
} from '../data/mockData';
import type { AppUser } from '../store/useStore';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');
const LOCAL_GOALS_KEY = 'stockvision-local-goals';

type MockStock = (typeof mockStocks)[number];

interface BackendUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  plan: string;
  language: string;
  investing_style: string | null;
  risk_appetite: number | null;
  sectors: string[];
  onboarding_completed: boolean;
}

interface BackendTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  user: BackendUser;
}

interface RequestOptions extends RequestInit {
  token?: string | null;
}

export interface SearchResult {
  id: string;
  label: string;
  subtitle: string;
  path: string;
  type: 'stock' | 'fund';
}

export interface GoalPayload {
  name: string;
  goal_type: 'education' | 'home' | 'retirement' | 'emergency' | 'custom';
  target_amount: number;
  target_date: string;
  monthly_sip: number;
}

function buildHeaders(token?: string | null, headers?: HeadersInit) {
  const merged = new Headers(headers);
  if (!merged.has('Content-Type')) {
    merged.set('Content-Type', 'application/json');
  }
  if (token) {
    merged.set('Authorization', `Bearer ${token}`);
  }
  return merged;
}

async function requestJson<T>(path: string, options: RequestOptions = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include', // send httpOnly auth cookie on every request
    headers: buildHeaders(options.token, options.headers),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function buildSyntheticStock(ticker: string): MockStock {
  return {
    id: ticker,
    ticker,
    name: ticker,
    price: 0,
    change: 0,
    changePct: 0,
    marketCap: 0,
    sector: 'Unknown',
    pe: 0,
    roce: 0,
    debtEquity: 0,
    promoterHolding: 0,
    revenue: 0,
    revenueGrowth: 0,
    convictionScore: 5,
    target12m: 0,
    upside: 0,
    risk: 'Medium',
    high52w: 0,
    low52w: 0,
    evEbitda: 0,
    description: 'Live market data is unavailable for this stock right now.',
    volumeSpike: false,
    analystRating: 'Hold',
  };
}

function findMockStock(ticker: string) {
  return mockStocks.find((stock) => stock.ticker === ticker.toUpperCase()) ?? buildSyntheticStock(ticker.toUpperCase());
}

function mapPlan(plan: string | null | undefined): AppUser['plan'] {
  if (plan === 'enterprise' || plan === 'pro') {
    return plan;
  }
  if (plan === 'premium') {
    return 'premium';
  }
  return 'free';
}

function normalizeToCrores(value: number | null | undefined) {
  if (!value) {
    return 0;
  }
  return value > 1_000_000_000 ? value / 10_000_000 : value;
}

function buildUserFromBackend(user: BackendUser): AppUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email ?? '',
    phone: user.phone ?? '',
    plan: mapPlan(user.plan),
    language: user.language === 'hi' ? 'hi' : 'en',
    investingStyle: user.investing_style === 'pro' ? 'pro' : user.investing_style === 'beginner' ? 'beginner' : 'intermediate',
    riskAppetite: user.risk_appetite ?? 5,
    sectors: user.sectors ?? [],
  };
}

function readLocalGoals() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_GOALS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeLocalGoals(goals: unknown[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(LOCAL_GOALS_KEY, JSON.stringify(goals));
}

function buildFallbackPortfolioSummary() {
  const totalValue = mockPortfolio.holdings.reduce((sum, holding) => sum + holding.currentPrice * holding.qty, 0);
  const totalInvested = mockPortfolio.holdings.reduce((sum, holding) => sum + holding.avgPrice * holding.qty, 0);

  return {
    totalValue,
    totalInvested,
    totalGain: totalValue - totalInvested,
    gainPct: totalInvested ? ((totalValue - totalInvested) / totalInvested) * 100 : 0,
    xirr: mockPortfolio.xirr,
    holdings: mockPortfolio.holdings.map((holding) => ({
      ticker: holding.ticker,
      name: holding.name,
      qty: holding.qty,
      avgPrice: holding.avgPrice,
      currentPrice: holding.currentPrice,
      currentValue: holding.currentPrice * holding.qty,
      pnl: holding.pnl,
      pnlPct: holding.pnlPct,
      broker: holding.broker,
      sector: holding.sector,
    })),
    brokerBreakdown: mockPortfolio.brokers.map((broker) => ({
      broker: broker.name,
      value: broker.value,
      invested: broker.value - ((mockPortfolio.totalPnl * broker.value) / mockPortfolio.totalValue),
      pnl: (mockPortfolio.totalPnl * broker.value) / mockPortfolio.totalValue,
    })),
  };
}

function buildFallbackTaxSummary() {
  return {
    stcgGains: mockTaxData.stcgGains,
    ltcgGains: mockTaxData.ltcgGains,
    stcgTax: mockTaxData.stcgTax,
    ltcgTax: mockTaxData.ltcgTax,
    totalTax: mockTaxData.stcgTax + mockTaxData.ltcgTax,
    taxSavedPotential: mockTaxData.taxSaved,
    harvestingSuggestions: mockTaxData.harvestingSuggestions,
  };
}

function mapScreenerResultToStock(result: {
  ticker: string;
  name: string;
  sector: string;
  cap?: string;
  price: number;
  change_pct: number;
  conviction_score: number;
  pe_ratio?: number | null;
  roce?: number | null;
  debt_equity?: number | null;
  promoter_holding?: number | null;
  revenue_growth?: number | null;
  target_12m?: number | null;
  upside?: number | null;
  risk: string;
  market_cap?: number | null;
}) {
  const fallback = findMockStock(result.ticker);
  const absoluteChange = result.price * (result.change_pct / 100);

  return {
    ...fallback,
    id: result.ticker,
    ticker: result.ticker,
    name: result.name,
    sector: result.sector || fallback.sector,
    cap: result.cap ?? 'mid',
    price: result.price,
    change: Number.isFinite(absoluteChange) ? absoluteChange : fallback.change,
    changePct: result.change_pct ?? fallback.changePct,
    convictionScore: result.conviction_score ?? fallback.convictionScore,
    pe: result.pe_ratio ?? fallback.pe,
    roce: result.roce ?? fallback.roce,
    debtEquity: result.debt_equity ?? fallback.debtEquity,
    promoterHolding: result.promoter_holding ?? fallback.promoterHolding,
    revenueGrowth: result.revenue_growth ?? fallback.revenueGrowth,
    target12m: result.target_12m ?? fallback.target12m,
    upside: result.upside ?? fallback.upside,
    risk: result.risk ?? fallback.risk,
    marketCap: result.market_cap ?? (fallback as any).marketCap ?? 0,
    description: fallback.description || `${result.name} is currently screened as a ${result.risk.toLowerCase()}-risk ${result.sector} opportunity.`,
  };
}

function filterMockStocks(filters: {
  min_conviction_score: number;
  max_pe: number;
  min_roce: number;
  max_debt_equity: number;
  min_promoter_holding: number;
  min_revenue_growth: number;
  sector?: string | null;
  sort_by: string;
}) {
  const matches = mockStocks.filter((stock) => (
    stock.convictionScore >= filters.min_conviction_score &&
    stock.pe <= filters.max_pe &&
    stock.roce >= filters.min_roce &&
    stock.debtEquity <= filters.max_debt_equity &&
    stock.promoterHolding >= filters.min_promoter_holding &&
    stock.revenueGrowth >= filters.min_revenue_growth &&
    (!filters.sector || stock.sector.toLowerCase() === filters.sector.toLowerCase())
  ));

  if (filters.sort_by === 'upside') {
    matches.sort((left, right) => right.upside - left.upside);
  } else if (filters.sort_by === 'change_pct') {
    matches.sort((left, right) => right.changePct - left.changePct);
  } else if (filters.sort_by === 'pe_ratio') {
    matches.sort((left, right) => left.pe - right.pe);
  } else {
    matches.sort((left, right) => right.convictionScore - left.convictionScore);
  }

  return matches;
}

function buildConvictionBreakdown(factors?: Record<string, number>) {
  if (!factors) {
    return [
      { name: 'Fundamentals', value: 38, color: '#4361EE' },
      { name: 'Technicals', value: 34, color: '#22D3EE' },
      { name: 'Sentiment', value: 28, color: '#00C896' },
    ];
  }

  const fundamentals = [
    factors.pe_attractiveness,
    factors.pb_attractiveness,
    factors.revenue_growth,
    factors.roe,
    factors.debt_equity,
    factors.dividend_yield,
    factors.free_cash_flow,
  ].filter((value) => value !== undefined);
  const technicals = [
    factors.price_momentum_1m,
    factors.price_momentum_3m,
    factors.week_52_position,
    factors.volume_signal,
  ].filter((value) => value !== undefined);
  const sentiment = [factors.beta_risk].filter((value) => value !== undefined);

  const scoreToPct = (values: number[]) => {
    if (!values.length) {
      return 0;
    }
    return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100);
  };

  return [
    { name: 'Fundamentals', value: scoreToPct(fundamentals), color: '#4361EE' },
    { name: 'Technicals', value: scoreToPct(technicals), color: '#22D3EE' },
    { name: 'Sentiment', value: scoreToPct(sentiment), color: '#00C896' },
  ];
}

function calculateSipProjection(monthlyAmount: number, expectedReturn: number, tenureYears: number) {
  const monthlyRate = expectedReturn / 12;
  const totalMonths = tenureYears * 12;
  const futureValue = monthlyRate > 0
    ? monthlyAmount * ((((1 + monthlyRate) ** totalMonths) - 1) / monthlyRate) * (1 + monthlyRate)
    : monthlyAmount * totalMonths;
  const totalInvested = monthlyAmount * totalMonths;

  return {
    monthlyAmount,
    tenureYears,
    expectedReturnPct: expectedReturn * 100,
    totalInvested,
    futureValue,
    totalReturns: futureValue - totalInvested,
    wealthGainPct: totalInvested ? ((futureValue - totalInvested) / totalInvested) * 100 : 0,
  };
}

export async function loginWithEmail(email: string, password: string) {
  const response = await requestJson<BackendTokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  return {
    token: response.access_token,
    user: buildUserFromBackend(response.user),
    onboardingComplete: response.user.onboarding_completed,
  };
}

export async function updateProfile(token: string, patch: Partial<AppUser> & { onboardingCompleted?: boolean }) {
  const response = await requestJson<BackendUser>('/auth/me', {
    method: 'PATCH',
    token,
    body: JSON.stringify({
      name: patch.name,
      language: patch.language,
      investing_style: patch.investingStyle,
      risk_appetite: patch.riskAppetite,
      sectors: patch.sectors,
      onboarding_completed: patch.onboardingCompleted,
    }),
  });

  return buildUserFromBackend(response);
}

export async function fetchIndices() {
  const fallback = mockMarketIndices;

  try {
    const indices = await requestJson<Array<{ price: number; change: number; change_pct: number }>>('/stocks/indices');
    return fallback.map((index, position) => ({
      ...index,
      value: indices[position]?.price ?? index.value,
      change: indices[position]?.change ?? index.change,
      changePct: indices[position]?.change_pct ?? index.changePct,
    }));
  } catch {
    return fallback;
  }
}

export async function searchMarket(query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return [] as SearchResult[];
  }

  const fundMatches = mockMutualFunds
    .filter((fund) => fund.name.toLowerCase().includes(trimmed) || fund.amc.toLowerCase().includes(trimmed))
    .slice(0, 3)
    .map((fund) => ({
      id: fund.id,
      label: fund.name,
      subtitle: `${fund.amc} · ${fund.category}`,
      path: '/app/mutual-funds',
      type: 'fund' as const,
    }));

  try {
    const stocks = await requestJson<Array<{ ticker: string; name: string; exchange: string }>>(`/stocks/search?q=${encodeURIComponent(query)}&limit=6`);
    return [
      ...stocks.map((stock) => ({
        id: stock.ticker,
        label: stock.ticker,
        subtitle: stock.name || stock.exchange,
        path: `/app/stock/${stock.ticker}`,
        type: 'stock' as const,
      })),
      ...fundMatches,
    ].slice(0, 8);
  } catch {
    const stockMatches = mockStocks
      .filter((stock) => stock.ticker.toLowerCase().includes(trimmed) || stock.name.toLowerCase().includes(trimmed))
      .slice(0, 5)
      .map((stock) => ({
        id: stock.ticker,
        label: stock.ticker,
        subtitle: stock.name,
        path: `/app/stock/${stock.ticker}`,
        type: 'stock' as const,
      }));

    return [...stockMatches, ...fundMatches].slice(0, 8);
  }
}

export async function fetchScreener(filters: {
  min_conviction_score: number;
  max_pe: number;
  min_roce: number;
  max_debt_equity: number;
  min_promoter_holding: number;
  min_revenue_growth: number;
  sector?: string | null;
  cap?: string | null;
  universe?: string;
  sort_by: string;
  limit?: number;
}, token?: string | null) {
  try {
    const response = await requestJson<Array<{
      ticker: string;
      name: string;
      sector: string;
      cap?: string;
      price: number;
      change_pct: number;
      conviction_score: number;
      pe_ratio?: number | null;
      roce?: number | null;
      debt_equity?: number | null;
      promoter_holding?: number | null;
      revenue_growth?: number | null;
      target_12m?: number | null;
      upside?: number | null;
      risk: string;
      market_cap?: number | null;
    }>>('/screener/run', {
      method: 'POST',
      token,
      body: JSON.stringify(filters),
    });

    return response.map(mapScreenerResultToStock);
  } catch {
    return filterMockStocks(filters);
  }
}

export async function fetchPortfolioSummary(token?: string | null) {
  if (!token) {
    return buildFallbackPortfolioSummary();
  }

  try {
    const response = await requestJson<{
      total_value: number;
      total_invested: number;
      total_gain: number;
      gain_pct: number;
      xirr: number | null;
      holdings: Array<{
        ticker: string;
        name: string;
        qty: number;
        avg_price: number;
        current_price: number;
        current_value: number;
        pnl: number;
        pnl_pct: number;
        broker: string;
        sector: string;
      }>;
      broker_breakdown: Array<{ broker: string; value: number; invested: number; pnl: number }>;
    }>('/portfolio/summary', { token });

    return {
      totalValue: response.total_value,
      totalInvested: response.total_invested,
      totalGain: response.total_gain,
      gainPct: response.gain_pct,
      xirr: response.xirr,
      holdings: response.holdings.map((holding) => ({
        ticker: holding.ticker,
        name: holding.name,
        qty: holding.qty,
        avgPrice: holding.avg_price,
        currentPrice: holding.current_price,
        currentValue: holding.current_value,
        pnl: holding.pnl,
        pnlPct: holding.pnl_pct,
        broker: holding.broker,
        sector: holding.sector,
      })),
      brokerBreakdown: response.broker_breakdown,
    };
  } catch {
    return buildFallbackPortfolioSummary();
  }
}

export async function createTransaction(payload: {
  ticker: string;
  action: 'BUY' | 'SELL';
  qty: number;
  price: number;
  broker?: string;
  trade_date?: string;
  charges?: number;
}, token?: string | null) {
  if (!token) {
    return null;
  }
  return requestJson('/portfolio/transactions/', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export async function fetchTaxSummary(token?: string | null) {
  if (!token) {
    return buildFallbackTaxSummary();
  }

  try {
    const response = await requestJson<{
      stcg_gains: number;
      ltcg_gains: number;
      stcg_tax: number;
      ltcg_tax: number;
      total_tax: number;
      tax_saved_potential: number;
      harvesting_suggestions: Array<{ ticker: string; loss: number; taxSaving?: number; tax_saving?: number; deadline?: string; name?: string }>;
    }>('/portfolio/tax', { token });

    return {
      stcgGains: response.stcg_gains,
      ltcgGains: response.ltcg_gains,
      stcgTax: response.stcg_tax,
      ltcgTax: response.ltcg_tax,
      totalTax: response.total_tax,
      taxSavedPotential: response.tax_saved_potential,
      harvestingSuggestions: response.harvesting_suggestions.map((suggestion) => ({
        ticker: suggestion.ticker,
        name: suggestion.name ?? suggestion.ticker,
        loss: suggestion.loss,
        taxSaving: suggestion.tax_saving ?? suggestion.taxSaving ?? 0,
        deadline: suggestion.deadline ?? 'Mar 31',
      })),
    };
  } catch {
    return buildFallbackTaxSummary();
  }
}

export async function fetchGoals(token?: string | null) {
  if (!token) {
    return readLocalGoals();
  }

  try {
    return await requestJson<Array<{
      id: string;
      name: string;
      goal_type: string;
      target_amount: number;
      target_date: string;
      monthly_sip: number;
      current_corpus: number;
      projected_corpus: number;
      on_track: boolean;
      completion_pct: number;
      suggested_allocation: Array<{ asset: string; pct: number }>;
    }>>('/portfolio/goals', { token });
  } catch {
    return readLocalGoals();
  }
}

export async function saveGoal(payload: GoalPayload, token?: string | null) {
  if (!token) {
    const goals = readLocalGoals();
    const months = Math.max(1, Math.round((new Date(payload.target_date).getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000)));
    const projectedCorpus = payload.monthly_sip * months;
    const goal = {
      id: `goal-${Date.now()}`,
      ...payload,
      current_corpus: 0,
      projected_corpus: projectedCorpus,
      on_track: projectedCorpus >= payload.target_amount,
      completion_pct: 0,
      suggested_allocation: [
        { asset: 'Equity', pct: 60 },
        { asset: 'Mutual Funds', pct: 30 },
        { asset: 'Debt', pct: 10 },
      ],
    };

    const nextGoals = [goal, ...goals];
    writeLocalGoals(nextGoals);
    return goal;
  }

  return requestJson('/portfolio/goals', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export async function fetchStockDetails(ticker: string) {
  const fallbackStock = findMockStock(ticker);

  try {
    const [quote, history, conviction] = await Promise.all([
      requestJson<{
        ticker: string;
        name: string;
        price: number;
        change: number;
        change_pct: number;
      market_cap: number;
        pe_ratio?: number | null;
        week_52_high?: number | null;
        week_52_low?: number | null;
        sector?: string | null;
      }>(`/stocks/quote/${ticker}`),
      requestJson<Array<{ date: string; close: number; volume: number }>>(`/stocks/history/${ticker}?period=1y`),
      requestJson<{ score: number; factors: Record<string, number>; rationale: string; last_updated: string }>(`/stocks/conviction/${ticker}`),
    ]);

    const target12m = fallbackStock.target12m || Number((quote.price * (1 + (conviction.score - 5) * 0.08)).toFixed(2));
    const stock = {
      ...fallbackStock,
      id: quote.ticker,
      ticker: quote.ticker,
      name: quote.name || fallbackStock.name,
      price: quote.price,
      change: quote.change,
      changePct: quote.change_pct,
      marketCap: normalizeToCrores(quote.market_cap) || fallbackStock.marketCap,
      sector: quote.sector || fallbackStock.sector,
      pe: quote.pe_ratio ?? fallbackStock.pe,
      high52w: quote.week_52_high ?? fallbackStock.high52w,
      low52w: quote.week_52_low ?? fallbackStock.low52w,
      convictionScore: conviction.score,
      target12m,
      upside: quote.price ? Number((((target12m - quote.price) / quote.price) * 100).toFixed(1)) : fallbackStock.upside,
      description: conviction.rationale || fallbackStock.description,
    };

    return {
      stock,
      history: history.map((point) => ({
        date: point.date,
        price: point.close,
        volume: point.volume,
      })),
      conviction,
      breakdown: buildConvictionBreakdown(conviction.factors),
    };
  } catch {
    return {
      stock: fallbackStock,
      history: [],
      conviction: {
        score: fallbackStock.convictionScore,
        factors: undefined,
        rationale: fallbackStock.description,
      },
      breakdown: buildConvictionBreakdown(),
    };
  }
}

export async function fetchDcf(ticker: string, wacc: number, growthYears: number) {
  try {
    return await requestJson<{
      intrinsic_value_per_share: number;
      enterprise_value: number;
      equity_value: number;
      pv_fcfs: number;
      pv_terminal: number;
      terminal_value: number;
      scenarios: { bear: number; base: number; bull: number };
      assumptions: { wacc: number; revenue_growth_rate: number; terminal_growth_rate: number; projection_years: number };
      current_price: number;
      upside_pct: number | null;
      recommendation: string;
      projected_fcfs: Array<{ year: number; fcf: number; pv: number; growth_rate: number }>;
    }>(`/dcf/${ticker}?wacc=${wacc.toFixed(3)}&growth_years=${growthYears}`);
  } catch {
    return null;
  }
}

export async function fetchHeatmap() {
  const tickers = mockHeatmapData.map((stock) => stock.ticker).join(',');

  try {
    const quotes = await requestJson<Array<{ ticker: string; change_pct: number; market_cap: number }>>(`/stocks/heatmap?tickers=${encodeURIComponent(tickers)}`);
    const quoteMap = new Map(quotes.map((quote) => [quote.ticker, quote]));
    return mockHeatmapData.map((stock) => ({
      ...stock,
      change: quoteMap.get(stock.ticker)?.change_pct ?? stock.change,
      marketCap: normalizeToCrores(quoteMap.get(stock.ticker)?.market_cap) || stock.marketCap,
    }));
  } catch {
    return mockHeatmapData;
  }
}

export async function fetchMutualFunds(category: string) {
  const categoryMap: Record<string, string> = {
    All: 'index',
    'Flexi Cap': 'flexi_cap',
    'Large Cap': 'large_cap',
    'Large & Mid Cap': 'mid_cap',
    'Small Cap': 'small_cap',
    ELSS: 'elss',
    Debt: 'index',
  };

  const fallbackPool = category === 'All'
    ? mockMutualFunds
    : mockMutualFunds.filter((fund) => fund.category === category);

  try {
    const funds = await requestJson<Array<{
      ticker: string;
      name: string;
      nav: number;
      change_pct: number;
      aum?: number | null;
      expense_ratio?: number | null;
      returns_1y?: number | null;
    }>>(`/mutual-funds?category=${categoryMap[category] ?? 'index'}`);

    return funds.map((fund, index) => {
      const fallback = fallbackPool[index % Math.max(1, fallbackPool.length)] ?? mockMutualFunds[index % mockMutualFunds.length];
      return {
        ...fallback,
        id: fund.ticker,
        name: fund.name || fallback.name,
        aum: fund.aum ?? fallback.aum,
        returns1y: fund.returns_1y ?? fallback.returns1y,
        expenseRatio: fund.expense_ratio ? Number((fund.expense_ratio * 100).toFixed(2)) : fallback.expenseRatio,
      };
    });
  } catch {
    return fallbackPool.length ? fallbackPool : mockMutualFunds;
  }
}

export async function fetchSipProjection(monthlyAmount: number, expectedReturn: number, tenureYears: number) {
  try {
    const projection = await requestJson<{
      total_invested: number;
      future_value: number;
      total_returns: number;
      wealth_gain_pct: number;
    }>(`/mutual-funds/sip-calculator?monthly_amount=${monthlyAmount}&expected_return=${expectedReturn.toFixed(3)}&tenure_years=${tenureYears}`);

    return {
      totalInvested: projection.total_invested,
      futureValue: projection.future_value,
      totalReturns: projection.total_returns,
      wealthGainPct: projection.wealth_gain_pct,
    };
  } catch {
    return calculateSipProjection(monthlyAmount, expectedReturn, tenureYears);
  }
}

// ── Watchlist ──────────────────────────────────────────────────────────────

const MOCK_WATCHLIST = [
  { id: 'w1', ticker: 'IDEAFORGE', name: 'IdeaForge Technologies', price: 842, change: 2.62, changePct: 2.62, sector: 'Defence',  convictionScore: 9.1, notes: '' },
  { id: 'w2', ticker: 'HAL',       name: 'Hindustan Aeronautics',  price: 4200, change: -1.08, changePct: -1.08, sector: 'Defence', convictionScore: 8.7, notes: 'Watching for Q4 results' },
  { id: 'w3', ticker: 'RELIANCE',  name: 'Reliance Industries',    price: 2920, change: 0.83, changePct: 0.83, sector: 'Energy',   convictionScore: 7.8, notes: '' },
  { id: 'w4', ticker: 'BAJFINANCE',name: 'Bajaj Finance',          price: 7820, change: 3.24, changePct: 3.24, sector: 'NBFC',    convictionScore: 8.2, notes: 'Alert set at ₹8,000' },
];

const MOCK_ALERTS = [
  { id: 'a1', ticker: 'HAL',       condition: 'above',      threshold: 4500, active: true,  triggered: false },
  { id: 'a2', ticker: 'BAJFINANCE',condition: 'above',      threshold: 8000, active: true,  triggered: false },
  { id: 'a3', ticker: 'RELIANCE',  condition: 'below',      threshold: 2700, active: true,  triggered: false },
  { id: 'a4', ticker: 'IDEAFORGE', condition: 'pct_change', threshold: 10,   active: false, triggered: true  },
];

export async function fetchWatchlist(token?: string | null) {
  if (!token) return MOCK_WATCHLIST;
  try {
    return await requestJson<typeof MOCK_WATCHLIST>('/watchlist/', { token });
  } catch {
    return MOCK_WATCHLIST;
  }
}

export async function addToWatchlist(ticker: string, notes: string, token?: string | null) {
  if (!token) {
    return { id: `w${Date.now()}`, ticker: ticker.toUpperCase(), notes };
  }
  try {
    return await requestJson('/watchlist/', { method: 'POST', token, body: JSON.stringify({ ticker, notes }) });
  } catch {
    return { id: `w${Date.now()}`, ticker: ticker.toUpperCase(), notes };
  }
}

export async function removeFromWatchlist(ticker: string, token?: string | null) {
  if (!token) return;
  try {
    await requestJson(`/watchlist/${ticker}`, { method: 'DELETE', token });
  } catch {
    // ignore
  }
}

export async function fetchAlerts(token?: string | null) {
  if (!token) return MOCK_ALERTS;
  try {
    return await requestJson<typeof MOCK_ALERTS>('/alerts', { token });
  } catch {
    return MOCK_ALERTS;
  }
}

export async function createAlert(ticker: string, condition: string, threshold: number, token?: string | null) {
  if (!token) {
    return { id: `a${Date.now()}`, ticker, condition, threshold, active: true, triggered: false };
  }
  try {
    return await requestJson('/alerts', { method: 'POST', token, body: JSON.stringify({ ticker, condition, threshold }) });
  } catch {
    return { id: `a${Date.now()}`, ticker, condition, threshold, active: true, triggered: false };
  }
}

export async function toggleAlert(alertId: string, active: boolean, token?: string | null) {
  if (!token) return;
  try {
    return await requestJson(`/alerts/${alertId}`, { method: 'PATCH', token, body: JSON.stringify({ active }) });
  } catch {
    // ignore
  }
}

export async function deleteAlert(alertId: string, token?: string | null) {
  if (!token) return;
  try {
    await requestJson(`/alerts/${alertId}`, { method: 'DELETE', token });
  } catch {
    // ignore
  }
}

// ── Research ───────────────────────────────────────────────────────────────

export async function fetchResearchReports(token?: string | null) {
  if (!token) {
    return mockResearchReports;
  }
  try {
    const reports = await requestJson<Array<{
      id: string;
      title: string;
      sector: string;
      ticker?: string | null;
      report_type: string;
      confidence: number;
      published_at: string;
      tags: string[];
    }>>('/research/', { token });
    return reports.map((report, index) => ({
      id: report.id,
      title: report.title,
      date: new Date(report.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      stocksCovered: report.ticker ? [report.ticker] : report.tags.filter((tag) => tag.length <= 12).slice(0, 5),
      theme: report.sector.split('/')[0].trim() || report.report_type,
      confidence: report.confidence,
      downloads: 1200 + index * 420,
      shares: 280 + index * 120,
    }));
  } catch {
    return mockResearchReports;
  }
}

// ── Leaderboard ────────────────────────────────────────────────────────────

export async function fetchLeaderboard(token?: string | null) {
  if (!token) {
    return mockLeaderboard;
  }
  try {
    const entries = await requestJson<Array<{
      rank: number;
      display_name: string;
      returns_pct: number;
      portfolio_value: number;
      is_user: boolean;
    }>>('/leaderboard/', { token });
    return entries.map((entry, index) => ({
      rank: entry.rank,
      username: entry.display_name,
      xirr: entry.returns_pct,
      portfolioValue: entry.portfolio_value,
      percentile: Math.max(1, 100 - index * 2),
      followers: Math.max(8, 380 - index * 37),
      isUser: entry.is_user,
    }));
  } catch {
    return mockLeaderboard;
  }
}

// ── Family ─────────────────────────────────────────────────────────────────

export async function fetchFamilyAggregate(token?: string | null) {
  if (!token) return null;
  try {
    const aggregate = await requestJson<{
      total_value: number;
      total_invested: number;
      total_pnl: number;
      pnl_pct: number;
      members: Array<{
        id: string;
        name: string;
        relation: string;
        total_value: number;
        total_invested: number;
        total_pnl: number;
        pnl_pct: number;
        xirr: number;
        color: string;
        invite_status: string;
      }>;
    }>('/family/aggregate', { token });
    return {
      totalValue: aggregate.total_value,
      totalInvested: aggregate.total_invested,
      totalPnl: aggregate.total_pnl,
      pnlPct: aggregate.pnl_pct,
      members: aggregate.members.map((member) => ({
        id: member.id,
        name: member.name,
        relation: member.relation,
        portfolio: member.total_value,
        invested: member.total_invested,
        gain: member.pnl_pct,
        xirr: member.xirr,
        color: member.color,
        status: member.invite_status,
      })),
    };
  } catch {
    return null;
  }
}

export async function addFamilyMember(payload: {
  name: string;
  relation: string;
  phone?: string;
  email?: string;
}, token?: string | null) {
  return requestJson('/family/members', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

// ── CA Portal ──────────────────────────────────────────────────────────────

export async function fetchCaClients(token?: string | null) {
  if (!token) return null;
  try {
    return await requestJson<Array<{
      id: string;
      name: string;
      pan: string;
      email?: string | null;
      filing_status: 'PENDING' | 'IN_PROGRESS' | 'FILED' | 'OVERDUE';
      tax_year: string;
      total_gains: number;
      total_tax: number;
      last_updated: string;
    }>>('/ca/clients', { token });
  } catch {
    return null;
  }
}

export async function fetchBrokerAccounts(token?: string | null) {
  if (!token) return null;
  try {
    return await requestJson<Array<{
      id: string | null;
      broker: string;
      status: string;
      access_mode: string;
      holdings_synced: number;
      last_sync_at: string | null;
      message: string;
    }>>('/broker/connected', { token });
  } catch {
    return null;
  }
}

export async function connectBroker(broker: string, token?: string | null) {
  return requestJson('/broker/connect', {
    method: 'POST',
    token,
    body: JSON.stringify({ broker }),
  });
}

export async function fetchSubscription(token?: string | null) {
  if (!token) return null;
  try {
    return await requestJson<{
      plan: string;
      status: string;
      billing_provider: string;
      payments_configured: boolean;
    }>('/subscriptions/me', { token });
  } catch {
    return null;
  }
}

export async function createCheckoutSession(
  planId: 'premium' | 'pro' | 'enterprise',
  billingCycle: 'monthly' | 'yearly',
  token?: string | null,
) {
  return requestJson<{
    key_id: string;
    order_id: string;
    amount: number;         // paise
    currency: string;
    plan_id: string;
    plan_name: string;
    billing_cycle: string;
    prefill: { name: string; email: string };
  }>('/subscriptions/checkout', {
    method: 'POST',
    token,
    body: JSON.stringify({ plan_id: planId, billing_cycle: billingCycle }),
  });
}

export async function verifyPayment(
  payload: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
    plan_id: string;
  },
  token?: string | null,
) {
  return requestJson<{ plan: string; status: string }>(
    '/subscriptions/verify-payment',
    {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    },
  );
}

export async function cancelSubscription(token?: string | null) {
  return requestJson<{ plan: string; message: string }>(
    '/subscriptions/cancel',
    { method: 'POST', token },
  );
}

// ── Portfolio Health ────────────────────────────────────────────────────────

export function computePortfolioHealth(holdings: Array<{ sector: string; currentValue: number; pnlPct: number }>) {
  if (!holdings.length) return { score: 0, grade: 'N/A', insights: [] };

  const total = holdings.reduce((a, h) => a + h.currentValue, 0);
  const sectors = new Set(holdings.map(h => h.sector)).size;
  const topWeight = Math.max(...Object.values(
    holdings.reduce((acc, h) => {
      acc[h.sector] = (acc[h.sector] || 0) + h.currentValue;
      return acc;
    }, {} as Record<string, number>)
  )) / total * 100;

  const avgReturn = holdings.reduce((a, h) => a + h.pnlPct, 0) / holdings.length;

  let score = 50;
  if (sectors >= 5) score += 20;
  else if (sectors >= 3) score += 10;
  if (topWeight < 30) score += 15;
  else if (topWeight > 60) score -= 10;
  if (avgReturn > 15) score += 15;
  else if (avgReturn > 5) score += 8;
  else if (avgReturn < -10) score -= 10;
  score = Math.max(0, Math.min(100, score));

  const grade = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : 'D';
  const insights: string[] = [];
  if (sectors < 3) insights.push(`Only ${sectors} sector(s) — add more for diversification`);
  if (topWeight > 50) insights.push(`Top sector is ${topWeight.toFixed(0)}% of portfolio — consider trimming`);
  if (avgReturn > 20) insights.push('Strong returns — review if any position is oversized');
  if (insights.length === 0) insights.push('Portfolio looks well balanced');

  return { score, grade, insights };
}

// ── Options Chain ────────────────────────────────────────────────────────────

export async function fetchOptionsChain(symbol: string, expiry: string) {
  try {
    return await requestJson<{
      symbol: string; expiry: string; spot: number; pcr: number;
      max_pain: number; support: number; resistance: number;
      chain: Record<string, unknown>[];
    }>(`/options/chain?symbol=${encodeURIComponent(symbol)}&expiry=${encodeURIComponent(expiry)}`);
  } catch {
    return null;
  }
}

export async function fetchOptionExpiries() {
  try {
    return await requestJson<string[]>('/options/expiries');
  } catch {
    return null;
  }
}

// ── IPO Tracker ──────────────────────────────────────────────────────────────

export async function fetchOpenIPOs() {
  try {
    return await requestJson<Record<string, unknown>[]>('/ipo/open');
  } catch {
    return null;
  }
}

export async function fetchUpcomingIPOs() {
  try {
    return await requestJson<Record<string, unknown>[]>('/ipo/upcoming');
  } catch {
    return null;
  }
}

export async function fetchListedIPOs() {
  try {
    return await requestJson<Record<string, unknown>[]>('/ipo/listed');
  } catch {
    return null;
  }
}

export async function fetchSMEIPOs() {
  try {
    return await requestJson<Record<string, unknown>[]>('/ipo/sme');
  } catch {
    return null;
  }
}

export async function fetchELSSFunds() {
  try {
    return await requestJson<Record<string, unknown>[]>('/ipo/elss');
  } catch {
    return null;
  }
}

// ── Backtesting ──────────────────────────────────────────────────────────────

export interface BacktestPayload {
  strategy: string;
  ticker: string;
  period: string;
  capital: number;
  conditions?: Record<string, unknown>[];
}

export async function runBacktest(payload: BacktestPayload) {
  try {
    return await requestJson<{
      metrics: Record<string, number>;
      equity: { date: string; value: number; benchmark: number }[];
      drawdown: { date: string; drawdown: number }[];
      trades: Record<string, unknown>[];
    }>('/backtest/run', { method: 'POST', body: JSON.stringify(payload) });
  } catch {
    return null;
  }
}

export async function fetchBacktestStrategies() {
  try {
    return await requestJson<{ id: string; name: string; desc: string }[]>('/backtest/strategies');
  } catch {
    return null;
  }
}

// ── Market Data (FII/DII, Indices, Breadth) ────────────────────────────────

export interface FiiDiiRow {
  date:       string;
  fii_buy:    number;
  fii_sell:   number;
  fii_net:    number;
  dii_buy:    number;
  dii_sell:   number;
  dii_net:    number;
  total_net:  number;
  sentiment:  string;
}

export interface MarketBreadth {
  total:          number;
  advances:       number;
  declines:       number;
  unchanged:      number;
  ad_ratio:       number;
  breadth_signal: string;
  top_gainer:     Record<string, unknown> | null;
  top_loser:      Record<string, unknown> | null;
}

export async function fetchFiiDii(days = 30, token?: string | null): Promise<{ data: FiiDiiRow[]; count: number }> {
  try {
    return await requestJson<{ data: FiiDiiRow[]; count: number }>(`/market/fii-dii?days=${days}`, { token });
  } catch {
    return { data: [], count: 0 };
  }
}

export async function fetchFiiDiiSummary(days = 10, token?: string | null) {
  try {
    return await requestJson<{
      days: number;
      fii_net_total: number;
      dii_net_total: number;
      combined_net: number;
      trend: string;
      fii_buy_streak: number;
      last_date: string | null;
    }>(`/market/fii-dii/summary?days=${days}`, { token });
  } catch {
    return null;
  }
}

export async function fetchMarketBreadth(token?: string | null): Promise<MarketBreadth | null> {
  try {
    return await requestJson<MarketBreadth>('/market/breadth', { token });
  } catch {
    return null;
  }
}

export async function fetchTopMovers(type: 'gainers' | 'losers', token?: string | null) {
  try {
    return await requestJson<{ count: number; data: Record<string, unknown>[] }>(
      `/market/top-${type}?limit=5`, { token }
    );
  } catch {
    return { count: 0, data: [] };
  }
}
