// Mock data for StockVision platform

export const mockStocks = [
  {
    id: '1', ticker: 'IDEAFORGE', name: 'IdeaForge Technologies', price: 487.35, change: 12.45, changePct: 2.62,
    marketCap: 1850, sector: 'Defence', pe: 48.2, roce: 14.8, debtEquity: 0.12, promoterHolding: 52.4,
    revenue: 186, revenueGrowth: 34.2, convictionScore: 9.1, target12m: 720, upside: 47.7, risk: 'High',
    high52w: 698, low52w: 312, evEbitda: 32.1, description: 'India\'s first and only listed pure-play drone manufacturer. Defence orders surging post-conflict. First mover advantage in a sector with massive tailwinds.',
    volumeSpike: true, analystRating: 'Buy'
  },
  {
    id: '2', ticker: 'BEL', name: 'Bharat Electronics Ltd', price: 312.60, change: 8.90, changePct: 2.93,
    marketCap: 22850, sector: 'Defence', pe: 41.5, roce: 22.3, debtEquity: 0.0, promoterHolding: 51.1,
    revenue: 15890, revenueGrowth: 18.7, convictionScore: 8.4, target12m: 420, upside: 34.3, risk: 'Medium',
    high52w: 340, low52w: 198, evEbitda: 28.5, description: 'Navratna PSU defence electronics giant. Order book at all-time high. Key beneficiary of Make in India defence push.',
    volumeSpike: true, analystRating: 'Buy'
  },
  {
    id: '3', ticker: 'HAL', name: 'Hindustan Aeronautics', price: 4125.80, change: -45.20, changePct: -1.08,
    marketCap: 138200, sector: 'Defence', pe: 32.8, roce: 28.4, debtEquity: 0.0, promoterHolding: 71.6,
    revenue: 28520, revenueGrowth: 22.1, convictionScore: 8.7, target12m: 5200, upside: 26.1, risk: 'Low',
    high52w: 4900, low52w: 2800, evEbitda: 24.2, description: 'India\'s premier aerospace and defence manufacturer. Massive order pipeline for Tejas fighters and helicopters. Near-zero debt.',
    volumeSpike: false, analystRating: 'Buy'
  },
  {
    id: '4', ticker: 'RELIANCE', name: 'Reliance Industries', price: 2847.50, change: 23.40, changePct: 0.83,
    marketCap: 1924500, sector: 'Energy', pe: 28.4, roce: 10.2, debtEquity: 0.34, promoterHolding: 50.3,
    revenue: 897398, revenueGrowth: 8.4, convictionScore: 7.2, target12m: 3400, upside: 19.4, risk: 'Low',
    high52w: 3024, low52w: 2220, evEbitda: 14.8, description: 'India\'s largest conglomerate. Jio leads telecom, Retail expanding, Green Energy transition underway. Defensive holding with growth optionality.',
    volumeSpike: false, analystRating: 'Hold'
  },
  {
    id: '5', ticker: 'HDFCBANK', name: 'HDFC Bank', price: 1712.30, change: -12.80, changePct: -0.74,
    marketCap: 1302400, sector: 'Banking', pe: 19.8, roce: 14.1, debtEquity: 8.2, promoterHolding: 0.0,
    revenue: 184200, revenueGrowth: 12.3, convictionScore: 7.8, target12m: 2100, upside: 22.6, risk: 'Low',
    high52w: 1880, low52w: 1364, evEbitda: 0, description: 'India\'s largest private bank by assets. Merger integration with HDFC complete. NIMs stabilising, deposit growth accelerating.',
    volumeSpike: false, analystRating: 'Buy'
  },
  {
    id: '6', ticker: 'PARAS',name: 'Paras Defence', price: 892.40, change: 28.60, changePct: 3.31,
    marketCap: 2840, sector: 'Defence', pe: 68.4, roce: 16.2, debtEquity: 0.08, promoterHolding: 58.9,
    revenue: 320, revenueGrowth: 28.4, convictionScore: 8.2, target12m: 1200, upside: 34.5, risk: 'High',
    high52w: 1100, low52w: 580, evEbitda: 45.2, description: 'Niche defence optics and space sector play. Drone detection systems and space imaging are key growth drivers.',
    volumeSpike: true, analystRating: 'Buy'
  },
  {
    id: '7', ticker: 'TCS', name: 'Tata Consultancy Services', price: 3542.10, change: -18.50, changePct: -0.52,
    marketCap: 1298000, sector: 'IT', pe: 28.1, roce: 46.2, debtEquity: 0.0, promoterHolding: 72.3,
    revenue: 240893, revenueGrowth: 4.2, convictionScore: 6.8, target12m: 4200, upside: 18.6, risk: 'Low',
    high52w: 4320, low52w: 3140, evEbitda: 20.4, description: 'India\'s largest IT services company. AI transformation deals accelerating. Margin expansion expected in H2 FY26.',
    volumeSpike: false, analystRating: 'Hold'
  },
  {
    id: '8', ticker: 'MTAR', name: 'MTAR Technologies', price: 1642.75, change: 45.80, changePct: 2.87,
    marketCap: 4890, sector: 'Defence', pe: 82.4, roce: 18.4, debtEquity: 0.14, promoterHolding: 61.2,
    revenue: 412, revenueGrowth: 31.8, convictionScore: 8.0, target12m: 2200, upside: 33.9, risk: 'High',
    high52w: 2100, low52w: 1100, evEbitda: 52.8, description: 'Precision engineering for space, nuclear and defence. ISRO supplier. Rising defence indigenisation drives order book growth.',
    volumeSpike: true, analystRating: 'Buy'
  },
];

