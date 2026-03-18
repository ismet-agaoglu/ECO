const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SurvivalEngine = require('../services/SurvivalEngine');
const CrisisEngine = require('../services/CrisisEngine');

// ─── Data Directory Setup ──────────────────────────────────────────
const DATA_DIR = path.join(__dirname, '..', 'data');
const COLLECTIONS = ['transactions', 'debts', 'categories', 'budgets', 'recurring', 'settings', 'installments', 'notes', 'auditlog', 'crisis_transactions'];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  COLLECTIONS.forEach(col => {
    const file = path.join(DATA_DIR, `${col}.json`);
    if (!fs.existsSync(file)) {
      const defaults = col === 'categories' ? getDefaultCategories() : [];
      fs.writeFileSync(file, JSON.stringify(defaults, null, 2), 'utf-8');
    }
  });
}

function getDefaultCategories() {
  return [
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
    { id: 'cat-diger', name: 'Diğer', icon: '📦', color: '#9E9E9E' }
  ];
}

function readData(collection) {
  ensureDataDir();
  const file = path.join(DATA_DIR, `${collection}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function writeData(collection, data) {
  ensureDataDir();
  const file = path.join(DATA_DIR, `${collection}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

function generateId() {
  return crypto.randomUUID();
}

function addAuditLog(action, entity, entityId, source, details) {
  try {
    const logs = readData('auditlog');
    logs.push({
      id: generateId(),
      action, entity, entityId,
      source: source || 'manual',
      details: details || '',
      timestamp: new Date().toISOString()
    });
    if (logs.length > 1000) logs.splice(0, logs.length - 1000);
    writeData('auditlog', logs);
  } catch (e) { /* silent */ }
}

function validate(body, rules) {
  const errors = [];
  for (const [field, rule] of Object.entries(rules)) {
    const val = body[field];
    if (rule.required && (val === undefined || val === null || val === '')) errors.push(`${field} zorunludur`);
    if (rule.type === 'number' && val !== undefined && isNaN(parseFloat(val))) errors.push(`${field} sayı olmalıdır`);
    if (rule.min !== undefined && parseFloat(val) < rule.min) errors.push(`${field} en az ${rule.min} olmalıdır`);
  }
  return errors;
}

// ─── Initialize ────────────────────────────────────────────────────
ensureDataDir();

// ═══════════════════════════════════════════════════════════════════
// TRANSACTIONS
// ═══════════════════════════════════════════════════════════════════

router.get('/transactions', (req, res) => {
  let transactions = readData('transactions');
  const { year, month, category, type } = req.query;

  if (year) transactions = transactions.filter(t => new Date(t.date).getFullYear() === parseInt(year));
  if (month) transactions = transactions.filter(t => (new Date(t.date).getMonth() + 1) === parseInt(month));
  if (category) transactions = transactions.filter(t => t.category === category);
  if (type) transactions = transactions.filter(t => t.type === type);

  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(transactions);
});

router.post('/transactions', (req, res) => {
  const errs = validate(req.body, { amount: { required: true, type: 'number', min: 0 } });
  if (errs.length) return res.status(400).json({ error: errs.join(', ') });

  const transactions = readData('transactions');
  const newTx = {
    id: generateId(),
    date: req.body.date || new Date().toISOString().split('T')[0],
    amount: parseFloat(req.body.amount),
    type: req.body.type || 'expense',
    category: req.body.category || 'cat-diger',
    description: req.body.description || '',
    isRecurring: req.body.isRecurring || false,
    recurringId: req.body.recurringId || null,
    source: req.body.source || 'manual',
    confidence: req.body.confidence != null ? parseFloat(req.body.confidence) : 1.0,
    status: req.body.source === 'agent' ? (req.body.status || 'pending_review') : 'confirmed',
    importId: req.body.importId || null,
    createdAt: new Date().toISOString()
  };
  transactions.push(newTx);
  writeData('transactions', transactions);
  addAuditLog('create', 'transaction', newTx.id, newTx.source, newTx.description);
  res.status(201).json(newTx);
});

router.put('/transactions/:id', (req, res) => {
  const transactions = readData('transactions');
  const idx = transactions.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Transaction not found' });

  transactions[idx] = { ...transactions[idx], ...req.body, id: req.params.id };
  writeData('transactions', transactions);
  res.json(transactions[idx]);
});

router.delete('/transactions/:id', (req, res) => {
  let transactions = readData('transactions');
  const idx = transactions.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Transaction not found' });

  addAuditLog('delete', 'transaction', req.params.id, 'manual', transactions[idx].description);
  transactions.splice(idx, 1);
  writeData('transactions', transactions);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════
// DEBTS
// ═══════════════════════════════════════════════════════════════════

router.get('/debts', (req, res) => {
  res.json(readData('debts'));
});

router.post('/debts', (req, res) => {
  const debts = readData('debts');
  const newDebt = {
    id: generateId(),
    name: req.body.name,
    type: req.body.type || 'credit_card', // credit_card | overdraft | loan | installment
    principalAmount: parseFloat(req.body.principalAmount || 0),
    currentBalance: parseFloat(req.body.currentBalance || 0),
    interestRate: parseFloat(req.body.interestRate || 0), // Annual %
    minPayment: parseFloat(req.body.minPayment || 0),
    dueDate: req.body.dueDate || null,
    startDate: req.body.startDate || new Date().toISOString().split('T')[0],
    endDate: req.body.endDate || null,
    payments: [],
    createdAt: new Date().toISOString()
  };
  debts.push(newDebt);
  writeData('debts', debts);
  res.status(201).json(newDebt);
});

router.put('/debts/:id', (req, res) => {
  const debts = readData('debts');
  const idx = debts.findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Debt not found' });

  debts[idx] = { ...debts[idx], ...req.body, id: req.params.id };
  writeData('debts', debts);
  res.json(debts[idx]);
});

router.delete('/debts/:id', (req, res) => {
  let debts = readData('debts');
  debts = debts.filter(d => d.id !== req.params.id);
  writeData('debts', debts);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════

router.get('/categories', (req, res) => {
  res.json(readData('categories'));
});

router.post('/categories', (req, res) => {
  const categories = readData('categories');
  const newCat = {
    id: 'cat-' + req.body.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    name: req.body.name,
    icon: req.body.icon || '📦',
    color: req.body.color || '#9E9E9E'
  };
  categories.push(newCat);
  writeData('categories', categories);
  res.status(201).json(newCat);
});

// ═══════════════════════════════════════════════════════════════════
// BUDGETS
// ═══════════════════════════════════════════════════════════════════

router.get('/budget/:year/:month', (req, res) => {
  const budgets = readData('budgets');
  const budget = budgets.find(
    b => b.year === parseInt(req.params.year) && b.month === parseInt(req.params.month)
  );
  if (!budget) return res.json({ year: parseInt(req.params.year), month: parseInt(req.params.month), totalLimit: 0, categoryLimits: {} });
  res.json(budget);
});

router.post('/budget', (req, res) => {
  const budgets = readData('budgets');
  const existing = budgets.findIndex(
    b => b.year === parseInt(req.body.year) && b.month === parseInt(req.body.month)
  );

  const budget = {
    id: generateId(),
    year: parseInt(req.body.year),
    month: parseInt(req.body.month),
    totalLimit: parseFloat(req.body.totalLimit || 0),
    categoryLimits: req.body.categoryLimits || {},
    createdAt: new Date().toISOString()
  };

  if (existing >= 0) {
    budget.id = budgets[existing].id;
    budgets[existing] = budget;
  } else {
    budgets.push(budget);
  }

  writeData('budgets', budgets);
  res.status(201).json(budget);
});

// ═══════════════════════════════════════════════════════════════════
// RECURRING EXPENSES
// ═══════════════════════════════════════════════════════════════════

router.get('/recurring', (req, res) => {
  res.json(readData('recurring'));
});

router.post('/recurring', (req, res) => {
  const recurring = readData('recurring');
  const transactions = readData('transactions');

  const newRecurring = {
    id: generateId(),
    description: req.body.description,
    amount: parseFloat(req.body.amount),
    type: req.body.type || 'expense',
    category: req.body.category || 'cat-diger',
    startYear: parseInt(req.body.startYear || new Date().getFullYear()),
    startMonth: parseInt(req.body.startMonth || (new Date().getMonth() + 1)),
    durationMonths: parseInt(req.body.durationMonths || 12),
    isActive: true,
    createdAt: new Date().toISOString()
  };

  recurring.push(newRecurring);

  // Auto-generate transactions for each month
  for (let i = 0; i < newRecurring.durationMonths; i++) {
    let m = newRecurring.startMonth + i;
    let y = newRecurring.startYear;
    while (m > 12) { m -= 12; y++; }

    const txDate = `${y}-${String(m).padStart(2, '0')}-01`;
    transactions.push({
      id: generateId(),
      date: txDate,
      amount: newRecurring.amount,
      type: newRecurring.type,
      category: newRecurring.category,
      description: newRecurring.description + ' (Otomatik)',
      isRecurring: true,
      recurringId: newRecurring.id,
      createdAt: new Date().toISOString()
    });
  }

  writeData('recurring', recurring);
  writeData('transactions', transactions);
  res.status(201).json(newRecurring);
});

router.delete('/recurring/:id', (req, res) => {
  let recurring = readData('recurring');
  let transactions = readData('transactions');

  recurring = recurring.filter(r => r.id !== req.params.id);
  transactions = transactions.filter(t => t.recurringId !== req.params.id);

  writeData('recurring', recurring);
  writeData('transactions', transactions);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════
// SUMMARY & ANALYTICS
// ═══════════════════════════════════════════════════════════════════

router.get('/summary', (req, res) => {
  const transactions = readData('transactions');
  const debts = readData('debts');
  const now = new Date();
  const year = parseInt(req.query.year) || now.getFullYear();
  const month = parseInt(req.query.month) || (now.getMonth() + 1);

  const monthTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === year && (d.getMonth() + 1) === month;
  });

  const totalIncome = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalDebt = debts.reduce((s, d) => s + d.currentBalance, 0);
  const totalInterestPerMonth = debts.reduce((s, d) => s + (d.currentBalance * (d.interestRate / 100) / 12), 0);

  const budgets = readData('budgets');
  const budget = budgets.find(b => b.year === year && b.month === month);
  const budgetLimit = budget ? budget.totalLimit : 0;
  const remainingBudget = budgetLimit > 0 ? budgetLimit - totalExpense : null;

  res.json({
    year, month,
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
    totalDebt,
    totalInterestPerMonth: Math.round(totalInterestPerMonth * 100) / 100,
    budgetLimit,
    remainingBudget,
    transactionCount: monthTx.length
  });
});

router.get('/categories/summary', (req, res) => {
  const transactions = readData('transactions');
  const categories = readData('categories');
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const month = parseInt(req.query.month) || (new Date().getMonth() + 1);

  const monthTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === year && (d.getMonth() + 1) === month && t.type === 'expense';
  });

  const summary = {};
  categories.forEach(cat => { summary[cat.id] = { ...cat, total: 0, count: 0 }; });

  monthTx.forEach(t => {
    if (summary[t.category]) {
      summary[t.category].total += t.amount;
      summary[t.category].count++;
    }
  });

  res.json(Object.values(summary).filter(s => s.total > 0).sort((a, b) => b.total - a.total));
});

router.get('/remaining-budget/:year/:month', (req, res) => {
  const transactions = readData('transactions');
  const budgets = readData('budgets');
  const year = parseInt(req.params.year);
  const month = parseInt(req.params.month);

  const budget = budgets.find(b => b.year === year && b.month === month);
  if (!budget) return res.json({ budgetLimit: 0, spent: 0, remaining: 0, dailyAvg: 0 });

  const spent = transactions
    .filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === year && (d.getMonth() + 1) === month && t.type === 'expense';
    })
    .reduce((s, t) => s + t.amount, 0);

  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  const remainingDays = (year === today.getFullYear() && month === (today.getMonth() + 1))
    ? daysInMonth - today.getDate() + 1
    : daysInMonth;

  const remaining = budget.totalLimit - spent;

  res.json({
    budgetLimit: budget.totalLimit,
    spent,
    remaining,
    dailyAvg: remainingDays > 0 ? Math.round(remaining / remainingDays) : 0,
    remainingDays
  });
});

// ═══════════════════════════════════════════════════════════════════
// DEBT ANALYSIS
// ═══════════════════════════════════════════════════════════════════

router.get('/analysis/debt-payoff', (req, res) => {
  const debts = readData('debts');
  const extraPayment = parseFloat(req.query.extraPayment || 0);

  const analysis = debts.map(debt => {
    const monthlyRate = debt.interestRate / 100 / 12;
    const balance = debt.currentBalance;

    // Minimum payment scenario
    const minScenario = simulatePayoff(balance, monthlyRate, debt.minPayment);
    // Extra payment scenario
    const extraScenario = extraPayment > 0
      ? simulatePayoff(balance, monthlyRate, debt.minPayment + extraPayment)
      : null;

    return {
      debtId: debt.id,
      name: debt.name,
      currentBalance: balance,
      interestRate: debt.interestRate,
      monthlyInterest: Math.round(balance * monthlyRate * 100) / 100,
      minPayment: debt.minPayment,
      minPaymentMonths: minScenario.months,
      minPaymentTotalInterest: minScenario.totalInterest,
      extraPaymentMonths: extraScenario ? extraScenario.months : null,
      extraPaymentTotalInterest: extraScenario ? extraScenario.totalInterest : null,
      interestSaved: extraScenario ? Math.round((minScenario.totalInterest - extraScenario.totalInterest) * 100) / 100 : null
    };
  });

  // Snowball vs Avalanche comparison
  const snowball = calculateStrategy(debts, extraPayment, 'snowball');
  const avalanche = calculateStrategy(debts, extraPayment, 'avalanche');

  res.json({ debts: analysis, snowball, avalanche });
});

function simulatePayoff(balance, monthlyRate, payment) {
  if (payment <= 0 || balance <= 0) return { months: 0, totalInterest: 0 };
  let months = 0;
  let totalInterest = 0;
  let remaining = balance;

  while (remaining > 0 && months < 600) {
    const interest = remaining * monthlyRate;
    totalInterest += interest;
    remaining = remaining + interest - payment;
    months++;
    if (remaining < 0) remaining = 0;
    if (payment <= interest && months > 1) {
      return { months: Infinity, totalInterest: Infinity };
    }
  }

  return { months, totalInterest: Math.round(totalInterest * 100) / 100 };
}

function calculateStrategy(debts, extraPayment, strategy) {
  if (debts.length === 0) return { totalMonths: 0, totalInterest: 0 };

  let sorted = [...debts];
  if (strategy === 'snowball') {
    sorted.sort((a, b) => a.currentBalance - b.currentBalance);
  } else {
    sorted.sort((a, b) => b.interestRate - a.interestRate);
  }

  let balances = sorted.map(d => d.currentBalance);
  const rates = sorted.map(d => d.interestRate / 100 / 12);
  const minPayments = sorted.map(d => d.minPayment);
  let totalInterest = 0;
  let months = 0;

  while (balances.some(b => b > 0) && months < 600) {
    let extra = extraPayment;

    for (let i = 0; i < balances.length; i++) {
      if (balances[i] <= 0) continue;

      const interest = balances[i] * rates[i];
      totalInterest += interest;

      let payment = minPayments[i];
      // Apply extra to first non-zero debt
      if (extra > 0 && i === balances.findIndex(b => b > 0)) {
        payment += extra;
      }

      balances[i] = balances[i] + interest - payment;
      if (balances[i] < 0) balances[i] = 0;
    }
    months++;
  }

  return { totalMonths: months, totalInterest: Math.round(totalInterest * 100) / 100 };
}

// ═══════════════════════════════════════════════════════════════════
// SAVINGS ANALYSIS
// ═══════════════════════════════════════════════════════════════════

router.get('/analysis/savings', (req, res) => {
  const transactions = readData('transactions');
  const debts = readData('debts');

  // Calculate average monthly income/expense over available data
  const monthlyData = {};
  transactions.forEach(t => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    if (!monthlyData[key]) monthlyData[key] = { income: 0, expense: 0 };
    if (t.type === 'income') monthlyData[key].income += t.amount;
    else monthlyData[key].expense += t.amount;
  });

  const months = Object.values(monthlyData);
  const avgIncome = months.length > 0 ? months.reduce((s, m) => s + m.income, 0) / months.length : 0;
  const avgExpense = months.length > 0 ? months.reduce((s, m) => s + m.expense, 0) / months.length : 0;
  const monthlySavings = avgIncome - avgExpense;
  const totalDebt = debts.reduce((s, d) => s + d.currentBalance, 0);

  // Projections
  const projections = [];
  let accumulated = 0;
  for (let i = 1; i <= 24; i++) {
    accumulated += monthlySavings;
    projections.push({
      month: i,
      savings: Math.round(accumulated),
      debtRemaining: Math.max(0, Math.round(totalDebt - accumulated))
    });
  }

  // Spending patterns by category
  const categorySpending = {};
  transactions.filter(t => t.type === 'expense').forEach(t => {
    if (!categorySpending[t.category]) categorySpending[t.category] = 0;
    categorySpending[t.category] += t.amount;
  });

  res.json({
    avgMonthlyIncome: Math.round(avgIncome),
    avgMonthlyExpense: Math.round(avgExpense),
    monthlySavings: Math.round(monthlySavings),
    totalDebt,
    monthsToPayOffDebt: monthlySavings > 0 ? Math.ceil(totalDebt / monthlySavings) : null,
    projections,
    categorySpending
  });
});

// ═══════════════════════════════════════════════════════════════════
// INSTALLMENTS
// ═══════════════════════════════════════════════════════════════════

router.get('/installments', (req, res) => {
  res.json(readData('installments'));
});

router.post('/installments', (req, res) => {
  const errs = validate(req.body, {
    name: { required: true },
    totalAmount: { required: true, type: 'number', min: 0 },
    installmentCount: { required: true, type: 'number', min: 1 }
  });
  if (errs.length) return res.status(400).json({ error: errs.join(', ') });

  const installments = readData('installments');
  const transactions = readData('transactions');

  const monthlyAmount = parseFloat(req.body.totalAmount) / parseInt(req.body.installmentCount);
  const paidCount = parseInt(req.body.paidCount || 0);
  const startYear = parseInt(req.body.startYear || new Date().getFullYear());
  const startMonth = parseInt(req.body.startMonth || (new Date().getMonth() + 1));

  const inst = {
    id: generateId(),
    name: req.body.name,
    totalAmount: parseFloat(req.body.totalAmount),
    installmentCount: parseInt(req.body.installmentCount),
    paidCount,
    monthlyAmount: Math.round(monthlyAmount * 100) / 100,
    remainingAmount: Math.round((parseInt(req.body.installmentCount) - paidCount) * monthlyAmount * 100) / 100,
    startYear, startMonth,
    category: req.body.category || 'cat-taksit',
    source: req.body.source || 'manual',
    isActive: true,
    createdAt: new Date().toISOString()
  };

  installments.push(inst);

  // Auto-generate remaining installment transactions
  for (let i = paidCount; i < inst.installmentCount; i++) {
    let m = startMonth + i;
    let y = startYear;
    while (m > 12) { m -= 12; y++; }

    transactions.push({
      id: generateId(),
      date: `${y}-${String(m).padStart(2, '0')}-01`,
      amount: inst.monthlyAmount,
      type: 'expense',
      category: inst.category,
      description: `${inst.name} - Taksit ${i + 1}/${inst.installmentCount}`,
      isRecurring: false,
      recurringId: null,
      source: inst.source,
      confidence: 1.0,
      status: 'confirmed',
      importId: null,
      installmentId: inst.id,
      createdAt: new Date().toISOString()
    });
  }

  writeData('installments', installments);
  writeData('transactions', transactions);
  addAuditLog('create', 'installment', inst.id, inst.source, inst.name);
  res.status(201).json(inst);
});

router.delete('/installments/:id', (req, res) => {
  let installments = readData('installments');
  let transactions = readData('transactions');

  installments = installments.filter(i => i.id !== req.params.id);
  transactions = transactions.filter(t => t.installmentId !== req.params.id);

  writeData('installments', installments);
  writeData('transactions', transactions);
  addAuditLog('delete', 'installment', req.params.id, 'manual', '');
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════
// NOTES (Informal obligations)
// ═══════════════════════════════════════════════════════════════════

router.get('/notes', (req, res) => {
  res.json(readData('notes'));
});

router.post('/notes', (req, res) => {
  const notes = readData('notes');
  const note = {
    id: generateId(),
    title: req.body.title || '',
    content: req.body.content || '',
    amount: parseFloat(req.body.amount || 0),
    isObligation: req.body.isObligation || false,
    frequency: req.body.frequency || 'once', // once | monthly | custom
    category: req.body.category || 'cat-diger',
    convertedToRecord: false,
    source: req.body.source || 'manual',
    createdAt: new Date().toISOString()
  };
  notes.push(note);
  writeData('notes', notes);
  addAuditLog('create', 'note', note.id, note.source, note.title);
  res.status(201).json(note);
});

router.put('/notes/:id', (req, res) => {
  const notes = readData('notes');
  const idx = notes.findIndex(n => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Note not found' });
  notes[idx] = { ...notes[idx], ...req.body, id: req.params.id };
  writeData('notes', notes);
  res.json(notes[idx]);
});

router.delete('/notes/:id', (req, res) => {
  let notes = readData('notes');
  notes = notes.filter(n => n.id !== req.params.id);
  writeData('notes', notes);
  res.json({ success: true });
});

// Convert note to structured recurring expense/transaction
router.post('/notes/:id/convert', (req, res) => {
  const notes = readData('notes');
  const idx = notes.findIndex(n => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Note not found' });

  const note = notes[idx];
  if (note.frequency === 'monthly' && note.amount > 0) {
    // Create as recurring
    const recurring = readData('recurring');
    const transactions = readData('transactions');
    const now = new Date();
    const rec = {
      id: generateId(),
      description: note.title,
      amount: note.amount,
      type: 'expense',
      category: note.category,
      startYear: now.getFullYear(),
      startMonth: now.getMonth() + 1,
      durationMonths: parseInt(req.body.durationMonths || 12),
      isActive: true,
      createdAt: new Date().toISOString()
    };
    recurring.push(rec);

    for (let i = 0; i < rec.durationMonths; i++) {
      let m = rec.startMonth + i;
      let y = rec.startYear;
      while (m > 12) { m -= 12; y++; }
      transactions.push({
        id: generateId(),
        date: `${y}-${String(m).padStart(2, '0')}-01`,
        amount: rec.amount, type: 'expense', category: rec.category,
        description: rec.description + ' (Otomatik)',
        isRecurring: true, recurringId: rec.id,
        source: 'manual', confidence: 1.0, status: 'confirmed', importId: null,
        createdAt: new Date().toISOString()
      });
    }
    writeData('recurring', recurring);
    writeData('transactions', transactions);
  } else if (note.amount > 0) {
    // Create single transaction
    const transactions = readData('transactions');
    transactions.push({
      id: generateId(),
      date: new Date().toISOString().split('T')[0],
      amount: note.amount, type: 'expense', category: note.category,
      description: note.title,
      isRecurring: false, recurringId: null,
      source: 'manual', confidence: 1.0, status: 'confirmed', importId: null,
      createdAt: new Date().toISOString()
    });
    writeData('transactions', transactions);
  }

  notes[idx].convertedToRecord = true;
  writeData('notes', notes);
  addAuditLog('convert', 'note', note.id, 'manual', note.title);
  res.json({ success: true, note: notes[idx] });
});

// ═══════════════════════════════════════════════════════════════════
// DEBT PAYMENTS
// ═══════════════════════════════════════════════════════════════════

router.post('/debts/:id/payments', (req, res) => {
  const debts = readData('debts');
  const idx = debts.findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Debt not found' });

  const payment = {
    id: generateId(),
    amount: parseFloat(req.body.amount),
    date: req.body.date || new Date().toISOString().split('T')[0],
    note: req.body.note || ''
  };

  if (!debts[idx].payments) debts[idx].payments = [];
  debts[idx].payments.push(payment);
  debts[idx].currentBalance = Math.max(0, debts[idx].currentBalance - payment.amount);

  writeData('debts', debts);
  addAuditLog('payment', 'debt', debts[idx].id, 'manual', `${payment.amount} TL ödeme`);
  res.json(debts[idx]);
});

// ═══════════════════════════════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════════════════════════════

router.get('/audit-log', (req, res) => {
  const logs = readData('auditlog');
  const { source, entity, limit } = req.query;
  let filtered = logs;
  if (source) filtered = filtered.filter(l => l.source === source);
  if (entity) filtered = filtered.filter(l => l.entity === entity);
  filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  if (limit) filtered = filtered.slice(0, parseInt(limit));
  res.json(filtered);
});

// ═══════════════════════════════════════════════════════════════════
// TRANSACTION APPROVAL (Agent-submitted)
// ═══════════════════════════════════════════════════════════════════

router.get('/transactions/pending', (req, res) => {
  const transactions = readData('transactions');
  res.json(transactions.filter(t => t.status === 'pending_review'));
});

router.put('/transactions/:id/approve', (req, res) => {
  const transactions = readData('transactions');
  const idx = transactions.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Transaction not found' });

  transactions[idx].status = 'confirmed';
  if (req.body.amount) transactions[idx].amount = parseFloat(req.body.amount);
  if (req.body.category) transactions[idx].category = req.body.category;
  if (req.body.description) transactions[idx].description = req.body.description;

  writeData('transactions', transactions);
  addAuditLog('approve', 'transaction', req.params.id, 'manual', '');
  res.json(transactions[idx]);
});

router.put('/transactions/:id/reject', (req, res) => {
  const transactions = readData('transactions');
  const idx = transactions.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Transaction not found' });

  transactions[idx].status = 'rejected';
  writeData('transactions', transactions);
  addAuditLog('reject', 'transaction', req.params.id, 'manual', '');
  res.json(transactions[idx]);
});

// ═══════════════════════════════════════════════════════════════════
// RECOMMENDATIONS ENGINE
// ═══════════════════════════════════════════════════════════════════

router.get('/recommendations', (req, res) => {
  const transactions = readData('transactions').filter(t => t.status !== 'rejected');
  const debts = readData('debts');
  const budgets = readData('budgets');
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const recommendations = [];
  const monthTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === year && (d.getMonth() + 1) === month;
  });

  const totalIncome = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalDebt = debts.reduce((s, d) => s + d.currentBalance, 0);
  const totalInterest = debts.reduce((s, d) => s + (d.currentBalance * d.interestRate / 100 / 12), 0);

  // Debt-to-income ratio
  const dti = totalIncome > 0 ? (totalDebt / (totalIncome * 12)) * 100 : 0;
  if (dti > 50) {
    recommendations.push({ type: 'danger', priority: 1, title: 'Yüksek Borç/Gelir Oranı',
      description: `Borç/gelir oranınız %${dti.toFixed(0)}. %50 üzerinde risklidir.`,
      impact: 'Kredi erişiminiz zorlaşabilir.', action: 'Borç ödeme stratejisi oluşturun.' });
  }

  // Fixed obligation ratio
  const recurringData = readData('recurring');
  const fixedObligations = recurringData.filter(r => r.isActive && r.type === 'expense')
    .reduce((s, r) => s + r.amount, 0);
  const fixedRatio = totalIncome > 0 ? (fixedObligations / totalIncome) * 100 : 0;
  if (fixedRatio > 60) {
    recommendations.push({ type: 'warning', priority: 2, title: 'Sabit Yükümlülük Oranı Yüksek',
      description: `Gelirinizin %${fixedRatio.toFixed(0)}\'si sabit giderlere gidiyor.`,
      impact: 'Esneklik azalır.', action: 'Sabit giderleri gözden geçirin.' });
  }

  // Interest burden
  if (totalInterest > 0) {
    const interestRatio = totalIncome > 0 ? (totalInterest / totalIncome) * 100 : 0;
    recommendations.push({ type: interestRatio > 10 ? 'danger' : 'info', priority: 3,
      title: 'Faiz Yükü Analizi',
      description: `Aylık ${Math.round(totalInterest).toLocaleString('tr-TR')} ₺ faiz ödüyorsunuz (gelirin %${interestRatio.toFixed(1)}\'i).`,
      impact: `Yılda ${Math.round(totalInterest * 12).toLocaleString('tr-TR')} ₺ sadece faize gidiyor.`,
      action: 'En yüksek faizli borcu öncelikli ödeyin.' });
  }

  // Overspending
  const budget = budgets.find(b => b.year === year && b.month === month);
  if (budget && budget.totalLimit > 0 && totalExpense > budget.totalLimit) {
    recommendations.push({ type: 'danger', priority: 1, title: 'Bütçe Aşımı!',
      description: `Bu ay bütçenizi ${Math.round(totalExpense - budget.totalLimit).toLocaleString('tr-TR')} ₺ aştınız.`,
      impact: 'Tasarruf hedefiniz aksayabilir.', action: 'Gereksiz harcamaları kısın.' });
  }

  // Savings opportunity
  const net = totalIncome - totalExpense;
  if (net > 0 && totalDebt > 0) {
    recommendations.push({ type: 'tip', priority: 4, title: 'Tasarruf Fırsatı',
      description: `Bu ay ${Math.round(net).toLocaleString('tr-TR')} ₺ artınız var. Bunu borç ödemesine yönlendirin.`,
      impact: `Borçsuz kalma süreniz ${Math.ceil(totalDebt / net)} ay kısalabilir.`,
      action: 'En yüksek faizli borca ekstra ödeme yapın.' });
  }

  if (net > 0 && totalDebt === 0) {
    recommendations.push({ type: 'success', priority: 5, title: 'Harika Durum!',
      description: `Borçsuz ve aylık ${Math.round(net).toLocaleString('tr-TR')} ₺ tasarruf ediyorsunuz.`,
      impact: `1 yılda ${Math.round(net * 12).toLocaleString('tr-TR')} ₺ biriktirebilirsiniz.`,
      action: 'Acil durum fonu veya yatırım düşünün.' });
  }

  recommendations.sort((a, b) => a.priority - b.priority);
  res.json(recommendations);
});

// ═══════════════════════════════════════════════════════════════════
// ENHANCED ANALYTICS
// ═══════════════════════════════════════════════════════════════════

// Monthly trends (last N months)
router.get('/analytics/trends', (req, res) => {
  const transactions = readData('transactions').filter(t => t.status !== 'rejected');
  const months = parseInt(req.query.months || 6);
  const now = new Date();
  const trends = [];

  for (let i = months - 1; i >= 0; i--) {
    let y = now.getFullYear();
    let m = now.getMonth() + 1 - i;
    while (m < 1) { m += 12; y--; }

    const monthTx = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === y && (d.getMonth() + 1) === m;
    });

    trends.push({
      year: y, month: m,
      income: Math.round(monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)),
      expense: Math.round(monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)),
      net: Math.round(monthTx.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0))
    });
  }
  res.json(trends);
});

