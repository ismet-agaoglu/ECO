// ═══════════════════════════════════════════════════════════════════
// Seed Data — Realistic Turkish Household Sample Data
// ═══════════════════════════════════════════════════════════════════
// Run: node data/seed.js

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname);
const id = () => crypto.randomUUID();
const now = new Date();
const Y = now.getFullYear();
const M = now.getMonth() + 1;

// ─── Categories ─────────────────────────────────────────────────
const categories = [
  { id: 'cat-market', name: 'Market', icon: '🛒', color: '#4CAF50' },
  { id: 'cat-kira', name: 'Kira', icon: '🏠', color: '#FF9800' },
  { id: 'cat-faturalar', name: 'Faturalar', icon: '💡', color: '#FFC107' },
  { id: 'cat-ulasim', name: 'Ulaşım', icon: '🚗', color: '#2196F3' },
  { id: 'cat-eglence', name: 'Eğlence', icon: '🎬', color: '#9C27B0' },
  { id: 'cat-saglik', name: 'Sağlık', icon: '🏥', color: '#F44336' },
  { id: 'cat-egitim', name: 'Eğitim', icon: '📚', color: '#3F51B5' },
  { id: 'cat-giyim', name: 'Giyim', icon: '👗', color: '#E91E63' },
  { id: 'cat-yemek', name: 'Yemek', icon: '🍽️', color: '#FF5722' },
  { id: 'cat-taksit', name: 'Taksit', icon: '💳', color: '#607D8B' },
  { id: 'cat-maas', name: 'Maaş', icon: '💰', color: '#00BCD4' },
  { id: 'cat-ek-gelir', name: 'Ek Gelir', icon: '📈', color: '#8BC34A' },
  { id: 'cat-diger', name: 'Diğer', icon: '📦', color: '#9E9E9E' },
  { id: 'cat-akaryakit', name: 'Akaryakıt', icon: '⛽', color: '#795548' },
  { id: 'cat-cocuk', name: 'Çocuk', icon: '👶', color: '#00BCD4' }
];

// ─── Transactions (3 months of data) ────────────────────────────
const transactions = [];

function addTx(date, amount, type, category, description, source = 'manual') {
  transactions.push({
    id: id(), date, amount, type, category, description,
    isRecurring: false, recurringId: null,
    source, confidence: source === 'agent' ? 0.85 : 1.0,
    status: source === 'agent' ? 'pending_review' : 'confirmed',
    importId: null, createdAt: new Date().toISOString()
  });
}

// January
addTx(`${Y}-01-01`, 48000, 'income', 'cat-maas', 'Ocak Maaş - Eş 1');
addTx(`${Y}-01-01`, 42000, 'income', 'cat-maas', 'Ocak Maaş - Eş 2');
addTx(`${Y}-01-03`, 17500, 'expense', 'cat-kira', 'Ev Kirası');
addTx(`${Y}-01-05`, 4200, 'expense', 'cat-market', 'Haftalık market');
addTx(`${Y}-01-10`, 1800, 'expense', 'cat-faturalar', 'Elektrik faturası');
addTx(`${Y}-01-10`, 950, 'expense', 'cat-faturalar', 'Su faturası');
addTx(`${Y}-01-12`, 3500, 'expense', 'cat-market', 'Haftalık market');
addTx(`${Y}-01-14`, 1200, 'expense', 'cat-ulasim', 'Akbil yükleme');
addTx(`${Y}-01-15`, 2800, 'expense', 'cat-akaryakit', 'Benzin');
addTx(`${Y}-01-18`, 850, 'expense', 'cat-yemek', 'Dışarıda yemek');
addTx(`${Y}-01-20`, 3200, 'expense', 'cat-market', 'Haftalık market');
addTx(`${Y}-01-22`, 1500, 'expense', 'cat-eglence', 'Sinema + kafe');
addTx(`${Y}-01-25`, 4000, 'expense', 'cat-cocuk', 'Kreş ücreti');
addTx(`${Y}-01-28`, 750, 'expense', 'cat-saglik', 'Eczane');
addTx(`${Y}-01-30`, 2000, 'income', 'cat-ek-gelir', 'Freelance iş');