export const mockMutualFunds = [
  {
    id: '1', name: 'Quant Flexi Cap Fund', amc: 'Quant', category: 'Flexi Cap', aum: 8420,
    returns1y: 42.8, returns3y: 28.4, returns5y: 24.2, expenseRatio: 0.59, fundManager: 'Ankit Pande',
    managerTenure: 4.2, turnoverRatio: 312, rating: 5,
    topHoldings: ['Reliance', 'HDFC Bank', 'ITC', 'SBI', 'Infosys'],
  },
  {
    id: '2', name: 'Parag Parikh Flexi Cap', amc: 'PPFAS', category: 'Flexi Cap', aum: 72840,
    returns1y: 28.4, returns3y: 22.1, returns5y: 19.8, expenseRatio: 0.57, fundManager: 'Rajeev Thakkar',
    managerTenure: 12.1, turnoverRatio: 18, rating: 5,
    topHoldings: ['Bajaj Holdings', 'ITC', 'HCL Tech', 'Alphabet', 'Amazon'],
  },
  {
    id: '3', name: 'Mirae Emerging Bluechip', amc: 'Mirae', category: 'Large & Mid Cap', aum: 32100,
    returns1y: 32.1, returns3y: 24.8, returns5y: 22.4, expenseRatio: 0.66, fundManager: 'Neelesh Surana',
    managerTenure: 9.8, turnoverRatio: 24, rating: 5,
    topHoldings: ['HDFC Bank', 'Reliance', 'Infosys', 'ICICI Bank', 'Tata Motors'],
  },
  {
    id: '4', name: 'SBI Small Cap Fund', amc: 'SBI', category: 'Small Cap', aum: 28400,
    returns1y: 38.2, returns3y: 31.4, returns5y: 28.8, expenseRatio: 0.72, fundManager: 'R. Srinivasan',
    managerTenure: 7.3, turnoverRatio: 42, rating: 4,
    topHoldings: ['Blue Star', 'Craftsman Auto', 'Elgi Equipments', 'Safari Industries', 'KNR Constructions'],
  },
  {
    id: '5', name: 'Axis Bluechip Fund', amc: 'Axis', category: 'Large Cap', aum: 45200,
    returns1y: 18.4, returns3y: 12.2, returns5y: 14.8, expenseRatio: 0.55, fundManager: 'Shreyash Devalkar',
    managerTenure: 6.8, turnoverRatio: 31, rating: 3,
    topHoldings: ['Infosys', 'TCS', 'HDFC Bank', 'Bajaj Finance', 'Avenue Supermarts'],
  },
];

