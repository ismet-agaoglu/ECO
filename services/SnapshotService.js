// ═══════════════════════════════════════════════════════════════════
// SnapshotService — Aylık Snapshot Sistemi (Faz 5)
// Her ayın sonunda durumu kaydet, geçmişe hızlı erişim
// ═══════════════════════════════════════════════════════════════════

class SnapshotService {
  constructor({ transactions = [], debts = [], recurring = [], budgets = [], snapshots = [] }) {
    this.txs = transactions;
    this.debts = debts;
    this.recurring = recurring;
    this.budgets = budgets;
    this.snapshots = snapshots;
  }

  static _bal(d) {
    if (d.type === 'credit_card' || d.type === 'overdraft') {
      return d.usedAmount !== undefined ? d.usedAmount : (d.currentBalance || 0);
    }
    return d.currentBalance !== undefined ? d.currentBalance : (d.usedAmount || 0);
  }

  /**
   * Belirli ay için snapshot oluştur
   */
  createSnapshot(year, month) {
    const monthTxs = this.txs.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === year && (d.getMonth() + 1) === month;
    });

    const income = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const totalDebt = this.debts.reduce((s, d) => s + SnapshotService._bal(d), 0);
    const totalMinPayment = this.debts.reduce((s, d) => s + d.minPayment, 0);

    // Kategori dağılımı
    const categories = {};
    monthTxs.filter(t => t.type === 'expense').forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + t.amount;
    });

    // Sabit giderler
    const fixedExpenses = this.recurring
      .filter(r => r.isActive && r.type === 'expense')
      .reduce((s, r) => s + r.amount, 0);

    // Risk skoru
    const dti = income > 0 ? totalMinPayment / income : 0;
    const eir = income > 0 ? expense / income : 0;
    const riskScore = Math.min(100, Math.round(dti * 100 + eir * 50));

    return {
      id: `snap-${year}-${String(month).padStart(2, '0')}`,
      year,
      month,
      createdAt: new Date().toISOString(),
      income: Math.round(income),
      expense: Math.round(expense),
      net: Math.round(income - expense),
      totalDebt: Math.round(totalDebt),
      totalMinPayment: Math.round(totalMinPayment),
      fixedExpenses: Math.round(fixedExpenses),
      freeCash: Math.round(income - expense - totalMinPayment),
      transactionCount: monthTxs.length,
      categoryBreakdown: Object.entries(categories)
        .map(([cat, amt]) => ({ category: cat, amount: Math.round(amt) }))
        .sort((a, b) => b.amount - a.amount),
      debtSnapshot: this.debts.map(d => ({
        id: d.id,
        name: d.name,
        balance: SnapshotService._bal(d),
        rate: d.interestRate
      })),
      riskScore,
      riskLabel: riskScore <= 30 ? 'Düşük' : riskScore <= 60 ? 'Orta' : riskScore <= 80 ? 'Yüksek' : 'Kritik'
    };
  }

  /**
   * Tüm geçmiş aylar için snapshot oluştur
   */
  createAllMissing() {
    const months = new Set(this.txs.map(t => t.date.substring(0, 7)));
    const existingIds = new Set(this.snapshots.map(s => s.id));
    const newSnapshots = [];

    for (const monthStr of months) {
      const [y, m] = monthStr.split('-').map(Number);
      const id = `snap-${y}-${String(m).padStart(2, '0')}`;
      if (!existingIds.has(id)) {
        newSnapshots.push(this.createSnapshot(y, m));
      }
    }

    return newSnapshots;
  }

  /**
   * Trend analizi — snapshot'lardan
   */
  trend(lastN = 6) {
    const sorted = [...this.snapshots].sort((a, b) => {
      const aKey = a.year * 100 + a.month;
      const bKey = b.year * 100 + b.month;
      return bKey - aKey;
    }).slice(0, lastN).reverse();

    if (sorted.length < 2) return { message: 'Yetersiz snapshot verisi', data: sorted };

    const incomeTrend = this._trend(sorted.map(s => s.income));
    const expenseTrend = this._trend(sorted.map(s => s.expense));
    const debtTrend = this._trend(sorted.map(s => s.totalDebt));

    return {
      data: sorted,
      trends: {
        income: incomeTrend > 500 ? 'Artıyor' : incomeTrend < -500 ? 'Azalıyor' : 'Stabil',
        expense: expenseTrend > 500 ? 'Artıyor' : expenseTrend < -500 ? 'Azalıyor' : 'Stabil',
        debt: debtTrend > 500 ? 'Artıyor' : debtTrend < -500 ? 'Azalıyor' : 'Stabil',
        netImproving: (incomeTrend - expenseTrend) > 0
      }
    };
  }

  /**
   * İki ayı karşılaştır
   */
  compare(snap1Id, snap2Id) {
    const s1 = this.snapshots.find(s => s.id === snap1Id);
    const s2 = this.snapshots.find(s => s.id === snap2Id);
    if (!s1 || !s2) return { error: 'Snapshot bulunamadı' };

    return {
      period1: { year: s1.year, month: s1.month },
      period2: { year: s2.year, month: s2.month },
      incomeDelta: s2.income - s1.income,
      expenseDelta: s2.expense - s1.expense,
      netDelta: s2.net - s1.net,
      debtDelta: s2.totalDebt - s1.totalDebt,
      riskDelta: s2.riskScore - s1.riskScore,
      improved: s2.net > s1.net && s2.totalDebt <= s1.totalDebt
    };
  }

  _trend(values) {
    if (values.length < 2) return 0;
    const n = values.length;
    const sumX = n * (n - 1) / 2;
    const sumY = values.reduce((s, v) => s + v, 0);
    const sumXY = values.reduce((s, v, i) => s + i * v, 0);
    const sumXX = n * (n - 1) * (2 * n - 1) / 6;
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }
}

module.exports = SnapshotService;
