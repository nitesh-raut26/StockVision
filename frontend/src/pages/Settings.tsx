import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, RefreshCw, Bell, CreditCard, Shield, CheckCircle, AlertCircle, Trash2, Plus, Eye, EyeOff, Key, X, Sun, Moon, Monitor, Zap, Copy, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from '../hooks/useTheme';
import { useIsMobile } from '../hooks/useBreakpoint';
import { connectBroker, fetchBrokerAccounts, fetchSubscription, createCheckoutSession, verifyPayment, cancelSubscription, fetchAlerts, createAlert, toggleAlert, deleteAlert } from '../lib/api';
import { useStore } from '../store/useStore';

const brokers = [
  { id: 'zerodha',  name: 'Zerodha',     color: '#387ED1', connected: true,  lastSync: '2 min ago',  holdings: 14 },
  { id: 'groww',    name: 'Groww',       color: '#00D09C', connected: true,  lastSync: '5 min ago',  holdings: 8  },
  { id: 'upstox',   name: 'Upstox',      color: '#5367FF', connected: false, lastSync: null,         holdings: 0  },
  { id: 'angelone', name: 'Angel One',   color: '#F04E23', connected: true,  lastSync: '12 min ago', holdings: 6  },
  { id: 'icici',    name: 'ICICI Direct',color: '#F7941D', connected: false, lastSync: null,         holdings: 0  },
];

const alertTypes = [
  { id: 'price',  label: 'Price Target Hit', description: 'Alert when stock crosses your target price' },
  { id: 'pct',   label: '% Move Alert',     description: 'Alert on intraday move exceeding threshold' },
  { id: 'volume',label: 'Volume Spike',     description: 'Alert when volume is 3x the 20-day average' },
  { id: 'news',  label: 'News & Events',    description: 'Alert on earnings, results, corporate actions' },
];

const sessions = [
  { device: 'MacBook Pro (Chrome)',  location: 'Mumbai, India', lastActive: 'Active now',  current: true  },
  { device: 'iPhone 14 (Safari)',   location: 'Mumbai, India', lastActive: '2h ago',       current: false },
  { device: 'Windows PC (Chrome)', location: 'Pune, India',   lastActive: '3 days ago',   current: false },
];

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <button
    role="switch" aria-checked={checked} onClick={onChange}
    style={{ width: 44, height: 24, borderRadius: 12, background: checked ? 'var(--brand)' : 'rgba(255,255,255,0.1)', position: 'relative', cursor: 'pointer', border: 'none', transition: 'background 200ms', flexShrink: 0 }}
  >
    <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: checked ? 23 : 3, transition: 'left 200ms' }} />
  </button>
);

