// ═══════════════════════════════════════════════════════════════════
// NotificationService — Bildirim Sistemi (Faz 5)
// Son ödeme tarihi, bütçe aşımı, anomali, borç uyarıları
// ═══════════════════════════════════════════════════════════════════

class NotificationService {
  constructor({ debts = [], recurring = [], transactions = [], budgets = [], monthlyIncome = 0 }) {
    this.debts = debts;
    this.recurring = recurring;
    this.txs = transactions;
    this.budgets = budgets;
    this.income = monthlyIncome;
    this.today = new Date();
  }

  /**
   * Tüm bildirimleri üret
   */
  generateAll() {
    return [
      ...this.dueDateAlerts(),
      ...this.budgetAlerts(),
      ...this.debtAlerts(),
      ...this.anomalyAlerts(),
      ...this.systemAlerts()
    ].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Son ödeme tarihi uyarıları
   */
  dueDateAlerts() {
    const alerts = [];
    const todayStr = this.today.toISOString().split('T')[0];
    const tomorrow = new Date(this.today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    for (const debt of this.debts) {
      if (!debt.dueDate) continue;
      const dueDate = new Date(debt.dueDate);
      const daysUntil = Math.ceil((dueDate - this.today) / (1000 * 60 * 60 * 24));

      if (daysUntil < 0) {
        alerts.push({
          type: 'due_overdue',
          severity: 'critical',
          priority: 10,
          title: `${debt.name} — SON ÖDEME GEÇTİ!`,
          message: `${Math.abs(daysUntil)} gün gecikme. Tutar: ${this._fmt(debt.minPayment)}`,
          debtId: debt.id,
          icon: '🚨'
        });
      } else if (daysUntil === 0) {
        alerts.push({
          type: 'due_today',
          severity: 'high',
          priority: 9,
          title: `${debt.name} — BUGÜN SON ÖDEME`,
          message: `Minimum ödeme: ${this._fmt(debt.minPayment)}`,
          debtId: debt.id,
          icon: '⚠️'
        });
      } else if (daysUntil === 1) {
        alerts.push({
          type: 'due_tomorrow',
          severity: 'high',
          priority: 8,
          title: `${debt.name} — Yarın son ödeme`,
          message: `Minimum ödeme: ${this._fmt(debt.minPayment)}`,
          debtId: debt.id,
          icon: '📅'
        });
      } else if (daysUntil <= 3) {
        alerts.push({
          type: 'due_soon',
          severity: 'medium',
          priority: 6,
          title: `${debt.name} — ${daysUntil} gün kaldı`,
          message: `Son ödeme: ${debt.dueDate}. Tutar: ${this._fmt(debt.minPayment)}`,
          debtId: debt.id,
          icon: '📋'
        });
      } else if (daysUntil <= 7) {
        alerts.push({
          type: 'due_upcoming',
          severity: 'low',
          priority: 3,
          title: `${debt.name} — ${daysUntil} gün kaldı`,
          message: `Son ödeme: ${debt.dueDate}`,
          debtId: debt.id,
          icon: '📌'
        });
      }
    }

    return alerts;
  }

  /**
   * Bütçe aşımı uyarıları
   */
  budgetAlerts() {
    const alerts = [];
    const now = this.today;
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const monthTxs = this.txs.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === year && (d.getMonth() + 1) === month && t.type === 'expense';
    });

    // Kategori bazlı bütçe kontrolü
    const catSpending = {};
    monthTxs.forEach(t => {
      catSpending[t.category] = (catSpending[t.category] || 0) + t.amount;
    });

    for (const budget of this.budgets) {
      if (!budget.category || !budget.limit) continue;
      const spent = catSpending[budget.category] || 0;
      const ratio = spent / budget.limit;

      if (ratio > 1) {
        alerts.push({
          type: 'budget_exceeded',
          severity: 'high',
          priority: 7,
          title: `${budget.category} bütçesi aşıldı!`,
          message: `Limit: ${this._fmt(budget.limit)} | Harcanan: ${this._fmt(spent)} (%${Math.round(ratio * 100)})`,
          icon: '🔴'
        });
      } else if (ratio > 0.8) {
        alerts.push({
          type: 'budget_warning',
          severity: 'medium',
          priority: 5,
          title: `${budget.category} bütçesi %${Math.round(ratio * 100)}'e ulaştı`,
          message: `Kalan: ${this._fmt(budget.limit - spent)}`,
          icon: '🟡'
        });
      }
    }

    // Toplam harcama uyarısı
    const totalSpent = monthTxs.reduce((s, t) => s + t.amount, 0);
    if (this.income > 0 && totalSpent > this.income * 0.9) {
      alerts.push({
        type: 'spending_high',
        severity: totalSpent > this.income ? 'critical' : 'high',
        priority: totalSpent > this.income ? 9 : 7,
        title: totalSpent > this.income ? 'Aylık gelir aşıldı!' : 'Harcamalar gelirin %90\'ını aştı',
        message: `Gelir: ${this._fmt(this.income)} | Harcanan: ${this._fmt(totalSpent)}`,
        icon: totalSpent > this.income ? '🚨' : '⚠️'
      });
    }

    return alerts;
  }