// Category trends (each category over last N months)
router.get('/analytics/category-trends', (req, res) => {
  const transactions = readData('transactions').filter(t => t.status !== 'rejected' && t.type === 'expense');
  const categories = readData('categories');
  const months = parseInt(req.query.months || 6);
  const now = new Date();

  const result = {};
  categories.forEach(cat => { result[cat.id] = { ...cat, months: [] }; });

  for (let i = months - 1; i >= 0; i--) {
    let y = now.getFullYear();
    let m = now.getMonth() + 1 - i;
    while (m < 1) { m += 12; y--; }

    const monthTx = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === y && (d.getMonth() + 1) === m;
    });

    categories.forEach(cat => {
      const total = monthTx.filter(t => t.category === cat.id).reduce((s, t) => s + t.amount, 0);
      result[cat.id].months.push({ year: y, month: m, total: Math.round(total) });
    });
  }

  res.json(Object.values(result).filter(c => c.months.some(m => m.total > 0)));
});

// Financial ratios
router.get('/analytics/ratios', (req, res) => {
  const transactions = readData('transactions').filter(t => t.status !== 'rejected');
  const debts = readData('debts');
  const recurring = readData('recurring');
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const monthTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === year && (d.getMonth() + 1) === month;
  });

  const totalIncome = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalDebt = debts.reduce((s, d) => s + d.currentBalance, 0);
  const totalInterest = debts.reduce((s, d) => s + (d.currentBalance * d.interestRate / 100 / 12), 0);
  const fixedObligations = recurring.filter(r => r.isActive && r.type === 'expense')
    .reduce((s, r) => s + r.amount, 0);

  res.json({
    debtToIncome: totalIncome > 0 ? Math.round((totalDebt / (totalIncome * 12)) * 10000) / 100 : 0,
    fixedObligationRatio: totalIncome > 0 ? Math.round((fixedObligations / totalIncome) * 10000) / 100 : 0,
    savingsRate: totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 10000) / 100 : 0,
    interestBurden: totalIncome > 0 ? Math.round((totalInterest / totalIncome) * 10000) / 100 : 0,
    discretionaryIncome: Math.round(totalIncome - fixedObligations - totalInterest),
    totalIncome: Math.round(totalIncome),
    totalExpense: Math.round(totalExpense),
    totalDebt: Math.round(totalDebt),
    monthlyInterest: Math.round(totalInterest),
    fixedObligations: Math.round(fixedObligations)
  });
});

