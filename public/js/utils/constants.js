// ═══════════════════════════════════════════════════════════════════
// Application Constants — ECO v2
// ═══════════════════════════════════════════════════════════════════

export const API_BASE = '/api';

export const TX_TYPES = { INCOME: 'income', EXPENSE: 'expense' };
export const DEBT_TYPES = { CREDIT_CARD: 'credit_card', OVERDRAFT: 'overdraft', LOAN: 'loan', INSTALLMENT: 'installment' };
export const DEBT_TYPE_LABELS = { credit_card: 'Kredi Kartı', overdraft: 'Ek Hesap (KMH)', loan: 'Bireysel Kredi', installment: 'Taksit' };

export const NAV_ITEMS = [
  { id: 'dashboard',    icon: '📊', label: 'Dashboard' },
  { id: 'survival',     icon: '⚡', label: 'Hayatta Kalma' },
  { id: 'tax',           icon: '🧾', label: 'Vergi & Maaş' },
  { id: 'transactions', icon: '💸', label: 'İşlemler' },
  { id: 'installments', icon: '💳', label: 'Taksitler' },
  { id: 'debts',        icon: '🏦', label: 'Borçlar' },
  { id: 'categories',   icon: '📂', label: 'Kategoriler' },
  { id: 'analysis',     icon: '🧠', label: 'Akıllı Analiz' },
  { id: 'behavioral',   icon: '🎭', label: 'Davranışsal' },
  { id: 'analytics',    icon: '📈', label: 'Analitik' },
  { id: 'simulator',    icon: '🧮', label: 'Simülatör' },
  { id: 'savings',      icon: '🎯', label: 'Tasarruf' },
  { id: 'goals',        icon: '🏆', label: 'Hedefler' },
  { id: 'calendar',     icon: '📅', label: 'Takvim' },
  { id: 'import',       icon: '📥', label: 'İçe Aktar' },
  { id: 'reports',      icon: '📑', label: 'Raporlar' },
  { id: 'agent',        icon: '🤖', label: 'Agent' },
  { id: 'notes',        icon: '📝', label: 'Notlar' },
  { id: 'settings',     icon: '⚙️', label: 'Ayarlar' }
];