export const mockPortfolio = {
  totalValue: 4842310,
  totalInvested: 3920000,
  totalPnl: 922310,
  totalPnlPct: 23.5,
  xirr: 18.4,
  brokers: [
    { name: 'Zerodha', value: 2840200, holdings: 12, color: '#4f46e5' },
    { name: 'Groww', value: 1142800, holdings: 8, color: '#7c3aed' },
    { name: 'Angel One', value: 859310, holdings: 6, color: '#06b6d4' },
  ],
  holdings: [
    { ticker: 'HAL', name: 'Hindustan Aeronautics', qty: 50, avgPrice: 3420, currentPrice: 4125.80, broker: 'Zerodha', sector: 'Defence', pnl: 35290, pnlPct: 20.6 },
    { ticker: 'RELIANCE', name: 'Reliance Industries', qty: 200, avgPrice: 2420, currentPrice: 2847.50, broker: 'Zerodha', sector: 'Energy', pnl: 85500, pnlPct: 17.6 },
    { ticker: 'HDFCBANK', name: 'HDFC Bank', qty: 300, avgPrice: 1480, currentPrice: 1712.30, broker: 'Groww', sector: 'Banking', pnl: 69690, pnlPct: 15.7 },
    { ticker: 'TCS', name: 'TCS', qty: 100, avgPrice: 3120, currentPrice: 3542.10, broker: 'Angel One', sector: 'IT', pnl: 42210, pnlPct: 13.5 },
    { ticker: 'BEL', name: 'Bharat Electronics', qty: 1000, avgPrice: 240, currentPrice: 312.60, broker: 'Zerodha', sector: 'Defence', pnl: 72600, pnlPct: 30.25 },
    { ticker: 'IDEAFORGE', name: 'IdeaForge Technologies', qty: 200, avgPrice: 380, currentPrice: 487.35, broker: 'Groww', sector: 'Defence', pnl: 21470, pnlPct: 28.25 },
  ],
};

export const mockNews = [
  { id: '1', headline: 'HAL bags ₹26,000 crore order for 156 Prachand light combat helicopters', source: 'Business Standard', time: '2h ago', sentiment: 'Positive', sector: 'Defence', ticker: 'HAL' },
  { id: '2', headline: 'RBI keeps repo rate unchanged at 6.25%, maintains accommodative stance', source: 'Bloomberg India', time: '3h ago', sentiment: 'Neutral', sector: 'Banking', ticker: null },
  { id: '3', headline: 'IdeaForge secures army contract for 100 drones in ₹840 crore deal', source: 'Moneycontrol', time: '4h ago', sentiment: 'Positive', sector: 'Defence', ticker: 'IDEAFORGE' },
  { id: '4', headline: 'IT sector faces headwinds as US visa uncertainty clouds hiring outlook', source: 'Economic Times', time: '5h ago', sentiment: 'Negative', sector: 'IT', ticker: null },
  { id: '5', headline: 'SEBI approves new framework for algo trading by retail investors', source: 'Business Standard', time: '6h ago', sentiment: 'Positive', sector: 'Market', ticker: null },
  { id: '6', headline: 'Reliance Jio adds 8.2 million subscribers in Q4, leads market share gains', source: 'Bloomberg India', time: '8h ago', sentiment: 'Positive', sector: 'Telecom', ticker: 'RELIANCE' },
];

export const mockTaxData = {
  stcgTax: 18240,
  ltcgTax: 9840,
  stcgGains: 91200,
  ltcgGains: 78720,
  stcgLosses: 12400,
  ltcgLosses: 0,
  netStcg: 78800,
  netLtcg: 78720,
  taxSaved: 4960,
  harvestingSuggestions: [
    { ticker: 'PAYTM', name: 'One 97 Communications', loss: -18420, taxSaving: 3684, deadline: 'Mar 31' },
    { ticker: 'NYKAA', name: 'FSN E-Commerce', loss: -8240, taxSaving: 1648, deadline: 'Mar 31' },
  ],
};

export const mockLeaderboard = [
  { rank: 1, username: 'Bull_7829', xirr: 84.2, portfolioValue: 12400000, percentile: 99.8, followers: 342 },
  { rank: 2, username: 'Alpha_4421', xirr: 72.8, portfolioValue: 8900000, percentile: 99.5, followers: 218 },
  { rank: 3, username: 'DeepValue_92', xirr: 68.4, portfolioValue: 24000000, percentile: 99.2, followers: 198 },
  { rank: 4, username: 'Momentum_18', xirr: 64.1, portfolioValue: 5600000, percentile: 99.0, followers: 156 },
  { rank: 5, username: 'SmallCap_77', xirr: 58.9, portfolioValue: 3200000, percentile: 98.7, followers: 134 },
  { rank: 12, username: 'You (Nitesh_R)', xirr: 18.4, portfolioValue: 4842310, percentile: 88, followers: 12, isUser: true },
];

export const mockResearchReports = [
  { id: '1', title: 'Operation Sindoor: Defence Sector Tailwind — Top 10 Stocks', date: 'May 8, 2026', stocksCovered: ['IDEAFORGE', 'BEL', 'HAL', 'MTAR', 'PARAS'], theme: 'Defence', confidence: 9.1, downloads: 2840, shares: 1240 },
  { id: '2', title: 'Budget 2026 Winners: Infrastructure & PSU Plays', date: 'Feb 2, 2026', stocksCovered: ['NTPC', 'POWERGRID', 'IRFC', 'L&T', 'CESC'], theme: 'Budget', confidence: 8.4, downloads: 1920, shares: 892 },
  { id: '3', title: 'Reliance Industries DCF Analysis — Undervalued?', date: 'Apr 15, 2026', stocksCovered: ['RELIANCE'], theme: 'Valuation', confidence: 7.8, downloads: 3240, shares: 1480 },
  { id: '4', title: 'PSU Banking Sector Rotation — Q4 Earnings Preview', date: 'Mar 28, 2026', stocksCovered: ['SBI', 'BOB', 'PNB', 'CANBK'], theme: 'Sector Rotation', confidence: 7.2, downloads: 1480, shares: 640 },
];

