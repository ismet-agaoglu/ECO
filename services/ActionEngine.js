// ═══════════════════════════════════════════════════════════════════
// ActionEngine — Kural Tabanlı Aksiyon & Öneri Motoru (Faz 5)
// Rule-based recommendations + explainability layer
// ═══════════════════════════════════════════════════════════════════

class ActionEngine {
  constructor({ debts = [], transactions = [], recurring = [], monthlyIncome = 0, currentCash = 0 }) {
    this.debts = debts;
    this.txs = transactions;
    this.recurring = recurring;
    this.income = monthlyIncome;
    this.cash = currentCash;
  }

  /**
   * Tüm aksiyonları üret (öncelik sıralı)
   */
  generateActions() {
    const actions = [
      ...this._debtActions(),
      ...this._spendingActions(),
      ...this._incomeActions(),
      ...this._savingsActions(),
      ...this._structuralActions()
    ];

    return actions.sort((a, b) => b.impact - a.impact);
  }

  /**
   * Tek bir plan gerçekçi mi?
   */
  validatePlan(plan) {
    const { targetDebtReduction = 0, monthlyExtra = 0, months = 6, cutCategories = [] } = plan;

    const totalMinPayment = this.debts.reduce((s, d) => s + d.minPayment, 0);
    const avgExpense = this._avgMonthly('expense');
    const fixedExpenses = this.recurring.filter(r => r.isActive && r.type === 'expense').reduce((s, r) => s + r.amount, 0);

    const availableForExtra = this.income - fixedExpenses - totalMinPayment;
    const feasible = monthlyExtra <= availableForExtra;

    // Kesinti fizibilitesi
    const cutAmount = cutCategories.reduce((s, c) => s + (c.amount || 0), 0);
    const totalCuttable = avgExpense - fixedExpenses;
    const cutFeasible = cutAmount <= totalCuttable * 0.5;

    // Hedef ulaşılabilir mi?
    const totalPaid = (totalMinPayment + monthlyExtra) * months;
    const totalDebt = this.debts.reduce((s, d) => s + d.currentBalance, 0);
    const reductionPercent = totalDebt > 0 ? Math.round(totalPaid / totalDebt * 100) : 0;
    const targetReachable = reductionPercent >= targetDebtReduction;

    const score = (feasible ? 30 : 0) + (cutFeasible ? 25 : 0) + (targetReachable ? 25 : 0) + Math.min(20, reductionPercent / 5);

    return {
      feasible,
      cutFeasible,
      targetReachable,
      realisticScore: Math.min(100, Math.round(score)),
      label: score >= 70 ? 'Gerçekçi' : score >= 40 ? 'Zorlayıcı ama olabilir' : 'Gerçekçi değil',
      availableForExtra: Math.round(availableForExtra),
      projectedReduction: reductionPercent,
      explanation: this._planExplanation({ feasible, cutFeasible, targetReachable, availableForExtra, reductionPercent, monthlyExtra, months })
    };
  }

  /**
   * Hedef bazlı ters hesaplama
   * "X ayda borcu Y% azaltmak için ne gerekir?"
   */
  reverseGoal(targetPercent, months) {
    const totalDebt = this.debts.reduce((s, d) => s + d.currentBalance, 0);
    const targetAmount = totalDebt * (targetPercent / 100);
    const totalMinPayment = this.debts.reduce((s, d) => s + d.minPayment, 0);

    const minPayTotal = totalMinPayment * months;
    const extraNeeded = Math.max(0, targetAmount - minPayTotal);
    const monthlyExtraNeeded = months > 0 ? Math.round(extraNeeded / months) : 0;

    const fixedExpenses = this.recurring.filter(r => r.isActive && r.type === 'expense').reduce((s, r) => s + r.amount, 0);
    const available = this.income - fixedExpenses - totalMinPayment;

    return {
      totalDebt: Math.round(totalDebt),
      targetAmount: Math.round(targetAmount),
      targetPercent,
      months,
      minPaymentContribution: Math.round(minPayTotal),
      extraNeeded: Math.round(extraNeeded),
      monthlyExtraNeeded,
      availableMonthly: Math.round(available),
      feasible: monthlyExtraNeeded <= available,
      gap: Math.round(monthlyExtraNeeded - available),
      explanation: monthlyExtraNeeded <= available
        ? `${months} ayda borcu %${targetPercent} azaltmak için aylık ${monthlyExtraNeeded.toLocaleString('tr-TR')} ₺ ekstra ödeme gerekiyor. Mevcut bütçeyle mümkün.`
        : `${months} ayda borcu %${targetPercent} azaltmak için aylık ${monthlyExtraNeeded.toLocaleString('tr-TR')} ₺ ekstra gerekiyor ama sadece ${Math.round(available).toLocaleString('tr-TR')} ₺ mevcut. ${Math.round(monthlyExtraNeeded - available).toLocaleString('tr-TR')} ₺ açık var.`
    };
  }

