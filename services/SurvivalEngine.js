// ═══════════════════════════════════════════════════════════════════
// SurvivalEngine — Core algorithms for financial distress analysis
// S1–S9: Hayatta kalma, break-even, konsolidasyon, çözülebilirlik
// ═══════════════════════════════════════════════════════════════════

class SurvivalEngine {
  /**
   * @param {Object} opts
   * @param {number} opts.monthlyIncome
   * @param {Array}  opts.debts          — [{usedAmount|currentBalance, interestRate, minPayment, type, name}]
   * @param {Array}  opts.fixedExpenses  — [{amount, description}]
   * @param {number} opts.variableExpenseAvg — average monthly variable spending
   * @param {Array}  opts.installments   — [{monthlyAmount, remaining}]
   */
  constructor({ monthlyIncome, debts = [], fixedExpenses = [], variableExpenseAvg = 0, installments = [] }) {
    this.income = monthlyIncome;
    this.debts = debts;
    this.fixedExpenses = fixedExpenses;
    this.variableAvg = variableExpenseAvg;
    this.installments = installments;
  }

  /** Borcun bakiyesini dondurur — tur bazli alan secimi */
  static _bal(d) {
    if (d.type === 'credit_card' || d.type === 'overdraft') {
      return d.usedAmount !== undefined ? d.usedAmount : (d.currentBalance || 0);
    }
    return d.currentBalance !== undefined ? d.currentBalance : (d.usedAmount || 0);
  }

  // ─── S1: Hayatta Kalma Motoru ─────────────────────────────────
  survivalStatus() {
    const fixed = this.fixedExpenses.reduce((s, e) => s + e.amount, 0);
    const minDebtPayments = this.debts.reduce((s, d) => s + d.minPayment, 0);
    const installmentPayments = this.installments.reduce((s, i) => s + i.monthlyAmount, 0);
    const monthlyInterest = this._totalMonthlyInterest();

    const mandatoryLoad = fixed + minDebtPayments + installmentPayments + monthlyInterest;
    const gap = this.income - mandatoryLoad;
    const gapWithVariable = this.income - mandatoryLoad - this.variableAvg;

    let status, label;
    if (gapWithVariable > 0) { status = 'sustainable'; label = 'Sürdürülebilir'; }
    else if (gap > 0) { status = 'fragile'; label = 'Kırılgan'; }
    else { status = 'unsustainable'; label = 'Sürdürülemez'; }

    // Break down the gap by source
    const breakdown = [
      { name: 'Sabit Giderler', amount: fixed, percent: (fixed / mandatoryLoad * 100).toFixed(1) },
      { name: 'Minimum Borç Ödemeleri', amount: minDebtPayments, percent: (minDebtPayments / mandatoryLoad * 100).toFixed(1) },
      { name: 'Taksit Ödemeleri', amount: installmentPayments, percent: (installmentPayments / mandatoryLoad * 100).toFixed(1) },
      { name: 'Faiz Yükü', amount: Math.round(monthlyInterest), percent: (monthlyInterest / mandatoryLoad * 100).toFixed(1) }
    ];

    return {
      status,
      label,
      income: this.income,
      mandatoryLoad: Math.round(mandatoryLoad),
      variableExpense: this.variableAvg,
      gap: Math.round(gap),
      gapWithVariable: Math.round(gapWithVariable),
      freeAfterMandatory: Math.round(gap),
      freeCash: Math.round(gapWithVariable),
      breakdown
    };
  }

  // ─── S2: Borç Büyüyor Mu? Testi ──────────────────────────────
  debtGrowthTest() {
    return this.debts.map(d => {
      const bal = SurvivalEngine._bal(d);
      const monthlyInterest = bal * (d.interestRate / 100);
      const netChange = d.minPayment - monthlyInterest;
      let status, label;
      if (netChange > 0) { status = 'shrinking'; label = 'Azalıyor'; }
      else if (netChange === 0) { status = 'stagnant'; label = 'Yerinde Sayıyor'; }
      else { status = 'growing'; label = 'Büyüyor'; }

      return {
        name: d.name,
        type: d.type,
        balance: bal,
        monthlyInterest: Math.round(monthlyInterest),
        minPayment: d.minPayment,
        netChange: Math.round(netChange),
        monthsToPayoff: netChange > 0 ? Math.ceil(bal / netChange) : Infinity,
        status,
        label
      };
    });
  }