// What-if simulation: reduce category spending
router.get('/analytics/what-if', (req, res) => {
  const categoryId = req.query.category;
  const reducePercent = parseFloat(req.query.reducePercent || 20);

  const transactions = readData('transactions').filter(t => t.status !== 'rejected');
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const monthTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === year && (d.getMonth() + 1) === month;
  });

  const totalIncome = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  let categoryExpense = 0;
  if (categoryId) {
    categoryExpense = monthTx.filter(t => t.type === 'expense' && t.category === categoryId)
      .reduce((s, t) => s + t.amount, 0);
  }

  const savings = categoryExpense * (reducePercent / 100);
  const newExpense = totalExpense - savings;
  const newNet = totalIncome - newExpense;

  res.json({
    currentExpense: Math.round(totalExpense),
    categoryExpense: Math.round(categoryExpense),
    reducePercent,
    monthlySavings: Math.round(savings),
    yearlySavings: Math.round(savings * 12),
    newMonthlyExpense: Math.round(newExpense),
    newMonthlyNet: Math.round(newNet)
  });
});

// ═══════════════════════════════════════════════════════════════════
// STRATEGY SIMULATOR (5 modes)
// ═══════════════════════════════════════════════════════════════════

router.get('/analysis/strategies', (req, res) => {
  const debts = readData('debts');
  const transactions = readData('transactions').filter(t => t.status !== 'rejected');
  const extraPayment = parseFloat(req.query.extraPayment || 0);

  if (debts.length === 0) return res.json({ strategies: [] });

  // Calculate available monthly surplus
  const monthlyData = {};
  transactions.forEach(t => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    if (!monthlyData[key]) monthlyData[key] = { income: 0, expense: 0 };
    if (t.type === 'income') monthlyData[key].income += t.amount;
    else monthlyData[key].expense += t.amount;
  });
  const monthVals = Object.values(monthlyData);
  const avgSurplus = monthVals.length > 0
    ? monthVals.reduce((s, m) => s + (m.income - m.expense), 0) / monthVals.length
    : 0;

  const strategies = [
    { name: 'avalanche', label: 'Avalanche (Yüksek Faiz Önce)', ...calculateStrategy(debts, extraPayment, 'avalanche') },
    { name: 'snowball', label: 'Snowball (Küçük Borç Önce)', ...calculateStrategy(debts, extraPayment, 'snowball') },
    { name: 'minimum', label: 'Minimum Ödeme', ...calculateStrategy(debts, 0, 'avalanche') },
    { name: 'aggressive', label: 'Agresif (Tüm Fazla Borça)', ...calculateStrategy(debts, Math.max(0, avgSurplus), 'avalanche') },
    { name: 'balanced', label: 'Dengeli (%60 Borç, %40 Tasarruf)', ...calculateStrategy(debts, Math.max(0, avgSurplus * 0.6), 'avalanche') }
  ];

  strategies.forEach(s => {
    s.monthlySaved = strategies[2].totalInterest > 0
      ? Math.round((strategies[2].totalInterest - s.totalInterest) / Math.max(1, s.totalMonths))
      : 0;
  });

  res.json({ strategies, avgMonthlySurplus: Math.round(avgSurplus) });
});