export const mockMarketIndices = [
  { name: 'NIFTY 50', value: 24842.65, change: 184.30, changePct: 0.75 },
  { name: 'SENSEX', value: 81426.80, change: 612.45, changePct: 0.76 },
  { name: 'NIFTY IT', value: 38420.15, change: -284.60, changePct: -0.74 },
  { name: 'BANK NIFTY', value: 53218.40, change: -124.80, changePct: -0.23 },
  { name: 'NIFTY DEFENCE', value: 7824.35, change: 284.90, changePct: 3.78 },
];

export const mockHeatmapData = [
  { ticker: 'RELIANCE', name: 'Reliance', change: 0.83, marketCap: 1924500, sector: 'Energy', volumeSpike: false },
  { ticker: 'TCS', name: 'TCS', change: -0.52, marketCap: 1298000, sector: 'IT', volumeSpike: false },
  { ticker: 'HDFCBANK', name: 'HDFC Bank', change: -0.74, marketCap: 1302400, sector: 'Banking', volumeSpike: false },
  { ticker: 'INFY', name: 'Infosys', change: -1.24, marketCap: 615000, sector: 'IT', volumeSpike: false },
  { ticker: 'ICICIBANK', name: 'ICICI Bank', change: 1.12, marketCap: 842000, sector: 'Banking', volumeSpike: false },
  { ticker: 'HINDUNILVR', name: 'HUL', change: -0.34, marketCap: 480000, sector: 'FMCG', volumeSpike: false },
  { ticker: 'ITC', name: 'ITC', change: 0.92, marketCap: 520000, sector: 'FMCG', volumeSpike: false },
  { ticker: 'SBIN', name: 'SBI', change: 1.84, marketCap: 680000, sector: 'Banking', volumeSpike: true },
  { ticker: 'WIPRO', name: 'Wipro', change: -1.84, marketCap: 258000, sector: 'IT', volumeSpike: false },
  { ticker: 'HAL', name: 'HAL', change: -1.08, marketCap: 138200, sector: 'Defence', volumeSpike: false },
  { ticker: 'BEL', name: 'BEL', change: 2.93, marketCap: 22850, sector: 'Defence', volumeSpike: true },
  { ticker: 'IDEAFORGE', name: 'IdeaForge', change: 2.62, marketCap: 1850, sector: 'Defence', volumeSpike: true },
  { ticker: 'TATAMOTORS', name: 'Tata Motors', change: 2.14, marketCap: 268000, sector: 'Auto', volumeSpike: false },
  { ticker: 'M&M', name: 'M&M', change: 0.48, marketCap: 320000, sector: 'Auto', volumeSpike: false },
  { ticker: 'SUNPHARMA', name: 'Sun Pharma', change: 0.82, marketCap: 298000, sector: 'Pharma', volumeSpike: false },
  { ticker: 'DRREDDY', name: 'Dr Reddy', change: -0.92, marketCap: 95000, sector: 'Pharma', volumeSpike: false },
  { ticker: 'ASIANPAINT', name: 'Asian Paints', change: -2.14, marketCap: 215000, sector: 'FMCG', volumeSpike: false },
  { ticker: 'BAJFINANCE', name: 'Bajaj Finance', change: 3.24, marketCap: 425000, sector: 'NBFC', volumeSpike: true },
  { ticker: 'NTPC', name: 'NTPC', change: 1.48, marketCap: 342000, sector: 'Energy', volumeSpike: false },
  { ticker: 'POWERGRID', name: 'PowerGrid', change: 0.94, marketCap: 248000, sector: 'Energy', volumeSpike: false },
];

export const generateChartData = (days: number = 90, basePrice: number = 487) => {
  const data = [];
  let price = basePrice * 0.7;
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    price = price * (1 + (Math.random() - 0.46) * 0.025);
    data.push({
      date: date.toISOString().split('T')[0],
      price: parseFloat(price.toFixed(2)),
      volume: Math.floor(Math.random() * 2000000) + 500000,
    });
  }
  return data;
};