// February
addTx(`${Y}-02-01`, 48000, 'income', 'cat-maas', 'Şubat Maaş - Eş 1');
addTx(`${Y}-02-01`, 42000, 'income', 'cat-maas', 'Şubat Maaş - Eş 2');
addTx(`${Y}-02-03`, 17500, 'expense', 'cat-kira', 'Ev Kirası');
addTx(`${Y}-02-05`, 4500, 'expense', 'cat-market', 'Haftalık market');
addTx(`${Y}-02-08`, 2200, 'expense', 'cat-faturalar', 'Doğalgaz faturası');
addTx(`${Y}-02-10`, 1600, 'expense', 'cat-faturalar', 'Elektrik faturası');
addTx(`${Y}-02-12`, 3800, 'expense', 'cat-market', 'Haftalık market');
addTx(`${Y}-02-14`, 2500, 'expense', 'cat-yemek', 'Sevgililer günü yemeği');
addTx(`${Y}-02-16`, 3000, 'expense', 'cat-akaryakit', 'Benzin');
addTx(`${Y}-02-18`, 5000, 'expense', 'cat-giyim', 'Kışlık mont');
addTx(`${Y}-02-20`, 4000, 'expense', 'cat-market', 'Haftalık market');
addTx(`${Y}-02-22`, 1800, 'expense', 'cat-eglence', 'Netflix + Spotify');
addTx(`${Y}-02-25`, 4000, 'expense', 'cat-cocuk', 'Kreş ücreti');
addTx(`${Y}-02-27`, 1200, 'expense', 'cat-ulasim', 'Akbil yükleme');

// March (current)
addTx(`${Y}-03-01`, 48000, 'income', 'cat-maas', 'Mart Maaş - Eş 1');
addTx(`${Y}-03-01`, 42000, 'income', 'cat-maas', 'Mart Maaş - Eş 2');
addTx(`${Y}-03-03`, 17500, 'expense', 'cat-kira', 'Ev Kirası');
addTx(`${Y}-03-05`, 4800, 'expense', 'cat-market', 'Haftalık market');
addTx(`${Y}-03-08`, 1500, 'expense', 'cat-faturalar', 'İnternet faturası');
addTx(`${Y}-03-10`, 1900, 'expense', 'cat-faturalar', 'Elektrik faturası');
addTx(`${Y}-03-12`, 3200, 'expense', 'cat-market', 'Haftalık market');
addTx(`${Y}-03-14`, 2800, 'expense', 'cat-akaryakit', 'Benzin');
addTx(`${Y}-03-15`, 1500, 'expense', 'cat-yemek', 'Dışarıda yemek');
addTx(`${Y}-03-16`, 4000, 'expense', 'cat-cocuk', 'Kreş ücreti');

// Agent-submitted (pending review)
addTx(`${Y}-03-10`, 650, 'expense', 'cat-market', 'Migros - kart ekstresinden', 'agent');
addTx(`${Y}-03-11`, 1200, 'expense', 'cat-yemek', 'Yemeksepeti siparişleri', 'agent');
addTx(`${Y}-03-13`, 350, 'expense', 'cat-ulasim', 'Taksi - fiş taraması', 'agent');