// ═══════════════════════════════════════════════════════════════════
// UPCOMING PAYMENTS
// ═══════════════════════════════════════════════════════════════════

router.get('/upcoming-payments', (req, res) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const recurring = readData('recurring');
  const installments = readData('installments');

  const upcoming = [];

  // Recurring expenses for this month
  recurring.filter(r => r.isActive).forEach(r => {
    let endMonth = r.startMonth + r.durationMonths - 1;
    let endYear = r.startYear;
    while (endMonth > 12) { endMonth -= 12; endYear++; }

    if ((year > r.startYear || (year === r.startYear && month >= r.startMonth)) &&
        (year < endYear || (year === endYear && month <= endMonth))) {
      upcoming.push({
        type: 'recurring', name: r.description, amount: r.amount,
        category: r.category, dueDate: `${year}-${String(month).padStart(2, '0')}-01`
      });
    }
  });

  // Active installments
  installments.filter(i => i.isActive).forEach(inst => {
    const remaining = inst.installmentCount - inst.paidCount;
    if (remaining > 0) {
      upcoming.push({
        type: 'installment', name: inst.name, amount: inst.monthlyAmount,
        category: inst.category, remaining: `${inst.paidCount}/${inst.installmentCount}`,
        dueDate: `${year}-${String(month).padStart(2, '0')}-01`
      });
    }
  });

  res.json(upcoming);
});