  // ─── S3: Break-Even Engine ────────────────────────────────────
  breakEven() {
    const survival = this.survivalStatus();
    const gap = survival.gap;

    if (gap >= 0) {
      return {
        isSustainable: true,
        message: 'Sistem zorunlu ödemelerle sürdürülebilir',
        requiredIncrease: 0,
        requiredCut: 0,
        surplusAfterMandatory: gap
      };
    }

    const maxCuttable = this.variableAvg;
    const needsIncomeIncrease = Math.abs(gap) > maxCuttable;

    return {
      isSustainable: false,
      message: needsIncomeIncrease
        ? `Harcama keserek çözemezsiniz. En az ${Math.abs(gap) - maxCuttable} ₺ ek gelir gerekli.`
        : `Değişken harcamalardan ${Math.abs(gap)} ₺ keserek denge sağlanabilir.`,
      requiredIncrease: needsIncomeIncrease ? Math.abs(gap) - maxCuttable : 0,
      requiredCut: Math.min(Math.abs(gap), maxCuttable),
      shortfall: Math.abs(gap),
      maxCuttable
    };
  }

  // ─── S5: Likidite Tamponu ─────────────────────────────────────
  liquidityBuffer(currentCash = 0) {
    const fixed = this.fixedExpenses.reduce((s, e) => s + e.amount, 0);
    const minDebt = this.debts.reduce((s, d) => s + d.minPayment, 0);
    const minimum = fixed + minDebt;
    const ratio = currentCash / minimum;

    let status, label;
    if (ratio >= 1) { status = 'adequate'; label = 'Yeterli'; }
    else if (ratio >= 0.5) { status = 'low'; label = 'Düşük'; }
    else { status = 'critical'; label = 'Kritik'; }

    return {
      currentCash,
      minimumBuffer: Math.round(minimum),
      ratio: parseFloat(ratio.toFixed(2)),
      shortfall: Math.max(0, Math.round(minimum - currentCash)),
      status,
      label,
      warning: ratio < 0.5 ? 'Tüm parayı borca gömmeyin — en az 1 aylık zorunlu gider tamponu tutun' : null
    };
  }

  // ─── S6: Gelir Artırımı Zorunluluğu ──────────────────────────
  incomeRequirement() {
    const breakEvenResult = this.breakEven();
    const survival = this.survivalStatus();

    return {
      needsIncome: breakEvenResult.requiredIncrease > 0,
      requiredAmount: breakEvenResult.requiredIncrease,
      canSolveWithCuts: !breakEvenResult.requiredIncrease && survival.gap < 0,
      message: breakEvenResult.requiredIncrease > 0
        ? `Harcama keserek çözemezsiniz. En az ${breakEvenResult.requiredIncrease} ₺/ay ek gelir gerekli.`
        : survival.gap < 0
          ? `${breakEvenResult.requiredCut} ₺ harcama azaltarak denge sağlanabilir.`
          : 'Mevcut gelir zorunlu yükleri karşılıyor.'
    };
  }

  // ─── S7: Zaman Kazanma Stratejisi ────────────────────────────
  timeBuyingStrategy() {
    const strategies = [];
    const totalMin = this.debts.reduce((s, d) => s + d.minPayment, 0);

    // Strategy 1: all debts minimum payment only
    const minOnlyMonths = this._simulateMinOnly();
    strategies.push({
      name: 'Sadece Minimum Ödeme',
      description: 'Tüm borçlarda sadece minimum ödeme yapılır',
      monthlyPayment: totalMin,
      breathingRoom: this.income - totalMin - this.fixedExpenses.reduce((s, e) => s + e.amount, 0),
      estimatedMonths: minOnlyMonths,
      risk: 'Borç büyüyebilir, faiz yükü artar'
    });

    // Strategy 2: defer installments (if possible)
    const installmentTotal = this.installments.reduce((s, i) => s + i.monthlyAmount, 0);
    if (installmentTotal > 0) {
      strategies.push({
        name: 'Taksit Erteleme',
        description: 'Banka ile taksit erteleme görüşmesi',
        monthlyRelief: installmentTotal,
        breathingRoom: this.income - totalMin + installmentTotal - this.fixedExpenses.reduce((s, e) => s + e.amount, 0),
        estimatedMonths: 3,
        risk: 'Banka onayı gerekli, vade uzar'
      });
    }

    return strategies;
  }