  // ─── Kural tabanlı aksiyon üreticiler ───────────────────────
  _debtActions() {
    const actions = [];

    // En pahalı borcu önceliklendir
    const sorted = [...this.debts].sort((a, b) => b.interestRate - a.interestRate);
    if (sorted.length > 0 && sorted[0].interestRate > 2) {
      const d = sorted[0];
      actions.push({
        type: 'debt_priority',
        priority: 'yüksek',
        impact: 9,
        title: `${d.name} borcuna ekstra ödeme yap`,
        description: `%${d.interestRate} faiz oranıyla en pahalı borcunuz. Ekstra ödeme burada en çok faiz tasarrufu sağlar.`,
        reason: `Çığ (avalanche) yöntemi: en yüksek faizli borca öncelik verildiğinde toplam faiz yükü minimize edilir.`,
        potentialSaving: Math.round(d.currentBalance * d.interestRate / 100 * 0.3)
      });
    }

    // Büyüyen borçlar
    for (const d of this.debts) {
      const monthlyInterest = d.currentBalance * (d.interestRate / 100);
      if (d.minPayment < monthlyInterest) {
        actions.push({
          type: 'debt_growing',
          priority: 'kritik',
          impact: 10,
          title: `${d.name} borcu büyüyor — acil müdahale gerekli`,
          description: `Aylık faiz (${Math.round(monthlyInterest).toLocaleString('tr-TR')} ₺) minimum ödemeden (${d.minPayment.toLocaleString('tr-TR')} ₺) fazla.`,
          reason: 'Minimum ödeme faizi karşılamadığında borç exponential büyür. Yapılandırma veya konsolidasyon düşünülmeli.'
        });
      }
    }

    // Küçük kapanabilir borçlar
    for (const d of this.debts) {
      if (d.currentBalance < this.income * 0.3 && d.currentBalance > 0) {
        actions.push({
          type: 'debt_quick_win',
          priority: 'orta',
          impact: 5,
          title: `${d.name} hızlı kapatılabilir`,
          description: `Bakiye: ${Math.round(d.currentBalance).toLocaleString('tr-TR')} ₺ — aylık gelirin %${Math.round(d.currentBalance / this.income * 100)}'i.`,
          reason: 'Küçük borçları kapatmak psikolojik motivasyon sağlar (snowball etkisi) ve aylık sabit yükü azaltır.'
        });
      }
    }

    return actions;
  }

  _spendingActions() {
    const actions = [];
    const avgExpense = this._avgMonthly('expense');
    const fixedExpenses = this.recurring.filter(r => r.isActive && r.type === 'expense').reduce((s, r) => s + r.amount, 0);

    // Değişken harcama yüksekse
    const variable = avgExpense - fixedExpenses;
    if (this.income > 0 && variable > this.income * 0.4) {
      actions.push({
        type: 'spending_variable',
        priority: 'orta',
        impact: 6,
        title: 'Değişken harcamaları gözden geçir',
        description: `Aylık değişken harcama: ~${Math.round(variable).toLocaleString('tr-TR')} ₺ (gelirin %${Math.round(variable / this.income * 100)}'i)`,
        reason: 'Değişken giderler kontrol edilebilir kalemlerdir. %15-20 azaltım bile borç ödeme hızını artırır.'
      });
    }

    // Sabit gider yüksekse
    if (this.income > 0 && fixedExpenses > this.income * 0.5) {
      actions.push({
        type: 'spending_fixed',
        priority: 'yüksek',
        impact: 7,
        title: 'Sabit giderler çok yüksek',
        description: `Sabit giderler gelirin %${Math.round(fixedExpenses / this.income * 100)}'ini oluşturuyor (${Math.round(fixedExpenses).toLocaleString('tr-TR')} ₺)`,
        reason: 'Abonelik, taahhüt ve sabit ödemeler gözden geçirilmeli. Gereksiz abonelikler iptal edilebilir.'
      });
    }

    return actions;
  }