  /**
   * Borç uyarıları
   */
  debtAlerts() {
    const alerts = [];

    for (const debt of this.debts) {
      // Büyüyen borç uyarısı
      const monthlyInterest = debt.currentBalance * (debt.interestRate / 100);
      if (debt.minPayment < monthlyInterest) {
        alerts.push({
          type: 'debt_growing',
          severity: 'high',
          priority: 8,
          title: `${debt.name} borcu büyüyor!`,
          message: `Aylık faiz: ${this._fmt(monthlyInterest)} > Min ödeme: ${this._fmt(debt.minPayment)}`,
          debtId: debt.id,
          icon: '📈'
        });
      }

      // Limit yaklaşımı (kredi kartı)
      if (debt.limit && debt.currentBalance > debt.limit * 0.9) {
        alerts.push({
          type: 'limit_warning',
          severity: 'medium',
          priority: 6,
          title: `${debt.name} limitinin %${Math.round(debt.currentBalance / debt.limit * 100)}'ine ulaştı`,
          message: `Bakiye: ${this._fmt(debt.currentBalance)} / Limit: ${this._fmt(debt.limit)}`,
          debtId: debt.id,
          icon: '💳'
        });
      }
    }

    // Toplam borç/gelir oranı
    const totalDebt = this.debts.reduce((s, d) => s + d.currentBalance, 0);
    const totalMin = this.debts.reduce((s, d) => s + d.minPayment, 0);
    if (this.income > 0 && totalMin > this.income * 0.6) {
      alerts.push({
        type: 'debt_ratio_critical',
        severity: 'critical',
        priority: 10,
        title: 'Borç ödemeleri gelirin %60\'ını aşıyor!',
        message: `Toplam minimum: ${this._fmt(totalMin)} / Gelir: ${this._fmt(this.income)}`,
        icon: '🚨'
      });
    }

    return alerts;
  }

  /**
   * Anomali uyarıları (basit)
   */
  anomalyAlerts() {
    const alerts = [];
    const now = this.today;
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Bu ay ilk hafta agresif harcama
    if (now.getDate() <= 7) {
      const firstWeekTxs = this.txs.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === year && (d.getMonth() + 1) === month && d.getDate() <= 7 && t.type === 'expense';
      });
      const firstWeekTotal = firstWeekTxs.reduce((s, t) => s + t.amount, 0);
      const avgMonthly = this._avgMonthlyExpense();

      if (avgMonthly > 0 && firstWeekTotal > avgMonthly * 0.4) {
        alerts.push({
          type: 'early_spending',
          severity: 'medium',
          priority: 5,
          title: 'Ayın ilk haftasında yüksek harcama',
          message: `İlk 7 günde ${this._fmt(firstWeekTotal)} harcandı (aylık ortalamanın %${Math.round(firstWeekTotal / avgMonthly * 100)}'i)`,
          icon: '⚡'
        });
      }
    }

    return alerts;
  }

  /**
   * Sistem uyarıları
   */
  systemAlerts() {
    const alerts = [];

    // Uzun süredir veri girişi yoksa
    const lastTx = this.txs.length > 0
      ? new Date(Math.max(...this.txs.map(t => new Date(t.date).getTime())))
      : null;

    if (lastTx) {
      const daysSince = Math.ceil((this.today - lastTx) / (1000 * 60 * 60 * 24));
      if (daysSince > 7) {
        alerts.push({
          type: 'no_data',
          severity: 'low',
          priority: 2,
          title: `${daysSince} gündür veri girişi yok`,
          message: 'Harcamalarınızı güncel tutmanız analiz doğruluğunu artırır.',
          icon: '📝'
        });
      }
    }

    return alerts;
  }

  _avgMonthlyExpense() {
    const months = new Set(this.txs.filter(t => t.type === 'expense').map(t => t.date.substring(0, 7)));
    const total = this.txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return months.size > 0 ? total / months.size : 0;
  }

  _fmt(n) {
    return Math.round(n).toLocaleString('tr-TR') + ' ₺';
  }
}

module.exports = NotificationService;