  // ─── S8: Psikolojik Sürdürülebilirlik ────────────────────────
  psychologicalSustainability(cutPercent) {
    let score, label, color;
    if (cutPercent <= 10) { score = 95; label = 'Çok Yüksek'; color = 'green'; }
    else if (cutPercent <= 20) { score = 80; label = 'Yüksek'; color = 'green'; }
    else if (cutPercent <= 35) { score = 60; label = 'Orta'; color = 'yellow'; }
    else if (cutPercent <= 50) { score = 40; label = 'Düşük'; color = 'orange'; }
    else if (cutPercent <= 70) { score = 20; label = 'Çok Düşük'; color = 'red'; }
    else { score = 5; label = 'Sürdürülemez'; color = 'red'; }

    return {
      cutPercent,
      score,
      label,
      color,
      advice: cutPercent > 50
        ? 'Bu kadar sert bir kesim uzun süre sürdürülemez. Daha gerçekçi bir plan yapın.'
        : cutPercent > 30
          ? 'Zorlu ama uygulanabilir. Aşamalı geçiş önerilir.'
          : 'Uygulanabilir bir plan.'
    };
  }

  // ─── S9: Çözülebilir / Çözülemez Ayrımı ──────────────────────
  solvabilityAnalysis() {
    const survival = this.survivalStatus();
    const breakEven = this.breakEven();
    const debtGrowth = this.debtGrowthTest();
    const growingDebts = debtGrowth.filter(d => d.status === 'growing');

    // Check if mathematically solvable
    const canSolveWithCuts = !breakEven.requiredIncrease && survival.gap < 0;
    const canSolveWithIncome = breakEven.requiredIncrease > 0 && breakEven.requiredIncrease < this.income * 0.3;
    const needsRestructuring = breakEven.requiredIncrease >= this.income * 0.3;

    let verdict, label, actions;
    if (survival.gap >= 0 && survival.gapWithVariable >= 0) {
      verdict = 'optimizable';
      label = 'Optimize Edilebilir';
      actions = ['Faiz azaltmaya odaklan', 'Borç ödeme stratejisi uygula', 'Tasarruf planı oluştur'];
    } else if (canSolveWithCuts) {
      verdict = 'solvable_with_cuts';
      label = 'Kesinti ile Çözülebilir';
      actions = [`${breakEven.requiredCut} ₺ harcama azalt`, 'Değişken giderleri incele', 'Tasarruf potansiyelini güçlendir'];
    } else if (canSolveWithIncome) {
      verdict = 'needs_extra_income';
      label = 'Ek Gelir Gerekli';
      actions = [`En az ${breakEven.requiredIncrease} ₺/ay ek gelir bul`, 'Konsolidasyon araştır', 'Harcamayı da kıs'];
    } else {
      verdict = 'needs_restructuring';
      label = 'Yapılandırma Gerekli';
      actions = ['Banka ile yapılandırma görüş', 'Konsolidasyon kredisi araştır', 'BDDK yapılandırma haklarını incele', 'Radikal harcama kesintisi uygula'];
    }

    return {
      verdict,
      label,
      growingDebtCount: growingDebts.length,
      totalGrowingDebt: growingDebts.reduce((s, d) => s + d.balance, 0),
      gap: survival.gap,
      gapWithVariable: survival.gapWithVariable,
      requiredIncrease: breakEven.requiredIncrease,
      actions
    };
  }