// ═══════════════════════════════════════════════════════════════════
// AGGREGATIONS (weekly/daily)
// ═══════════════════════════════════════════════════════════════════

router.get('/aggregations', (req, res) => {
  const transactions = readData('transactions').filter(t => t.status !== 'rejected');
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
  const groupBy = req.query.groupBy || 'day'; // 'day' | 'week'

  const filtered = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === year && (d.getMonth() + 1) === month;
  });

  if (groupBy === 'week') {
    const weeks = {};
    filtered.forEach(t => {
      const d = new Date(t.date);
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
      const week = Math.ceil((d.getDate() + firstDay) / 7);
      if (!weeks[week]) weeks[week] = { week, income: 0, expense: 0, count: 0 };
      if (t.type === 'income') weeks[week].income += t.amount;
      else weeks[week].expense += t.amount;
      weeks[week].count++;
    });
    res.json(Object.values(weeks).sort((a, b) => a.week - b.week));
  } else {
    const days = {};
    filtered.forEach(t => {
      const day = new Date(t.date).getDate();
      if (!days[day]) days[day] = { day, income: 0, expense: 0, count: 0 };
      if (t.type === 'income') days[day].income += t.amount;
      else days[day].expense += t.amount;
      days[day].count++;
    });
    res.json(Object.values(days).sort((a, b) => a.day - b.day));
  }
});

// ═══════════════════════════════════════════════════════════════════
// SURVIVAL ENGINE ENDPOINTS (Faz 0)
// ═══════════════════════════════════════════════════════════════════

// Helper: build engine from current data
function buildSurvivalEngine() {
  const debts = readData('debts');
  const recurring = readData('recurring');
  const transactions = readData('transactions');
  const installments = readData('installments');

  // Calculate average monthly income from last 3 months
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const recentTx = transactions.filter(t => new Date(t.date) >= threeMonthsAgo);
  const incomes = recentTx.filter(t => t.type === 'income');
  const expenses = recentTx.filter(t => t.type === 'expense');
  const months = Math.max(1, Math.min(3, Math.ceil((now - threeMonthsAgo) / (30 * 86400000))));
  const monthlyIncome = incomes.reduce((s, t) => s + t.amount, 0) / months;
  const variableExpenseAvg = expenses.reduce((s, t) => s + t.amount, 0) / months;

  // Fixed expenses from recurring
  const fixedExpenses = recurring
    .filter(r => r.isActive && r.type === 'expense')
    .map(r => ({ amount: r.amount, description: r.description }));

  // Active installments
  const activeInstallments = installments
    .filter(i => i.isActive)
    .map(i => ({ monthlyAmount: i.monthlyAmount, remaining: i.installmentCount - i.paidCount }));

  return new SurvivalEngine({
    monthlyIncome: Math.round(monthlyIncome),
    debts,
    fixedExpenses,
    variableExpenseAvg: Math.round(variableExpenseAvg - fixedExpenses.reduce((s, e) => s + e.amount, 0)),
    installments: activeInstallments
  });
}