  _incomeActions() {
    const actions = [];
    const totalMin = this.debts.reduce((s, d) => s + d.minPayment, 0);
    const fixedExpenses = this.recurring.filter(r => r.isActive && r.type === 'expense').reduce((s, r) => s + r.amount, 0);
    const gap = (fixedExpenses + totalMin) - this.income;

    if (gap > 0) {
      actions.push({
        type: 'income_required',
        priority: 'kritik',
        impact: 10,
        title: `Aylık en az ${Math.round(gap).toLocaleString('tr-TR')} ₺ ek gelir gerekli`,
        description: 'Zorunlu giderler + minimum borç ödemeleri mevcut geliri aşıyor.',
        reason: 'Sadece harcama keserek çözülemez. Gelir artırımı (ek mesai, ek iş, freelance) gerekli.'
      });
    }

    return actions;
  }

  _savingsActions() {
    const actions = [];
    const totalMin = this.debts.reduce((s, d) => s + d.minPayment, 0);
    const surplus = this.income - this._avgMonthly('expense') - totalMin;

    if (surplus > 0 && this.cash < this.income * 0.5) {
      actions.push({
        type: 'emergency_fund',
        priority: 'orta',
        impact: 5,
        title: 'Acil durum fonu oluştur',
        description: `Mevcut nakit: ${Math.round(this.cash).toLocaleString('tr-TR')} ₺. Hedef: en az 1 aylık gider (${Math.round(this._avgMonthly('expense')).toLocaleString('tr-TR')} ₺)`,
        reason: 'Acil durum fonu olmadan beklenmedik harcamalar borç spiralini tetikleyebilir.'
      });
    }

    return actions;
  }

  _structuralActions() {
    const actions = [];
    const totalDebt = this.debts.reduce((s, d) => s + d.currentBalance, 0);

    // Konsolidasyon önerisi
    const highRateDebts = this.debts.filter(d => d.interestRate > 3);
    if (highRateDebts.length > 1) {
      const avgRate = highRateDebts.reduce((s, d) => s + d.interestRate * d.currentBalance, 0) / highRateDebts.reduce((s, d) => s + d.currentBalance, 0);
      actions.push({
        type: 'consolidation',
        priority: 'orta',
        impact: 6,
        title: 'Borç konsolidasyonu değerlendir',
        description: `${highRateDebts.length} yüksek faizli borç var (ort. %${avgRate.toFixed(1)}). Düşük faizli tek krediye çevirme araştırılabilir.`,
        reason: 'Konsolidasyon aylık ödemeyi düşürebilir ve faiz yükünü azaltabilir. Ama kart limiti tekrar kullanılmamalı.'
      });
    }

    return actions;
  }

  _avgMonthly(type) {
    const months = new Set(this.txs.map(t => t.date.substring(0, 7)));
    const total = this.txs.filter(t => t.type === type).reduce((s, t) => s + t.amount, 0);
    return months.size > 0 ? total / months.size : 0;
  }

  _planExplanation(ctx) {
    const parts = [];
    if (!ctx.feasible) parts.push(`Aylık ${ctx.monthlyExtra?.toLocaleString('tr-TR')} ₺ ekstra ödeme mevcut bütçeyle karşılanamıyor (kullanılabilir: ${Math.round(ctx.availableForExtra).toLocaleString('tr-TR')} ₺).`);
    if (!ctx.cutFeasible) parts.push('Önerilen harcama kesintisi zorunlu giderlerin yarısını aşıyor.');
    if (!ctx.targetReachable) parts.push(`${ctx.months} ayda hedeflenen borç azaltımına ulaşılamıyor (tahmini: %${ctx.reductionPercent}).`);
    if (parts.length === 0) parts.push('Plan gerçekleştirilebilir görünüyor.');
    return parts.join(' ');
  }
}

module.exports = ActionEngine;