  // ─── S10: Konsolidasyon Simülatörü ────────────────────────────
  consolidationSimulation({ newInterestRate, terms = [12, 24, 36], costs = 0, onlyAboveRate = null }) {
    const debtsToConsolidate = onlyAboveRate
      ? this.debts.filter(d => d.interestRate > onlyAboveRate)
      : [...this.debts];

    const totalDebt = debtsToConsolidate.reduce((s, d) => s + SurvivalEngine._bal(d), 0);
    const currentMonthlyPayment = debtsToConsolidate.reduce((s, d) => s + d.minPayment, 0);
    const currentTotalInterest = this._estimateTotalInterest(debtsToConsolidate);

    // Weighted average current rate
    const weightedRate = debtsToConsolidate.reduce((s, d) =>
      s + (SurvivalEngine._bal(d) / totalDebt) * d.interestRate, 0);

    const scenarios = terms.map(months => {
      const monthlyRate = newInterestRate / 100;
      const pmt = totalDebt * (monthlyRate * Math.pow(1 + monthlyRate, months)) /
        (Math.pow(1 + monthlyRate, months) - 1);
      const totalPayment = pmt * months + costs;
      const totalInterest = totalPayment - totalDebt;

      const monthlyDelta = currentMonthlyPayment - pmt;
      const costDelta = totalInterest - currentTotalInterest;

      let recommendation;
      if (monthlyDelta > 0 && costDelta < 0) recommendation = 'STRONGLY_RECOMMENDED';
      else if (monthlyDelta > 0 && costDelta >= 0) recommendation = 'SURVIVAL_MODE_OPTION';
      else if (monthlyDelta <= 0 && costDelta < 0) recommendation = 'AGGRESSIVE_PAYOFF';
      else recommendation = 'REJECT';

      return {
        term: months,
        monthlyPayment: Math.round(pmt),
        totalPayment: Math.round(totalPayment),
        totalInterest: Math.round(totalInterest),
        monthlyRelief: Math.round(monthlyDelta),
        costDelta: Math.round(costDelta),
        recommendation,
        label: this._recommendationLabel(recommendation)
      };
    });

    return {
      consolidatedDebt: totalDebt,
      debtCount: debtsToConsolidate.length,
      currentMonthlyPayment,
      currentTotalInterest: Math.round(currentTotalInterest),
      weightedCurrentRate: parseFloat(weightedRate.toFixed(2)),
      newRate: newInterestRate,
      rateAdvantage: parseFloat((weightedRate - newInterestRate).toFixed(2)),
      costs,
      scenarios
    };
  }

  // ─── S12: Refinansman Güvenlik Filtreleri ─────────────────────
  refinanceFilters({ newMonthlyPayment, currentGap }) {
    const warnings = [];

    if (currentGap < 0 && newMonthlyPayment > Math.abs(currentGap) + this.debts.reduce((s, d) => s + d.minPayment, 0)) {
      warnings.push({ type: 'REJECT', message: 'Yeni kredi sonrası açık devam ediyor — kredi almak sorunu çözmüyor' });
    }

    const totalDebt = this.debts.reduce((s, d) => s + SurvivalEngine._bal(d), 0);
    if (totalDebt / this.income > 3) {
      warnings.push({ type: 'WARNING', message: 'Toplam borç/gelir oranı çok yüksek. Yeni kredi almak riski artırır.' });
    }

    warnings.push({ type: 'INFO', message: 'Konsolidasyon sonrası eski kredi kartlarını kapatın veya limiti düşürün — tekrar borçlanma riski.' });
    warnings.push({ type: 'INFO', message: 'BDDK yapılandırma kararlarını inceleyin — resmi yapılandırma daha uygun olabilir.' });

    return warnings;
  }

  // ─── Helper methods ───────────────────────────────────────────
  _totalMonthlyInterest() {
    return this.debts.reduce((s, d) => s + (SurvivalEngine._bal(d) * (d.interestRate / 100)), 0);
  }

  _simulateMinOnly() {
    let months = 0;
    let balances = this.debts.map(d => ({ ...d, bal: SurvivalEngine._bal(d) }));
    while (balances.some(b => b.bal > 0) && months < 360) {
      months++;
      balances = balances.map(b => {
        if (b.bal <= 0) return b;
        const interest = b.bal * (b.interestRate / 100);
        b.bal = b.bal + interest - b.minPayment;
        if (b.bal < 0) b.bal = 0;
        return b;
      });
    }
    return months >= 360 ? Infinity : months;
  }

  _estimateTotalInterest(debts) {
    let total = 0;
    for (const d of debts) {
      let bal = SurvivalEngine._bal(d);
      let months = 0;
      while (bal > 0 && months < 360) {
        const interest = bal * (d.interestRate / 100);
        total += interest;
        bal = bal + interest - d.minPayment;
        if (bal < 0) bal = 0;
        months++;
      }
    }
    return total;
  }

  _recommendationLabel(rec) {
    const labels = {
      STRONGLY_RECOMMENDED: 'Kesinlikle Önerilen',
      SURVIVAL_MODE_OPTION: 'Hayatta Kalma Seçeneği',
      AGGRESSIVE_PAYOFF: 'Agresif Ödeme Seçeneği',
      REJECT: 'Önerilmez'
    };
    return labels[rec] || rec;
  }
}

module.exports = SurvivalEngine;