// ─── Debts ──────────────────────────────────────────────────────
const debts = [
  {
    id: id(), name: 'Yapı Kredi Kredi Kartı', type: 'credit_card',
    principalAmount: 85000, currentBalance: 72000,
    interestRate: 72, minPayment: 8000,
    dueDate: '15', startDate: `${Y - 1}-06-01`, endDate: null,
    payments: [
      { id: id(), amount: 5000, date: `${Y}-01-15`, note: 'Ocak ödemesi' },
      { id: id(), amount: 8000, date: `${Y}-02-15`, note: 'Şubat ödemesi' }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: id(), name: 'Ek Hesap (Overdraft)', type: 'overdraft',
    principalAmount: 30000, currentBalance: 25000,
    interestRate: 84, minPayment: 3000,
    dueDate: null, startDate: `${Y - 1}-09-01`, endDate: null,
    payments: [],
    createdAt: new Date().toISOString()
  },
  {
    id: id(), name: 'Garanti Bireysel Kredi', type: 'loan',
    principalAmount: 120000, currentBalance: 95000,
    interestRate: 36, minPayment: 6500,
    dueDate: '20', startDate: `${Y - 1}-03-01`, endDate: `${Y + 1}-03-01`,
    payments: [],
    createdAt: new Date().toISOString()
  }
];

// ─── Installments ───────────────────────────────────────────────
const installments = [
  {
    id: id(), name: 'iPhone 15 Pro', totalAmount: 72000,
    installmentCount: 12, paidCount: 4, monthlyAmount: 6000,
    remainingAmount: 48000, startYear: Y - 1, startMonth: 11,
    category: 'cat-taksit', source: 'manual', isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: id(), name: 'Çamaşır Makinesi', totalAmount: 28000,
    installmentCount: 6, paidCount: 2, monthlyAmount: 4666.67,
    remainingAmount: 18666.68, startYear: Y, startMonth: 1,
    category: 'cat-taksit', source: 'manual', isActive: true,
    createdAt: new Date().toISOString()
  }
];

// ─── Budget ─────────────────────────────────────────────────────
const budgets = [
  { id: id(), year: Y, month: 1, totalLimit: 55000, categoryLimits: {}, createdAt: new Date().toISOString() },
  { id: id(), year: Y, month: 2, totalLimit: 55000, categoryLimits: {}, createdAt: new Date().toISOString() },
  { id: id(), year: Y, month: 3, totalLimit: 55000, categoryLimits: {}, createdAt: new Date().toISOString() }
];

// ─── Recurring ──────────────────────────────────────────────────
const recurring = [
  { id: id(), description: 'Ev Kirası', amount: 17500, type: 'expense', category: 'cat-kira', startYear: Y, startMonth: 1, durationMonths: 12, isActive: true, createdAt: new Date().toISOString() },
  { id: id(), description: 'Kreş Ücreti', amount: 4000, type: 'expense', category: 'cat-cocuk', startYear: Y, startMonth: 1, durationMonths: 12, isActive: true, createdAt: new Date().toISOString() },
  { id: id(), description: 'Netflix + Spotify', amount: 450, type: 'expense', category: 'cat-eglence', startYear: Y, startMonth: 1, durationMonths: 12, isActive: true, createdAt: new Date().toISOString() }
];

// ─── Notes ──────────────────────────────────────────────────────
const notes = [
  { id: id(), title: 'Komşu Ali\'ye borç', content: 'Geçen ay ödünç aldığımız 5000 TL. Nisan\'da geri ödeyeceğiz.', amount: 5000, isObligation: true, frequency: 'once', category: 'cat-diger', convertedToRecord: false, source: 'manual', createdAt: new Date().toISOString() },
  { id: id(), title: 'Elden taksit - Televizyon', content: 'Arkadaştan 2. el TV aldık. 3 ay taksitle ödeme.', amount: 2500, isObligation: true, frequency: 'monthly', category: 'cat-diger', convertedToRecord: false, source: 'manual', createdAt: new Date().toISOString() },
  { id: id(), title: 'Araç bakım hatırlatma', content: 'Nisan ayında periyodik bakım yapılacak, yaklaşık 8000TL bütçe ayır', amount: 8000, isObligation: false, frequency: 'once', category: 'cat-ulasim', convertedToRecord: false, source: 'manual', createdAt: new Date().toISOString() }
];

// ─── Audit Log ──────────────────────────────────────────────────
const auditlog = [
  { id: id(), action: 'create', entity: 'transaction', entityId: '', source: 'manual', details: 'Seed data yüklendi', timestamp: new Date().toISOString() }
];

// ─── Write all ──────────────────────────────────────────────────
const collections = { transactions, debts, categories, budgets, recurring, installments, notes, auditlog, settings: [] };

Object.entries(collections).forEach(([name, data]) => {
  const file = path.join(DATA_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✅ ${name}.json — ${Array.isArray(data) ? data.length : 0} kayıt`);
});

console.log('\n🎉 Seed data başarıyla yüklendi!');
console.log(`📊 ${transactions.length} işlem, ${debts.length} borç, ${installments.length} taksit, ${notes.length} not`);