export default function Settings() {
  const { authToken, updateUser } = useStore();
  const queryClient = useQueryClient();
  const [brokerList, setBrokerList] = useState(brokers);
  const [syncing, setSyncing] = useState<string | null>(null);
  // New Alert modal
  const [showNewAlert,    setShowNewAlert]    = useState(false);
  const [newAlertTicker,  setNewAlertTicker]  = useState('');
  const [newAlertCond,    setNewAlertCond]    = useState<'above' | 'below' | 'pct_change'>('above');
  const [newAlertThresh,  setNewAlertThresh]  = useState('');
  const [newAlertError,   setNewAlertError]   = useState<string | null>(null);
  const [biometric, setBiometric] = useState(true);
  const [twoFA, setTwoFA] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedKey,  setCopiedKey]  = useState(false);
  const [activeTab, setActiveTab] = useState<'brokers' | 'appearance' | 'alerts' | 'subscription' | 'security'>('brokers');

  // Account deletion state
  const [showDeleteModal,  setShowDeleteModal]  = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteReason,     setDeleteReason]     = useState('');
  const [deletingAccount,  setDeletingAccount]  = useState(false);
  const [deleteError,      setDeleteError]      = useState<string | null>(null);

  // Razorpay checkout state
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [paySuccess, setPaySuccess] = useState<string | null>(null); // plan label shown in success modal

  const PLANS: Record<string, { label: string; price: string; period: string; color: string; annual: string; savings: string }> = {
    premium:    { label: 'Premium',    price: '₹299',   period: '/mo', color: 'var(--brand)',  annual: '₹2,990/yr',  savings: 'Save ₹598'   },
    pro:        { label: 'Pro',        price: '₹999',   period: '/mo', color: '#5367ff',       annual: '₹9,990/yr',  savings: 'Save ₹1,998' },
    enterprise: { label: 'Enterprise', price: '₹1,999', period: '/mo', color: '#a78bfa',       annual: '₹19,990/yr', savings: 'Save ₹3,998' },
  };

  const openCheckout = async (plan: 'premium' | 'pro' | 'enterprise', billingCycle: 'monthly' | 'yearly' = 'monthly') => {
    if (checkoutLoadingPlan) return;
    setCheckoutLoadingPlan(plan);
    setCheckoutError(null);

    try {
      const session = await createCheckoutSession(plan, billingCycle, authToken);

      const rzp = new window.Razorpay({
        key: session.key_id,
        order_id: session.order_id,
        amount: session.amount,
        currency: session.currency,
        name: 'StockVision',
        description: `${session.plan_name} Plan · ${billingCycle === 'yearly' ? 'Annual' : 'Monthly'}`,
        prefill: session.prefill,
        theme: { color: '#f47520' },
        modal: {
          ondismiss: () => setCheckoutLoadingPlan(null),
        },
        handler: async (response) => {
          try {
            const result = await verifyPayment(
              {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                plan_id: plan,
              },
              authToken,
            );
            updateUser({ plan: result.plan as 'free' | 'premium' | 'pro' | 'enterprise' });
            queryClient.invalidateQueries({ queryKey: ['subscription'] });
            setCheckoutLoadingPlan(null);
            setPaySuccess(PLANS[plan]?.label ?? plan);
          } catch {
            setCheckoutLoadingPlan(null);
            setCheckoutError('Payment verified but plan update failed. Contact support with your payment ID.');
          }
        },
      });

      setCheckoutLoadingPlan(null);
      rzp.open();
    } catch (err) {
      setCheckoutLoadingPlan(null);
      setCheckoutError(err instanceof Error ? err.message : 'Could not initiate checkout — please try again.');
    }
  };

  const handleCancelSubscription = async () => {
    if (!authToken) return;
    try {
      const result = await cancelSubscription(authToken);
      updateUser({ plan: result.plan as 'free' });
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    } catch {
      setCheckoutError('Could not cancel subscription. Please try again.');
    }
  };

  const { logout } = useStore();

  const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE MY ACCOUNT') {
      setDeleteError("Type 'DELETE MY ACCOUNT' exactly to confirm.");
      return;
    }
    setDeletingAccount(true);
    setDeleteError(null);
    try {
      const resp = await fetch(`${API_BASE}/compliance/account`, {
        method:      'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ confirm_text: deleteConfirmText, reason: deleteReason || 'User-initiated deletion' }),
      });
      if (!resp.ok) {
        const e = await resp.json();
        setDeleteError(e.detail ?? 'Account deletion failed. Please contact support.');
        setDeletingAccount(false);
        return;
      }
      logout();
      window.location.href = '/';
    } catch {
      setDeleteError('Network error — please try again or contact support@stockvision.in');
      setDeletingAccount(false);
    }
  };

  const { theme, setTheme, isDark } = useTheme();
  const isMobile = useIsMobile();
  const brokerAccountsQuery = useQuery({
    queryKey: ['broker-accounts', authToken],
    queryFn: () => fetchBrokerAccounts(authToken),
  });
  const subscriptionQuery = useQuery({
    queryKey: ['subscription', authToken],
    queryFn: () => fetchSubscription(authToken),
  });

  // ── Alerts (real API) ──────────────────────────────────────────
  const alertsQuery = useQuery({
    queryKey: ['alerts', authToken],
    queryFn:  () => fetchAlerts(authToken),
    enabled:  activeTab === 'alerts',
  });
  const apiAlerts = alertsQuery.data ?? [];

  const toggleAlertMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      toggleAlert(id, active, authToken),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });
  const deleteAlertMutation = useMutation({
    mutationFn: (id: string) => deleteAlert(id, authToken),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });
  const createAlertMutation = useMutation({
    mutationFn: ({ ticker, condition, threshold }: { ticker: string; condition: string; threshold: number }) =>
      createAlert(ticker, condition, threshold, authToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setShowNewAlert(false);
      setNewAlertTicker('');
      setNewAlertThresh('');
      setNewAlertError(null);
    },
    onError: () => setNewAlertError('Failed to create alert. Please try again.'),
  });

  const handleCreateAlert = () => {
    const ticker = newAlertTicker.trim().toUpperCase();
    const threshold = parseFloat(newAlertThresh);
    if (!ticker)            { setNewAlertError('Enter a ticker symbol.'); return; }
    if (isNaN(threshold) || threshold <= 0) { setNewAlertError('Enter a valid threshold (positive number).'); return; }
    setNewAlertError(null);
    createAlertMutation.mutate({ ticker, condition: newAlertCond, threshold });
  };

  const connectMutation = useMutation({
    mutationFn: (id: string) => connectBroker(id, authToken),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['broker-accounts'] }),
  });
  const brokerColor: Record<string, string> = {
    zerodha: '#387ED1',
    groww: '#00D09C',
    upstox: '#5367FF',
    angelone: '#F04E23',
    icici: '#F7941D',
  };
  const brokerName: Record<string, string> = {
    zerodha: 'Zerodha',
    groww: 'Groww',
    upstox: 'Upstox',
    angelone: 'Angel One',
    icici: 'ICICI Direct',
  };
  const displayBrokers = brokerAccountsQuery.data?.map(account => ({
    id: account.broker,
    name: brokerName[account.broker] ?? account.broker,
    color: brokerColor[account.broker] ?? 'var(--brand)',
    connected: account.status === 'connected',
    lastSync: account.last_sync_at ? new Date(account.last_sync_at).toLocaleString('en-IN') : account.status.replaceAll('_', ' '),
    holdings: account.holdings_synced,
    message: account.message,
  })) ?? brokerList;
  const subscription = subscriptionQuery.data;

  const handleSync = (id: string) => { setSyncing(id); setTimeout(() => setSyncing(null), 2000); };
  const handleDisconnect = (id: string) => setBrokerList(prev => prev.map(b => b.id === id ? { ...b, connected: false, lastSync: null, holdings: 0 } : b));
  const handleConnect = (id: string) => {
    if (authToken) {
      connectMutation.mutate(id);
      return;
    }
    setBrokerList(prev => prev.map(b => b.id === id ? { ...b, connected: true, lastSync: 'Just now', holdings: Math.floor(Math.random() * 10) + 3 } : b));
  };

  const tabs = [
    { id: 'brokers' as const,      label: 'Broker Hub',   icon: Link2      },
    { id: 'appearance' as const,   label: 'Appearance',   icon: Monitor    },
    { id: 'alerts' as const,       label: 'Price Alerts', icon: Bell       },
    { id: 'subscription' as const, label: 'Subscription', icon: CreditCard },
    { id: 'security' as const,     label: 'Security',     icon: Shield     },
  ];

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 860 }}>

      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx)', letterSpacing: '-0.02em', marginBottom: 4 }}>Settings</h1>
        <p style={{ fontSize: 13.5, color: 'var(--tx-3)' }}>Manage your brokers, alerts, subscription, and account security</p>
      </div>

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 1, overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: '8px 8px 0 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', borderTop: activeTab === tab.id ? '1px solid var(--border-brand)' : '1px solid transparent', borderRight: activeTab === tab.id ? '1px solid var(--border-brand)' : '1px solid transparent', borderBottom: 'none', borderLeft: activeTab === tab.id ? '1px solid var(--border-brand)' : '1px solid transparent', background: activeTab === tab.id ? 'var(--brand-dim)' : 'transparent', color: activeTab === tab.id ? 'var(--brand)' : 'var(--tx-3)', flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            <tab.icon size={13} />{tab.label}
          </button>
        ))}
      </div>

      {/* ── APPEARANCE ── */}
      {activeTab === 'appearance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Theme selector */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 4 }}>Theme</h3>
            <p style={{ fontSize: 13, color: 'var(--tx-3)', marginBottom: 20 }}>Choose how StockVision looks. Your preference is saved automatically.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Dark card */}
              <button
                onClick={() => setTheme('dark')}
                style={{
                  border: `2px solid ${isDark ? 'var(--brand)' : 'var(--border-md)'}`,
                  borderRadius: 'var(--r-md)',
                  background: isDark ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                  cursor: 'pointer',
                  padding: 0,
                  overflow: 'hidden',
                  textAlign: 'left',
                  transition: 'all 200ms',
                }}
              >
                {/* Mini dark UI preview */}
                <div style={{ background: '#0d0d0d', padding: '14px 16px 10px' }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    <div style={{ width: 60, height: 7, borderRadius: 99, background: '#f47520', opacity: 0.9 }} />
                    <div style={{ width: 40, height: 7, borderRadius: 99, background: '#333' }} />
                    <div style={{ width: 40, height: 7, borderRadius: 99, background: '#333' }} />
                  </div>
                  <div style={{ background: '#1a1a1a', borderRadius: 8, padding: '8px 10px', border: '1px solid #2a2a2a' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ width: 36, height: 6, borderRadius: 99, background: '#555' }} />
                      <div style={{ width: 28, height: 6, borderRadius: 99, background: '#2db562', opacity: 0.8 }} />
                    </div>
                    <div style={{ width: '100%', height: 5, borderRadius: 99, background: '#222', marginBottom: 4 }} />
                    <div style={{ width: '70%', height: 5, borderRadius: 99, background: '#222' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <div style={{ flex: 1, height: 22, borderRadius: 6, background: '#1a1a1a', border: '1px solid #2a2a2a' }} />
                    <div style={{ flex: 1, height: 22, borderRadius: 6, background: '#1a1a1a', border: '1px solid #2a2a2a' }} />
                  </div>
                </div>
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Moon size={14} color={isDark ? 'var(--brand)' : 'var(--tx-3)'} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: isDark ? 'var(--brand)' : 'var(--tx-2)' }}>Dark</span>
                  {isDark && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'var(--brand)', color: '#fff' }}>Active</span>
                  )}
                </div>
              </button>

              {/* Light card */}
              <button
                onClick={() => setTheme('light')}
                style={{
                  border: `2px solid ${!isDark ? 'var(--brand)' : 'var(--border-md)'}`,
                  borderRadius: 'var(--r-md)',
                  background: !isDark ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                  cursor: 'pointer',
                  padding: 0,
                  overflow: 'hidden',
                  textAlign: 'left',
                  transition: 'all 200ms',
                }}
              >
                {/* Mini light UI preview */}
                <div style={{ background: '#f5f5f5', padding: '14px 16px 10px' }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    <div style={{ width: 60, height: 7, borderRadius: 99, background: '#f47520', opacity: 0.9 }} />
                    <div style={{ width: 40, height: 7, borderRadius: 99, background: '#d0d0d0' }} />
                    <div style={{ width: 40, height: 7, borderRadius: 99, background: '#d0d0d0' }} />
                  </div>
                  <div style={{ background: '#ffffff', borderRadius: 8, padding: '8px 10px', border: '1px solid #e2e2e2', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ width: 36, height: 6, borderRadius: 99, background: '#999' }} />
                      <div style={{ width: 28, height: 6, borderRadius: 99, background: '#1e9e4e', opacity: 0.8 }} />
                    </div>
                    <div style={{ width: '100%', height: 5, borderRadius: 99, background: '#e8e8e8', marginBottom: 4 }} />
                    <div style={{ width: '70%', height: 5, borderRadius: 99, background: '#e8e8e8' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <div style={{ flex: 1, height: 22, borderRadius: 6, background: '#ffffff', border: '1px solid #e2e2e2' }} />
                    <div style={{ flex: 1, height: 22, borderRadius: 6, background: '#ffffff', border: '1px solid #e2e2e2' }} />
                  </div>
                </div>
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sun size={14} color={isDark ? 'var(--tx-3)' : 'var(--brand)'} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: isDark ? 'var(--tx-2)' : 'var(--brand)' }}>Light</span>
                  {!isDark && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'var(--brand)', color: '#fff' }}>Active</span>
                  )}
                </div>
              </button>
            </div>

            {/* Quick toggle row */}
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: 'var(--r-sm)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {isDark ? <Moon size={15} color="var(--brand)" /> : <Sun size={15} color="var(--brand)" />}
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)' }}>
                    {isDark ? 'Dark Mode' : 'Light Mode'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>
                    {isDark ? 'Easy on the eyes — MoneyControl dark palette' : 'Clean white background — full visibility'}
                  </div>
                </div>
              </div>
              <Toggle checked={!isDark} onChange={() => setTheme(isDark ? 'light' : 'dark')} />
            </div>
          </div>

          {/* Font size preference */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 4 }}>Text Size</h3>
            <p style={{ fontSize: 13, color: 'var(--tx-3)', marginBottom: 16 }}>Adjust the default text size across the app.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['Small', 'Medium', 'Large'] as const).map((size, i) => (
                <button
                  key={size}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 'var(--r-sm)',
                    border: i === 1 ? '1px solid var(--border-brand)' : '1px solid var(--border)',
                    background: i === 1 ? 'var(--brand-dim)' : 'transparent',
                    color: i === 1 ? 'var(--brand)' : 'var(--tx-2)',
                    fontSize: i === 0 ? 11 : i === 1 ? 13 : 15,
                    fontWeight: i === 1 ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 150ms',
                  }}
                >{size}</button>
              ))}
            </div>
          </div>

          {/* Compact mode */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 14 }}>Layout</h3>
            {[
              { label: 'Compact tables', sub: 'Reduce row height in screener & data tables', defaultChecked: false },
              { label: 'Sidebar mini mode', sub: 'Collapse sidebar to icon-only by default', defaultChecked: false },
              { label: 'Animated transitions', sub: 'Smooth page and card animations', defaultChecked: true },
            ].map((item, i, arr) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>{item.sub}</div>
                </div>
                <Toggle checked={item.defaultChecked} onChange={() => {}} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── BROKER HUB ── */}
      {activeTab === 'brokers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '12px 16px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-brand)', background: 'var(--brand-dim)', fontSize: 13, color: 'var(--brand)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={14} style={{ flexShrink: 0 }} />
            Read-only OAuth &mdash; we can never place orders or access your funds. Your credentials are never stored.
          </div>
          {displayBrokers.map(broker => (
            <div key={broker.id} className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 12 : 16 }}>
                {/* Avatar + info row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: broker.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#fff', flexShrink: 0 }}>
                    {broker.name.slice(0, 2)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>{broker.name}</span>
                      {broker.connected
                        ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--gain)' }}><CheckCircle size={10} /> Connected</span>
                        : <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--tx-3)' }}><AlertCircle size={10} /> Not connected</span>
                      }
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>
                      {broker.connected
                        ? `${broker.holdings} holdings synced · Last sync: ${broker.lastSync}`
                        : ('message' in broker && broker.message) ? String(broker.message) : `Connect to sync your ${broker.name} holdings automatically`}
                    </div>
                  </div>
                </div>
                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {broker.connected ? (
                    <>
                      <button
                        onClick={() => handleSync(broker.id)} disabled={syncing === broker.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--tx-3)', fontSize: 12, cursor: 'pointer', flex: isMobile ? 1 : 'none' }}
                      >
                        <RefreshCw size={12} style={{ animation: syncing === broker.id ? 'spin 1s linear infinite' : 'none' }} />
                        {syncing === broker.id ? 'Checking...' : 'Check status'}
                      </button>
                      <button
                        onClick={() => handleDisconnect(broker.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 'var(--r-sm)', border: '1px solid rgba(255,77,106,0.3)', background: 'rgba(255,77,106,0.08)', color: 'var(--loss)', fontSize: 12, cursor: 'pointer', flex: isMobile ? 1 : 'none' }}
                      >
                        <Trash2 size={12} /> Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleConnect(broker.id)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 16px', borderRadius: 'var(--r-sm)', background: 'var(--brand)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', width: isMobile ? '100%' : 'auto' }}
                    >
                      <Link2 size={12} /> {connectMutation.isPending ? 'Connecting...' : 'Connect'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div style={{ padding: 18, borderRadius: 'var(--r-md)', border: '1px dashed rgba(255,255,255,0.1)', textAlign: 'center', color: 'var(--tx-3)', fontSize: 13 }}>
            More brokers coming soon: HDFC Securities, Motilal Oswal, Kotak Securities
          </div>
        </div>
      )}

      {/* ── PRICE ALERTS ── */}
      {activeTab === 'alerts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {alertTypes.map(type => (
              <div key={type.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Bell size={13} color="var(--brand)" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>{type.label}</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--tx-3)', lineHeight: 1.5 }}>{type.description}</p>
              </div>
            ))}
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>
                  Active Alerts ({apiAlerts.filter((a: any) => a.active).length})
                </h3>
                {alertsQuery.isFetching && (
                  <RefreshCw size={12} color="var(--tx-3)" style={{ animation: 'spin 1s linear infinite' }} />
                )}
              </div>
              <button
                onClick={() => { setShowNewAlert(true); setNewAlertError(null); }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--r-sm)', background: 'var(--brand)', border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Plus size={12} /> New Alert
              </button>
            </div>

            {alertsQuery.isLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--tx-3)', fontSize: 13 }}>Loading alerts…</div>
            ) : apiAlerts.length === 0 ? (
              <div style={{ padding: '28px', textAlign: 'center' }}>
                <Bell size={28} color="var(--tx-3)" style={{ marginBottom: 10, opacity: 0.4 }} />
                <p style={{ fontSize: 13.5, color: 'var(--tx-3)', margin: 0 }}>No alerts yet. Click <strong>New Alert</strong> to get started.</p>
              </div>
            ) : (
              apiAlerts.map((alert: any, i: number) => {
                const condLabel =
                  alert.condition === 'above'      ? `Above ₹${alert.threshold}` :
                  alert.condition === 'below'      ? `Below ₹${alert.threshold}` :
                  `±${alert.threshold}% move`;
                const isDeleting = deleteAlertMutation.isPending && deleteAlertMutation.variables === alert.id;
                return (
                  <div key={alert.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: i < apiAlerts.length - 1 ? '1px solid var(--border)' : 'none', opacity: isDeleting ? 0.4 : 1, transition: 'opacity 200ms' }}>
                    <div style={{ width: 38, height: 38, background: alert.active ? 'var(--brand-dim)' : 'var(--bg-elevated)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: alert.active ? 'var(--brand)' : 'var(--tx-3)', flexShrink: 0 }}>
                      {alert.ticker.slice(0, 2)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)', marginBottom: 2 }}>{alert.ticker}</div>
                      <div style={{ fontSize: 12, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{condLabel}</span>
                        {alert.triggered && (
                          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(45,181,98,0.12)', color: 'var(--gain)' }}>TRIGGERED</span>
                        )}
                      </div>
                    </div>
                    <Toggle
                      checked={alert.active}
                      onChange={() => toggleAlertMutation.mutate({ id: alert.id, active: !alert.active })}
                    />
                    <button
                      onClick={() => deleteAlertMutation.mutate(alert.id)}
                      disabled={isDeleting}
                      style={{ background: 'none', border: 'none', color: 'var(--tx-3)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                      <X size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 14 }}>Delivery Preferences</h3>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 10 }}>
              {['Push Notifications', 'SMS (₹1/alert)', 'In-App Bell'].map((pref, i) => (
                <label key={pref} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', padding: '11px 14px', cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked={i !== 1} style={{ accentColor: 'var(--brand)', flexShrink: 0 }} />
                  <span style={{ fontSize: isMobile ? 12 : 13, color: 'var(--tx-2)', lineHeight: 1.4 }}>{pref}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SUBSCRIPTION ── */}
      {activeTab === 'subscription' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(244,117,32,0.18) 0%, rgba(167,139,250,0.1) 100%)', border: '1px solid rgba(244,117,32,0.4)', borderRadius: 'var(--r-md)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--tx-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Plan</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--tx)', letterSpacing: '-0.02em', marginBottom: 4, textTransform: 'capitalize' }}>{subscription?.plan ?? 'Premium'}</div>
                <div style={{ fontSize: 13.5, color: 'var(--brand)', marginBottom: 6 }}>{subscription?.payments_configured === false ? 'Payments setup required' : '₹299/month · Billed monthly'}</div>
                <div style={{ fontSize: 13, color: 'var(--tx-3)' }}>Next billing: <span style={{ color: 'var(--tx)' }}>June 13, 2026</span></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 99, background: 'var(--brand)', color: '#fff', marginBottom: 10, display: 'inline-block', textTransform: 'uppercase' }}>{subscription?.status ?? 'ACTIVE'}</div>
                <div style={{ fontSize: 12, color: 'var(--tx-3)', marginBottom: 4 }}>Save 2 months with annual</div>
                <div style={{ fontSize: 13, color: 'var(--gain)', fontWeight: 700 }}>₹2,990/year</div>
              </div>
            </div>
            {checkoutError && (
              <div style={{ padding: '10px 14px', borderRadius: 'var(--r-sm)', background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.3)', fontSize: 12.5, color: 'var(--loss)', marginBottom: 12 }}>
                {checkoutError}
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {(subscription?.plan === 'free' || subscription?.plan == null) && (
                <button
                  onClick={() => openCheckout('premium')}
                  disabled={!!checkoutLoadingPlan}
                  style={{ background: 'var(--brand)', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 600, cursor: checkoutLoadingPlan ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: checkoutLoadingPlan === 'premium' ? 0.7 : 1 }}>
                  {checkoutLoadingPlan === 'premium' ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={13} />}
                  Upgrade to Premium ₹299
                </button>
              )}
              {(subscription?.plan === 'free' || subscription?.plan === 'premium' || subscription?.plan == null) && (
                <button
                  onClick={() => openCheckout('pro')}
                  disabled={!!checkoutLoadingPlan}
                  style={{ background: '#5367ff', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 600, cursor: checkoutLoadingPlan ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: checkoutLoadingPlan === 'pro' ? 0.7 : 1 }}>
                  {checkoutLoadingPlan === 'pro' ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={13} />}
                  Upgrade to Pro ₹999
                </button>
              )}
              {subscription?.plan !== 'enterprise' && (
                <button
                  onClick={() => openCheckout('enterprise')}
                  disabled={!!checkoutLoadingPlan}
                  style={{ background: '#a78bfa', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 600, cursor: checkoutLoadingPlan ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: checkoutLoadingPlan === 'enterprise' ? 0.7 : 1 }}>
                  {checkoutLoadingPlan === 'enterprise' ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={13} />}
                  Upgrade to Enterprise ₹1,999
                </button>
              )}
              {subscription?.plan !== 'free' && (
                <button onClick={handleCancelSubscription} style={{ border: '1px solid rgba(255,77,106,0.3)', background: 'rgba(255,77,106,0.08)', color: 'var(--loss)', padding: '10px 20px', borderRadius: 'var(--r-sm)', fontSize: 13, cursor: 'pointer' }}>Cancel Plan</button>
              )}
            </div>
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>Plan Comparison</h3>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th style={{ textAlign: 'center' }}>Free</th>
                  <th style={{ textAlign: 'center', color: 'var(--brand)' }}>Premium (Active)</th>
                  <th style={{ textAlign: 'center' }}>Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Stock Screener',    '5 filters',      'All filters',   'All + API'],
                  ['AI Research',       '1/month',        '5/month',       'Unlimited'],
                  ['DCF Builder',       'No',             'Yes',           'Yes'],
                  ['Family Portfolio',  'No',             'Up to 3',       'Unlimited'],
                  ['CA White-Label',    'No',             'No',            'Yes'],
                  ['Tax Tracker',       'Manual',         'Auto-import',   'Auto + CA export'],
                ].map(([feature, free, premium, enterprise], i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--tx)' }}>{feature}</td>
                    <td style={{ textAlign: 'center', color: 'var(--tx-3)', fontSize: 12 }}>{free}</td>
                    <td style={{ textAlign: 'center', color: 'var(--brand)', fontSize: 12, fontWeight: 600 }}>{premium}</td>
                    <td style={{ textAlign: 'center', color: 'var(--tx-2)', fontSize: 12 }}>{enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 14 }}>Recent Invoices</h3>
            {['May 2026 — ₹299', 'Apr 2026 — ₹299', 'Mar 2026 — ₹299'].map((inv, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize: 13, color: 'var(--tx-2)' }}>{inv}</span>
                <button style={{ fontSize: 12, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer' }}>Download PDF</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SECURITY ── */}
      {activeTab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 16 }}>Authentication</h3>
            {[
              { label: 'Biometric Login', sub: 'Use Face ID / Fingerprint on mobile', checked: biometric, onChange: () => setBiometric(!biometric) },
              { label: 'Two-Factor Authentication', sub: 'OTP via SMS on every login from new device', checked: twoFA, onChange: () => setTwoFA(!twoFA) },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: i === 0 ? '1px solid var(--border)' : 'none' }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>{item.sub}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {item.checked && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--gain)' }}><CheckCircle size={11} /> Enabled</span>}
                  <Toggle checked={item.checked} onChange={item.onChange} />
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 14 }}>Active Sessions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sessions.map((session, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', padding: '12px 14px' }}>
                  <div style={{ width: 38, height: 38, background: 'var(--brand-dim)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Shield size={15} color="var(--brand)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)' }}>{session.device}</span>
                      {session.current && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'rgba(0,200,150,0.1)', color: 'var(--gain)' }}>Current</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>{session.location} &middot; {session.lastActive}</div>
                  </div>
                  {!session.current && (
                    <button style={{ fontSize: 12, color: 'var(--loss)', background: 'none', border: 'none', cursor: 'pointer' }}>Revoke</button>
                  )}
                </div>
              ))}
            </div>
            <button style={{ width: '100%', marginTop: 12, padding: '10px 0', borderRadius: 'var(--r-sm)', border: '1px solid rgba(255,77,106,0.25)', background: 'rgba(255,77,106,0.07)', color: 'var(--loss)', fontSize: 13, cursor: 'pointer' }}>
              Revoke All Other Sessions
            </button>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Key size={15} color="var(--brand)" />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>API Key (CA Portal)</h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--tx-3)', marginBottom: 14, lineHeight: 1.6 }}>Use this key to integrate StockVision data into your own tools. Keep it secret.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '10px 14px', fontSize: 12.5, fontFamily: 'JetBrains Mono, monospace', color: 'var(--tx-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {showApiKey ? 'sv_live_k8j2mN4pQ7rX9sA3wE6tB1uI5oL0cH' : '•'.repeat(30)}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  title={showApiKey ? 'Hide key' : 'Show key'}
                  onClick={() => setShowApiKey(!showApiKey)}
                  style={{ padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--tx-3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button
                  title="Copy API key"
                  onClick={() => {
                    navigator.clipboard.writeText('sv_live_k8j2mN4pQ7rX9sA3wE6tB1uI5oL0cH');
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }}
                  style={{ padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: copiedKey ? 'rgba(45,181,98,0.08)' : 'transparent', color: copiedKey ? 'var(--gain)' : 'var(--tx-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 150ms' }}>
                  {copiedKey ? <Check size={15} /> : <Copy size={15} />}
                </button>
                <button style={{ padding: '10px 14px', borderRadius: 'var(--r-sm)', background: 'var(--brand)', border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Regenerate</button>
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--tx-3)', marginTop: 8 }}>Regenerating invalidates your current key immediately.</p>
          </div>

          <div style={{ padding: 20, borderRadius: 'var(--r-md)', border: '1px solid rgba(255,77,106,0.25)', background: 'rgba(255,77,106,0.04)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--loss)', marginBottom: 12 }}>Danger Zone</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)', marginBottom: 3 }}>Delete Account</div>
                <div style={{ fontSize: 12.5, color: 'var(--tx-3)', lineHeight: 1.5 }}>
                  Permanently delete your account and all personal data per DPDP Act 2023 Section 13.<br />
                  This action is <strong>irreversible</strong> — all holdings, alerts, and history will be erased.
                </div>
              </div>
              <button
                onClick={() => { setShowDeleteModal(true); setDeleteConfirmText(''); setDeleteReason(''); setDeleteError(null); }}
                style={{ padding: '9px 18px', borderRadius: 'var(--r-sm)', border: '1px solid rgba(255,77,106,0.4)', background: 'rgba(255,77,106,0.12)', color: 'var(--loss)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, flexShrink: 0 }}>
                <Trash2 size={13} style={{ display: 'inline', marginRight: 5, verticalAlign: 'text-bottom' }} />
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* ── Razorpay Payment Success Modal ───────────────────────── */}

    <AnimatePresence>
      {paySuccess && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 900 }}
            onClick={() => setPaySuccess(null)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 901, padding: 20, pointerEvents: 'none' }}>
            <div style={{ width: '100%', maxWidth: 420, background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: '0 30px 80px rgba(0,0,0,0.4)', overflow: 'hidden', pointerEvents: 'all' }}>
              <div style={{ padding: '48px 32px', textAlign: 'center' }}>
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(45,181,98,0.15)', border: '2px solid var(--gain)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <CheckCircle size={34} color="var(--gain)" />
                </motion.div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--tx)', marginBottom: 8 }}>Payment Successful!</div>
                <div style={{ fontSize: 14, color: 'var(--tx-3)', marginBottom: 24, lineHeight: 1.6 }}>
                  You're now on <strong style={{ color: 'var(--brand)' }}>{paySuccess}</strong>.<br />
                  Your new features are unlocked immediately.
                </div>
                <button
                  onClick={() => setPaySuccess(null)}
                  style={{ background: 'var(--gain)', border: 'none', color: '#fff', padding: '12px 32px', borderRadius: 'var(--r-md)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  Start Exploring
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

    {/* ── New Alert Modal ──────────────────────────────────────── */}
    <AnimatePresence>
      {showNewAlert && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000 }}
            onClick={() => setShowNewAlert(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.18 }}
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: 20, pointerEvents: 'none' }}
          >
            <div style={{ width: '100%', maxWidth: 400, background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border-md)', boxShadow: '0 24px 80px rgba(0,0,0,0.4)', overflow: 'hidden', pointerEvents: 'all' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Bell size={15} color="var(--brand)" />
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>Create Price Alert</span>
                </div>
                <button onClick={() => setShowNewAlert(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 2, display: 'flex' }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-3)', display: 'block', marginBottom: 5 }}>NSE Ticker Symbol</label>
                  <input
                    value={newAlertTicker}
                    onChange={e => setNewAlertTicker(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && handleCreateAlert()}
                    placeholder="e.g. RELIANCE, TCS, INFY"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--tx)', fontSize: 13.5, fontFamily: 'JetBrains Mono, monospace', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-3)', display: 'block', marginBottom: 5 }}>Condition</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['above', 'below', 'pct_change'] as const).map(c => (
                      <button key={c} onClick={() => setNewAlertCond(c)}
                        style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: newAlertCond === c ? '1px solid var(--border-brand)' : '1px solid var(--border)', background: newAlertCond === c ? 'var(--brand-dim)' : 'var(--bg-elevated)', color: newAlertCond === c ? 'var(--brand)' : 'var(--tx-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms' }}>
                        {c === 'above' ? '▲ Above' : c === 'below' ? '▼ Below' : '% Change'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-3)', display: 'block', marginBottom: 5 }}>
                    {newAlertCond === 'pct_change' ? 'Percentage Threshold (%)' : 'Price Threshold (₹)'}
                  </label>
                  <input
                    type="number"
                    value={newAlertThresh}
                    onChange={e => setNewAlertThresh(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreateAlert()}
                    placeholder={newAlertCond === 'pct_change' ? 'e.g. 5 (for ±5% move)' : 'e.g. 2500'}
                    min="0"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--tx)', fontSize: 13.5, fontFamily: 'JetBrains Mono, monospace', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
                {newAlertError && (
                  <div style={{ fontSize: 12.5, color: 'var(--loss)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertCircle size={13} /> {newAlertError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowNewAlert(false)}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--tx-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Cancel
                  </button>
                  <button onClick={handleCreateAlert} disabled={createAlertMutation.isPending}
                    className="btn-primary"
                    style={{ flex: 1, padding: '10px', fontSize: 13, opacity: createAlertMutation.isPending ? 0.7 : 1 }}>
                    {createAlertMutation.isPending ? 'Creating…' : '+ Create Alert'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

    {/* ── Account Deletion Confirmation Modal ──────────────────── */}
    <AnimatePresence>
      {showDeleteModal && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000 }}
            onClick={() => !deletingAccount && setShowDeleteModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: 20, pointerEvents: 'none' }}
          >
            <div style={{ width: '100%', maxWidth: 460, background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid rgba(255,77,106,0.3)', boxShadow: '0 30px 80px rgba(0,0,0,0.5)', overflow: 'hidden', pointerEvents: 'all' }}>
              <div style={{ background: 'rgba(255,77,106,0.06)', padding: '20px 24px', borderBottom: '1px solid rgba(255,77,106,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,77,106,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 size={16} color="var(--loss)" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--loss)' }}>Delete Account</div>
                    <div style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>DPDP Act 2023 — Right to Erasure</div>
                  </div>
                </div>
              </div>

              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ padding: '12px 14px', background: 'rgba(255,77,106,0.06)', borderRadius: 10, border: '1px solid rgba(255,77,106,0.2)' }}>
                  <p style={{ fontSize: 13, color: 'var(--tx-2)', margin: 0, lineHeight: 1.6 }}>
                    ⚠️ This will permanently delete all your data including holdings, transactions, alerts, and API keys. <strong>This cannot be undone.</strong>
                  </p>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-3)', display: 'block', marginBottom: 6 }}>
                    Reason (optional)
                  </label>
                  <input
                    value={deleteReason}
                    onChange={e => setDeleteReason(e.target.value)}
                    placeholder="Why are you leaving?"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--tx)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--loss)', display: 'block', marginBottom: 6 }}>
                    Type <code style={{ background: 'rgba(255,77,106,0.1)', padding: '1px 5px', borderRadius: 4 }}>DELETE MY ACCOUNT</code> to confirm
                  </label>
                  <input
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE MY ACCOUNT"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${deleteConfirmText === 'DELETE MY ACCOUNT' ? 'rgba(255,77,106,0.5)' : 'var(--border)'}`, background: 'var(--bg-elevated)', color: 'var(--tx)', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>

                {deleteError && (
                  <div style={{ fontSize: 12.5, color: 'var(--loss)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertCircle size={13} /> {deleteError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deletingAccount}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--tx-2)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount || deleteConfirmText !== 'DELETE MY ACCOUNT'}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: deleteConfirmText === 'DELETE MY ACCOUNT' ? 'var(--loss)' : 'rgba(255,77,106,0.2)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: deleteConfirmText === 'DELETE MY ACCOUNT' ? 'pointer' : 'not-allowed', fontFamily: 'inherit', opacity: deletingAccount ? 0.7 : 1, transition: 'all 150ms' }}>
                    {deletingAccount ? 'Deleting…' : '🗑️ Delete Forever'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
}