// GET /survival/status — S1, S2, S3, S5, S6, S8, S9
router.get('/survival/status', (req, res) => {
  try {
    const engine = buildSurvivalEngine();
    const currentCash = parseFloat(req.query.cash) || 0;

    res.json({
      survival: engine.survivalStatus(),
      debtGrowth: engine.debtGrowthTest(),
      breakEven: engine.breakEven(),
      liquidityBuffer: engine.liquidityBuffer(currentCash),
      incomeRequirement: engine.incomeRequirement(),
      solvability: engine.solvabilityAnalysis()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /survival/consolidation-sim — S10, S11, S12
router.post('/survival/consolidation-sim', (req, res) => {
  try {
    const engine = buildSurvivalEngine();
    const { newInterestRate = 36, terms = [12, 24, 36], costs = 0, onlyAboveRate = null } = req.body;

    const sim = engine.consolidationSimulation({ newInterestRate, terms, costs, onlyAboveRate });
    const survival = engine.survivalStatus();

    // Add refinance warnings for each scenario
    const scenariosWithWarnings = sim.scenarios.map(s => ({
      ...s,
      warnings: engine.refinanceFilters({
        newMonthlyPayment: s.monthlyPayment,
        currentGap: survival.gap
      })
    }));

    res.json({ ...sim, scenarios: scenariosWithWarnings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /survival/sustainability — S7, S8
router.get('/survival/sustainability', (req, res) => {
  try {
    const engine = buildSurvivalEngine();
    const cutPercent = parseFloat(req.query.cutPercent) || 20;

    res.json({
      timeBuying: engine.timeBuyingStrategy(),
      psychological: engine.psychologicalSustainability(cutPercent)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Crisis Transactions CRUD ───────────────────────────────────
router.get('/crisis-transactions', (req, res) => {
  res.json(readData('crisis_transactions'));
});

router.post('/crisis-transactions', (req, res) => {
  const data = readData('crisis_transactions');
  const tx = {
    id: crypto.randomUUID(),
    type: req.body.type || 'SHORT_TERM_BRIDGE_BORROWING',
    sourceDebt: req.body.sourceDebt || null,
    targetDebt: req.body.targetDebt || null,
    grossAmount: req.body.grossAmount || 0,
    netCashReceived: req.body.netCashReceived || 0,
    fees: req.body.fees || 0,
    newInterestRate: req.body.newInterestRate || 0,
    termDays: req.body.termDays || 30,
    date: req.body.date || new Date().toISOString().split('T')[0],
    riskScore: req.body.riskScore || 5,
    note: req.body.note || '',
    createdAt: new Date().toISOString()
  };
  data.push(tx);
  writeData('crisis_transactions', data);
  addAuditLog('create', 'crisis_transaction', tx.id, 'manual', tx.type);
  res.status(201).json(tx);
});

router.delete('/crisis-transactions/:id', (req, res) => {
  let data = readData('crisis_transactions');
  data = data.filter(t => t.id !== req.params.id);
  writeData('crisis_transactions', data);
  res.json({ success: true });
});

// GET /survival/crisis-analysis — S15-S21
router.get('/survival/crisis-analysis', (req, res) => {
  try {
    const crisisTxs = readData('crisis_transactions');
    const debts = readData('debts');
    const recurring = readData('recurring');

    const engine = new CrisisEngine({
      crisisTransactions: crisisTxs,
      financials: {
        monthlyIncome: parseFloat(req.query.income) || 90000,
        currentCash: parseFloat(req.query.cash) || 0
      },
      debts
    });

    const cycle = engine.cycleDetection();

    // Analyze each recent crisis transaction
    const analyses = crisisTxs.slice(-5).map(tx => {
      const totalDebt = debts.reduce((s, d) => s + d.currentBalance, 0);
      const urgentPayments = recurring
        .filter(r => r.isActive && r.type === 'expense')
        .slice(0, 3)
        .map(r => ({ name: r.description, amount: r.amount }));

      return {
        tx,
        liquidity: engine.netLiquidityGain(tx),
        bridge: engine.bridgeCost(tx),
        debtGrowth: engine.debtGrowthAfterManeuver(tx, totalDebt),
        collapse: engine.collapsePreventionTest(tx, urgentPayments),
        decision: engine.crisisDecision(tx, urgentPayments)
      };
    });

    res.json({ cycle, analyses, txTypes: CrisisEngine.TX_TYPES });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /survival/cycle-detection — S19
router.get('/survival/cycle-detection', (req, res) => {
  try {
    const crisisTxs = readData('crisis_transactions');
    const debts = readData('debts');
    const days = parseInt(req.query.days) || 60;

    const engine = new CrisisEngine({ crisisTransactions: crisisTxs, debts });
    res.json(engine.cycleDetection(days));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const TaxService = require('../services/TaxService');
const OvertimeService = require('../services/OvertimeService');

// ═══════════════════════════════════════════════════════════════════
// TAX & SALARY ENGINE ENDPOINTS (Faz 1)
// ═══════════════════════════════════════════════════════════════════

// POST /tax/simulate-year — T1, T3
router.post('/tax/simulate-year', (req, res) => {
  try {
    const { monthlyGross = 90000, extraIncomeByMonth = new Array(12).fill(0) } = req.body;
    const svc = new TaxService({ monthlyGross, extraIncomeByMonth });
    const year = svc.calculateFullYear();
    const projection = svc.netSalaryProjection();
    res.json({ ...year, projection });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /tax/bracket-forecast — T2
router.get('/tax/bracket-forecast', (req, res) => {
  try {
    const gross = parseFloat(req.query.gross) || 90000;
    const svc = new TaxService({ monthlyGross: gross });
    res.json(svc.bracketTransitions());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /tax/marginal-rate — T5
router.get('/tax/marginal-rate', (req, res) => {
  try {
    const gross = parseFloat(req.query.gross) || 90000;
    const month = parseInt(req.query.month) || null;
    const svc = new TaxService({ monthlyGross: gross });
    res.json(svc.marginalTaxRate(month));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /tax/extra-income-sim — T4, T6
router.post('/tax/extra-income-sim', (req, res) => {
  try {
    const { monthlyGross = 90000, extraAmount = 10000, targetMonth = null, extraIncomeByMonth = new Array(12).fill(0) } = req.body;
    const svc = new TaxService({ monthlyGross, extraIncomeByMonth });
    const sim = svc.simulateExtraIncome(extraAmount, targetMonth);
    const erosion = targetMonth ? svc.incentiveErosion(extraAmount, targetMonth) : null;
    res.json({ simulation: sim, erosion });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /tax/optimize — T7
router.post('/tax/optimize', (req, res) => {
  try {
    const { monthlyGross = 90000, totalExtraYearly = 120000 } = req.body;
    const svc = new TaxService({ monthlyGross });
    res.json(svc.taxOptimization(totalExtraYearly));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /overtime/simulate — T9, T10, T11, T12
router.post('/overtime/simulate', (req, res) => {
  try {
    const {
      monthlyGross = 90000,
      hourlyOvertimeGross = 750,
      hours = 10,
      targetMonth = new Date().getMonth() + 1,
      extraIncomeByMonth = new Array(12).fill(0)
    } = req.body;

    const svc = new OvertimeService({ monthlyGross, hourlyOvertimeGross, extraIncomeByMonth, targetMonth });

    res.json({
      marginal: svc.marginalNetIncome(hours),
      hourly: svc.hourlyRealNet(hours),
      worthiness: svc.worthinessScore(hours),
      threshold: svc.optimalThreshold(Math.max(hours * 2, 20))
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /overtime/target — T13
router.post('/overtime/target', (req, res) => {
  try {
    const { monthlyGross = 90000, hourlyOvertimeGross = 750, targetNet = 15000, targetMonth } = req.body;
    const svc = new OvertimeService({ monthlyGross, hourlyOvertimeGross, targetMonth: targetMonth || new Date().getMonth() + 1 });
    res.json(svc.hoursForTarget(targetNet));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /overtime/debt-advice — T14
router.post('/overtime/debt-advice', (req, res) => {
  try {
    const { monthlyGross = 90000, hourlyOvertimeGross = 750, hours = 10, targetMonth } = req.body;
    const debts = readData('debts');
    const svc = new OvertimeService({ monthlyGross, hourlyOvertimeGross, targetMonth: targetMonth || new Date().getMonth() + 1 });
    res.json(svc.debtAllocationAdvice(hours, debts));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /overtime/survival-impact — T15
router.post('/overtime/survival-impact', (req, res) => {
  try {
    const { monthlyGross = 90000, hourlyOvertimeGross = 750, hours = 10, targetMonth } = req.body;
    const survivalEngine = buildSurvivalEngine();
    const survival = survivalEngine.survivalStatus();
    const svc = new OvertimeService({ monthlyGross, hourlyOvertimeGross, targetMonth: targetMonth || new Date().getMonth() + 1 });
    res.json(svc.survivalImpact(hours, survival.gapWithVariable));
  } catch (err) { res.status(500).json({ error: err.message }); }
});
const {
  DailyCompoundingInterest, MonthlyCompoundingInterest, AnnuityLoanModel,
  TRANSACTION_SOURCE_TYPES, minPaymentTrapSimulation, threeScenarioCashflow, debtPriorityScore
} = require('../services/InterestModels');

// ═══════════════════════════════════════════════════════════════════
// FINANCE ENGINE ENDPOINTS (Faz 2)
// ═══════════════════════════════════════════════════════════════════

// GET /finance/interest-info — A1, A2
router.get('/finance/interest-info', (req, res) => {
  try {
    const debts = readData('debts');
    const results = debts.map(d => {
      let model, info;
      if (d.type === 'credit_card') {
        model = new DailyCompoundingInterest(d.interestRate);
        info = model.info();
        info.monthlyInterest = Math.round(model.monthlyInterest(d.currentBalance));
        info.effectiveAnnualCompound = model.effectiveAnnualRate().toFixed(2) + '%';
      } else if (d.type === 'overdraft') {
        const monthlyRate = d.interestRate / 12;
        model = new MonthlyCompoundingInterest(monthlyRate);
        info = model.info();
        info.monthlyInterest = Math.round(model.monthlyInterest(d.currentBalance));
      } else {
        model = new AnnuityLoanModel(d.interestRate, d.remainingMonths || 24, d.currentBalance);
        info = model.info();
      }
      return { debtName: d.name, debtType: d.type, balance: d.currentBalance, ...info };
    });
    res.json({ debts: results, taxRates: { BSMV: '10%', KKDF: '15%' } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /finance/min-payment-trap — A4
router.post('/finance/min-payment-trap', (req, res) => {
  try {
    const { balance, annualRate = 60, minPaymentPercent = 0.02, minPaymentFloor = 100 } = req.body;
    if (!balance) return res.status(400).json({ error: 'balance gerekli' });
    res.json(minPaymentTrapSimulation(balance, annualRate, minPaymentPercent, minPaymentFloor));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /finance/cashflow — A5
router.get('/finance/cashflow', (req, res) => {
  try {
    const engine = buildSurvivalEngine();
    const survival = engine.survivalStatus();
    const debts = readData('debts');

    const interestCosts = debts.reduce((s, d) => {
      if (d.type === 'credit_card') {
        return s + new DailyCompoundingInterest(d.interestRate).monthlyInterest(d.currentBalance);
      }
      return s + (d.currentBalance * (d.interestRate / 100) / 12);
    }, 0);

    const result = threeScenarioCashflow({
      income: survival.income,
      fixedExpenses: survival.breakdown.find(b => b.name === 'Sabit Giderler')?.amount || 0,
      variableExpenses: survival.variableExpense,
      debtPayments: survival.breakdown.find(b => b.name === 'Minimum Borç Ödemeleri')?.amount || 0,
      interestCosts: Math.round(interestCosts)
    });

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /finance/debt-priority — A6
router.get('/finance/debt-priority', (req, res) => {
  try {
    const debts = readData('debts');
    const scored = debts.map(d => debtPriorityScore(d)).sort((a, b) => b.score - a.score);
    res.json({ priorities: scored });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /finance/amortization/:debtId — Annuity tablo
router.get('/finance/amortization/:debtId', (req, res) => {
  try {
    const debts = readData('debts');
    const debt = debts.find(d => d.id === req.params.debtId);
    if (!debt) return res.status(404).json({ error: 'Borç bulunamadı' });
    const model = new AnnuityLoanModel(debt.interestRate, debt.remainingMonths || 24, debt.currentBalance);
    res.json({ ...model.info(), table: model.amortizationTable() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /finance/source-types — A3
router.get('/finance/source-types', (req, res) => {
  res.json(TRANSACTION_SOURCE_TYPES);
});

const AnalysisEngine = require('../services/AnalysisEngine');

// ═══════════════════════════════════════════════════════════════════
// AKILLI ANALİZ ENDPOINTLERİ (Faz 3, B1–B9)
// ═══════════════════════════════════════════════════════════════════

function createAnalysisEngine(cashOverride) {
  const transactions = readData('transactions');
  const debts = readData('debts');
  const recurring = readData('recurring');
  const settings = readData('settings');
  const cash = cashOverride !== undefined ? parseFloat(cashOverride) : (settings.currentCash || 0);
  const assets = settings.assets || {};
  return new AnalysisEngine({ transactions, debts, recurring, currentCash: cash, assets });
}

// GET /analysis/snapshot?year=2026&month=3 — B1: Aylık Snapshot
router.get('/analysis/snapshot', (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const engine = createAnalysisEngine(req.query.cash);
    res.json(engine.monthlySnapshot(year, month));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /analysis/net-worth — B2: Net Değer
router.get('/analysis/net-worth', (req, res) => {
  try {
    const engine = createAnalysisEngine(req.query.cash);
    res.json(engine.netWorth());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /analysis/liquidity-risk?months=3 — B3: Likidite Risk
router.get('/analysis/liquidity-risk', (req, res) => {
  try {
    const months = parseInt(req.query.months) || 3;
    const engine = createAnalysisEngine(req.query.cash);
    res.json(engine.liquidityRisk(months));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /analysis/constraint-optimization — B4: Kısıt Optimizasyonu
router.post('/analysis/constraint-optimization', (req, res) => {
  try {
    const { maxMonthlyPayment = 30000, minLivingExpense = 20000 } = req.body;
    const engine = createAnalysisEngine(req.body.cash);
    res.json(engine.constraintOptimization(maxMonthlyPayment, minLivingExpense));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /analysis/forecast?months=3 — B5: Trend Tahmini
router.get('/analysis/forecast', (req, res) => {
  try {
    const months = parseInt(req.query.months) || 3;
    const engine = createAnalysisEngine(req.query.cash);
    res.json(engine.forecast(months));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /analysis/category-forecast — B6: Kategori Gider Tahmini
router.get('/analysis/category-forecast', (req, res) => {
  try {
    const engine = createAnalysisEngine(req.query.cash);
    res.json(engine.categoryForecast());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /analysis/deviation?year=2026&month=3 — B7: Sapma Analizi
router.get('/analysis/deviation', (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const engine = createAnalysisEngine(req.query.cash);
    res.json(engine.deviationAnalysis(year, month));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /analysis/end-of-month?year=2026&month=3 — B8: Dönem Sonu Tahmin
router.get('/analysis/end-of-month', (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const engine = createAnalysisEngine(req.query.cash);
    res.json(engine.endOfMonthEstimate(year, month));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /analysis/savings-potential — B9: Tasarruf Potansiyeli
router.get('/analysis/savings-potential', (req, res) => {
  try {
    const engine = createAnalysisEngine(req.query.cash);
    res.json(engine.savingsPotential());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /analysis/full — Tüm B1-B9 tek seferde
router.get('/analysis/full', (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const engine = createAnalysisEngine(req.query.cash);
    res.json({
      snapshot: engine.monthlySnapshot(year, month),
      netWorth: engine.netWorth(),
      liquidityRisk: engine.liquidityRisk(3),
      forecast: engine.forecast(3),
      categoryForecast: engine.categoryForecast(),
      deviation: engine.deviationAnalysis(year, month),
      endOfMonth: engine.endOfMonthEstimate(year, month),
      savingsPotential: engine.savingsPotential()
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const BehavioralEngine = require('../services/BehavioralEngine');

// ═══════════════════════════════════════════════════════════════════
// DAVRANIŞSAL FİNANS ENDPOINTLERİ (Faz 4, B10–B17)
// ═══════════════════════════════════════════════════════════════════

function createBehavioralEngine(incomeOverride) {
  const transactions = readData('transactions');
  const debts = readData('debts');
  const recurring = readData('recurring');
  const incomeFromRecurring = recurring
    .filter(r => r.isActive && r.type === 'income')
    .reduce((s, r) => s + r.amount, 0);
  const monthlyIncome = incomeOverride !== undefined ? parseFloat(incomeOverride) : incomeFromRecurring;
  return new BehavioralEngine({ transactions, debts, recurring, monthlyIncome });
}

// GET /behavioral/patterns — B10: Harcama Pattern
router.get('/behavioral/patterns', (req, res) => {
  try {
    const engine = createBehavioralEngine(req.query.income);
    res.json(engine.spendingPatterns());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /behavioral/anomalies — B11: Anomali Tespiti
router.get('/behavioral/anomalies', (req, res) => {
  try {
    const engine = createBehavioralEngine(req.query.income);
    res.json(engine.anomalyDetection());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /behavioral/what-changed?year=2026&month=3 — B12: What Changed
router.get('/behavioral/what-changed', (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const engine = createBehavioralEngine(req.query.income);
    res.json(engine.whatChanged(year, month));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /behavioral/stress — B13: Financial Stress Index
router.get('/behavioral/stress', (req, res) => {
  try {
    const engine = createBehavioralEngine(req.query.income);
    res.json(engine.financialStress());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /behavioral/salary-erosion?year=2026&month=3 — B14: Maaş Erime
router.get('/behavioral/salary-erosion', (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const engine = createBehavioralEngine(req.query.income);
    res.json(engine.salaryErosion(year, month));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /behavioral/risk-score — B15: Risk Skoru
router.get('/behavioral/risk-score', (req, res) => {
  try {
    const engine = createBehavioralEngine(req.query.income);
    res.json(engine.riskScore());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /behavioral/daily-limit?year=2026&month=3 — B16: Günlük Limit
router.get('/behavioral/daily-limit', (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const engine = createBehavioralEngine(req.query.income);
    res.json(engine.dailyLimit(year, month));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /behavioral/monte-carlo?months=6 — B17: Monte Carlo Stres Testi
router.get('/behavioral/monte-carlo', (req, res) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const sims = Math.min(1000, parseInt(req.query.simulations) || 500);
    const engine = createBehavioralEngine(req.query.income);
    res.json(engine.monteCarlo(months, sims));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /behavioral/full — Tüm B10-B17 tek seferde
router.get('/behavioral/full', (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const engine = createBehavioralEngine(req.query.income);
    res.json({
      patterns: engine.spendingPatterns(),
      anomalies: engine.anomalyDetection(),
      whatChanged: engine.whatChanged(year, month),
      stress: engine.financialStress(),
      salaryErosion: engine.salaryErosion(year, month),
      riskScore: engine.riskScore(),
      dailyLimit: engine.dailyLimit(year, month),
      monteCarlo: engine.monteCarlo(6, 300)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const DuplicateDetector = require('../services/DuplicateDetector');
const ImportPipeline = require('../services/ImportPipeline');
const NLPParser = require('../services/NLPParser');
const AutoCategorizer = require('../services/AutoCategorizer');
const NotificationService = require('../services/NotificationService');
const SnapshotService = require('../services/SnapshotService');
const ActionEngine = require('../services/ActionEngine');
const GoalService = require('../services/GoalService');
const InflationService = require('../services/InflationService');
const ReportService = require('../services/ReportService');

// ═══════════════════════════════════════════════════════════════════
// FAZ 5 — AGENT & PIPELINE ENDPOINTLERİ
// ═══════════════════════════════════════════════════════════════════

// POST /nlp/parse — Doğal dil → yapılandırılmış veri
router.post('/nlp/parse', (req, res) => {
  try {
    const parser = new NLPParser();
    const { text, texts } = req.body;
    if (texts && Array.isArray(texts)) {
      res.json(parser.parseBatch(texts));
    } else if (text) {
      res.json(parser.parse(text));
    } else {
      res.status(400).json({ error: 'text veya texts alanı gerekli' });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /import/process — Import pipeline (raw → validated)
router.post('/import/process', (req, res) => {
  try {
    const { items, source = 'manual' } = req.body;
    if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'items array gerekli' });

    const categories = readData('categories');
    const transactions = readData('transactions');
    const pipeline = new ImportPipeline({ categories, existingTransactions: transactions });
    const autoCat = new AutoCategorizer();
    const dupDetector = new DuplicateDetector(transactions);

    const result = pipeline.process(items, source, autoCat, dupDetector);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /import/commit — Onaylanan kayıtları kaydet
router.post('/import/commit', (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'items array gerekli' });

    const pipeline = new ImportPipeline({});
    const committed = pipeline.commit(items.map(i => ({ ...i, _status: 'approved' })));

    const transactions = readData('transactions');
    transactions.push(...committed);
    writeData('transactions', transactions);

    committed.forEach(tx => addAuditLog('import', 'transaction', tx.id, tx.source || 'import', tx.type));

    res.json({ committed: committed.length, items: committed });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /duplicate/check — Duplicate kontrolü
router.post('/duplicate/check', (req, res) => {
  try {
    const transactions = readData('transactions');
    const detector = new DuplicateDetector(transactions);
    const { transaction, transactions: txBatch } = req.body;

    if (txBatch && Array.isArray(txBatch)) {
      res.json(detector.checkBatch(txBatch));
    } else if (transaction) {
      res.json(detector.check(transaction));
    } else {
      res.status(400).json({ error: 'transaction veya transactions alanı gerekli' });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /categorize — Otomatik kategorizasyon
router.post('/categorize', (req, res) => {
  try {
    const autoCat = new AutoCategorizer();
    const { text, items } = req.body;

    if (items && Array.isArray(items)) {
      res.json(autoCat.categorizeBatch(items));
    } else if (text) {
      res.json(autoCat.categorize(text));
    } else {
      res.status(400).json({ error: 'text veya items alanı gerekli' });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /categorize/mappings — Tüm merchant mapping'leri
router.get('/categorize/mappings', (req, res) => {
  try {
    const autoCat = new AutoCategorizer();
    res.json(autoCat.getMappings());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /notifications — Tüm bildirimleri getir
router.get('/notifications', (req, res) => {
  try {
    const transactions = readData('transactions');
    const debts = readData('debts');
    const recurring = readData('recurring');
    const budgets = readData('budgets');
    const incomeFromRecurring = recurring.filter(r => r.isActive && r.type === 'income').reduce((s, r) => s + r.amount, 0);

    const svc = new NotificationService({
      debts, recurring, transactions, budgets, monthlyIncome: incomeFromRecurring
    });
    res.json(svc.generateAll());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /snapshots — Tüm snapshotları getir
router.get('/snapshots', (req, res) => {
  try {
    ensureDataDir();
    const file = path.join(DATA_DIR, 'snapshots.json');
    if (!fs.existsSync(file)) fs.writeFileSync(file, '[]', 'utf-8');
    res.json(JSON.parse(fs.readFileSync(file, 'utf-8')));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /snapshots/generate — Eksik snapshotları oluştur
router.post('/snapshots/generate', (req, res) => {
  try {
    ensureDataDir();
    const file = path.join(DATA_DIR, 'snapshots.json');
    if (!fs.existsSync(file)) fs.writeFileSync(file, '[]', 'utf-8');

    const existing = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const svc = new SnapshotService({
      transactions: readData('transactions'),
      debts: readData('debts'),
      recurring: readData('recurring'),
      budgets: readData('budgets'),
      snapshots: existing
    });

    const newSnapshots = svc.createAllMissing();
    const all = [...existing, ...newSnapshots];
    fs.writeFileSync(file, JSON.stringify(all, null, 2), 'utf-8');

    res.json({ existing: existing.length, new: newSnapshots.length, total: all.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /snapshots/trend — Snapshot trend analizi
router.get('/snapshots/trend', (req, res) => {
  try {
    ensureDataDir();
    const file = path.join(DATA_DIR, 'snapshots.json');
    if (!fs.existsSync(file)) fs.writeFileSync(file, '[]', 'utf-8');
    const snapshots = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const svc = new SnapshotService({ snapshots });
    res.json(svc.trend(parseInt(req.query.months) || 6));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /actions — Kural tabanlı aksiyonlar
router.get('/actions', (req, res) => {
  try {
    const transactions = readData('transactions');
    const debts = readData('debts');
    const recurring = readData('recurring');
    const settings = readData('settings');
    const income = recurring.filter(r => r.isActive && r.type === 'income').reduce((s, r) => s + r.amount, 0);

    const engine = new ActionEngine({
      debts, transactions, recurring,
      monthlyIncome: income,
      currentCash: settings.currentCash || 0
    });
    res.json(engine.generateActions());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /actions/validate-plan — Plan gerçekçilik kontrolü
router.post('/actions/validate-plan', (req, res) => {
  try {
    const transactions = readData('transactions');
    const debts = readData('debts');
    const recurring = readData('recurring');
    const income = recurring.filter(r => r.isActive && r.type === 'income').reduce((s, r) => s + r.amount, 0);

    const engine = new ActionEngine({ debts, transactions, recurring, monthlyIncome: income });
    res.json(engine.validatePlan(req.body));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /actions/reverse-goal — Hedef ters hesaplama
router.post('/actions/reverse-goal', (req, res) => {
  try {
    const transactions = readData('transactions');
    const debts = readData('debts');
    const recurring = readData('recurring');
    const income = recurring.filter(r => r.isActive && r.type === 'income').reduce((s, r) => s + r.amount, 0);

    const engine = new ActionEngine({ debts, transactions, recurring, monthlyIncome: income });
    const { targetPercent = 50, months = 6 } = req.body;
    res.json(engine.reverseGoal(targetPercent, months));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════
// FAZ 6 — UX & RAPORLAMA ENDPOINTLERİ
// ═══════════════════════════════════════════════════════════════════

// --- Goals ---
// GET /goals
router.get('/goals', (req, res) => {
  try {
    ensureDataDir();
    const file = path.join(DATA_DIR, 'goals.json');
    if (!fs.existsSync(file)) fs.writeFileSync(file, '[]', 'utf-8');
    res.json(JSON.parse(fs.readFileSync(file, 'utf-8')));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /goals
router.post('/goals', (req, res) => {
  try {
    ensureDataDir();
    const file = path.join(DATA_DIR, 'goals.json');
    if (!fs.existsSync(file)) fs.writeFileSync(file, '[]', 'utf-8');
    const goals = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const goal = { id: crypto.randomUUID(), ...req.body, currentAmount: req.body.currentAmount || 0, createdAt: new Date().toISOString() };
    goals.push(goal);
    fs.writeFileSync(file, JSON.stringify(goals, null, 2), 'utf-8');
    res.status(201).json(goal);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /goals/:id
router.put('/goals/:id', (req, res) => {
  try {
    ensureDataDir();
    const file = path.join(DATA_DIR, 'goals.json');
    let goals = JSON.parse(fs.readFileSync(file, 'utf-8'));
    goals = goals.map(g => g.id === req.params.id ? { ...g, ...req.body } : g);
    fs.writeFileSync(file, JSON.stringify(goals, null, 2), 'utf-8');
    res.json(goals.find(g => g.id === req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /goals/:id
router.delete('/goals/:id', (req, res) => {
  try {
    ensureDataDir();
    const file = path.join(DATA_DIR, 'goals.json');
    let goals = JSON.parse(fs.readFileSync(file, 'utf-8'));
    goals = goals.filter(g => g.id !== req.params.id);
    fs.writeFileSync(file, JSON.stringify(goals, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /goals/simulate/:id
router.get('/goals/simulate/:id', (req, res) => {
  try {
    const file = path.join(DATA_DIR, 'goals.json');
    const goals = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const goal = goals.find(g => g.id === req.params.id);
    if (!goal) return res.status(404).json({ error: 'Hedef bulunamadı' });

    const recurring = readData('recurring');
    const transactions = readData('transactions');
    const debts = readData('debts');
    const income = recurring.filter(r => r.isActive && r.type === 'income').reduce((s, r) => s + r.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0) / (new Set(transactions.map(t => t.date.substring(0, 7))).size || 1);
    const debtPay = debts.reduce((s, d) => s + d.minPayment, 0);

    const svc = new GoalService({ goals, monthlyIncome: income, monthlyExpense: expense, monthlyDebtPayment: debtPay });
    res.json(svc.simulate(goal));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /goals/reverse-calc
router.post('/goals/reverse-calc', (req, res) => {
  try {
    const recurring = readData('recurring');
    const transactions = readData('transactions');
    const debts = readData('debts');
    const income = recurring.filter(r => r.isActive && r.type === 'income').reduce((s, r) => s + r.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0) / (new Set(transactions.map(t => t.date.substring(0, 7))).size || 1);
    const debtPay = debts.reduce((s, d) => s + d.minPayment, 0);

    const svc = new GoalService({ monthlyIncome: income, monthlyExpense: expense, monthlyDebtPayment: debtPay });
    const { targetAmount = 100000, targetMonths = 12 } = req.body;
    res.json(svc.reverseCalculate(targetAmount, targetMonths));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Inflation ---
// POST /inflation/future-value
router.post('/inflation/future-value', (req, res) => {
  try {
    const svc = new InflationService();
    const { amount = 10000, years = 3, rate } = req.body;
    res.json(svc.futureValue(amount, years, rate));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /inflation/past-value
router.post('/inflation/past-value', (req, res) => {
  try {
    const svc = new InflationService();
    const { amount = 10000, fromYear = 2020 } = req.body;
    res.json(svc.pastValue(amount, fromYear));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /inflation/expense-projection
router.post('/inflation/expense-projection', (req, res) => {
  try {
    const svc = new InflationService();
    const { monthlyExpense = 30000, months = 12, rate } = req.body;
    res.json(svc.expenseProjection(monthlyExpense, months, rate));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /inflation/salary-erosion
router.post('/inflation/salary-erosion', (req, res) => {
  try {
    const svc = new InflationService();
    const { monthlySalary = 90000, years = 3 } = req.body;
    res.json(svc.salaryErosionByInflation(monthlySalary, years));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Reports ---
// GET /reports/yearly-comparison?year1=2025&year2=2026
router.get('/reports/yearly-comparison', (req, res) => {
  try {
    const year1 = parseInt(req.query.year1) || new Date().getFullYear() - 1;
    const year2 = parseInt(req.query.year2) || new Date().getFullYear();
    const svc = new ReportService({ transactions: readData('transactions'), debts: readData('debts') });
    res.json(svc.yearlyComparison(year1, year2));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /reports/tax-summary?year=2026
router.get('/reports/tax-summary', (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const svc = new ReportService({ transactions: readData('transactions') });
    res.json(svc.taxSummary(year));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /reports/pdf?year=2026&month=3
router.get('/reports/pdf', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);

    const transactions = readData('transactions');
    const debts = readData('debts');

    // Snapshot oluştur
    const snapSvc = new SnapshotService({ transactions, debts, recurring: readData('recurring'), budgets: readData('budgets'), snapshots: [] });
    const snapshot = snapSvc.createSnapshot(year, month);

    const reportSvc = new ReportService({ transactions, debts });
    const pdfBuffer = await reportSvc.generatePDF(year, month, snapshot);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=ECO_Rapor_${year}_${String(month).padStart(2, '0')}.pdf`);
    res.send(pdfBuffer);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /calendar?year=2026&month=3 — Takvim verisi
router.get('/calendar', (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);

    const transactions = readData('transactions');
    const recurring = readData('recurring');
    const debts = readData('debts');

    // Gün bazlı işlemler
    const daysInMonth = new Date(year, month, 0).getDate();
    const calendar = {};

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTxs = transactions.filter(t => t.date === dateStr);
      const income = dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

      calendar[d] = {
        date: dateStr,
        day: d,
        dayOfWeek: new Date(dateStr).getDay(),
        transactions: dayTxs,
        income: Math.round(income),
        expense: Math.round(expense),
        net: Math.round(income - expense),
        hasData: dayTxs.length > 0
      };
    }

    // Yaklaşan ödemeler
    const upcomingPayments = debts
      .filter(d => d.dueDate)
      .map(d => ({ name: d.name, dueDate: d.dueDate, amount: d.minPayment, type: 'debt' }));

    recurring.filter(r => r.isActive && r.type === 'expense').forEach(r => {
      upcomingPayments.push({ name: r.description, dueDate: r.nextDate || null, amount: r.amount, type: 'recurring' });
    });

    res.json({ year, month, daysInMonth, calendar, upcomingPayments });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
