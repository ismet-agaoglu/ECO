// ═══════════════════════════════════════════════════════════════════
// AnalysisEngine — Akıllı Analiz Motoru (Faz 3, B1–B9)
// Snapshot, net worth, forecast, sapma, tasarruf potansiyeli
// ═══════════════════════════════════════════════════════════════════

class AnalysisEngine {
  /**
   * @param {Object} opts
   * @param {Array}  opts.transactions
   * @param {Array}  opts.debts
   * @param {Array}  opts.recurring
   * @param {number} opts.currentCash — mevcut nakit
   * @param {Object} opts.assets — {cash, bank, gold, other}
   */
  constructor({ transactions = [], debts = [], recurring = [], currentCash = 0, assets = {} }) {
    this.txs = transactions;
    this.debts = debts;
    this.recurring = recurring;
    this.cash = currentCash;
    this.assets = assets;
  }

  static _bal(d) {
    if (d.type === 'credit_card' || d.type === 'overdraft') {
      return d.usedAmount !== undefined ? d.usedAmount : (d.currentBalance || 0);
    }
    return d.currentBalance !== undefined ? d.currentBalance : (d.usedAmount || 0);
  }

  // ─── B1: Monthly Snapshot ─────────────────────────────────────
  monthlySnapshot(year, month) {
    const monthTxs = this.txs.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === year && (d.getMonth() + 1) === month;
    });

    const income = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const totalDebt = this.debts.reduce((s, d) => s + AnalysisEngine._bal(d), 0);

    // Category breakdown
    const categories = {};
    monthTxs.filter(t => t.type === 'expense').forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + t.amount;
    });

    // Risk score (simple version)
    const dti = totalDebt > 0 && income > 0 ? totalDebt / (income * 12) : 0;
    const riskScore = Math.min(10, dti * 3 + (expense > income ? 3 : 0) + (totalDebt > income * 6 ? 2 : 0));

    return {
      year, month,
      income: Math.round(income),
      expense: Math.round(expense),
      net: Math.round(income - expense),
      totalDebt,
      transactionCount: monthTxs.length,
      categoryBreakdown: Object.entries(categories)
        .map(([cat, amt]) => ({ category: cat, amount: Math.round(amt), percent: Math.round(amt / expense * 100) }))
        .sort((a, b) => b.amount - a.amount),
      riskScore: parseFloat(riskScore.toFixed(1)),
      riskLabel: riskScore <= 3 ? 'Düşük' : riskScore <= 6 ? 'Orta' : riskScore <= 8 ? 'Yüksek' : 'Kritik'
    };
  }

  // ─── B2: Net Worth ────────────────────────────────────────────
  netWorth() {
    const totalAssets = Object.values(this.assets).reduce((s, v) => s + (v || 0), 0) + this.cash;
    const totalDebt = this.debts.reduce((s, d) => s + AnalysisEngine._bal(d), 0);
    const net = totalAssets - totalDebt;

    return {
      assets: {
        cash: this.cash,
        ...this.assets,
        total: totalAssets
      },
      liabilities: totalDebt,
      netWorth: net,
      debtToAssetRatio: totalAssets > 0 ? parseFloat((totalDebt / totalAssets).toFixed(2)) : Infinity,
      status: net > 0 ? 'positive' : net === 0 ? 'zero' : 'negative',
      label: net > 0 ? 'Pozitif' : net === 0 ? 'Sıfır' : 'Negatif'
    };
  }

  // ─── B3: Likidite Risk Analizi ────────────────────────────────
  liquidityRisk(monthsUnemployed = 3) {
    const monthlyExpense = this._avgMonthly('expense');
    const monthlyDebt = this.debts.reduce((s, d) => s + d.minPayment, 0);
    const monthlyNeed = monthlyExpense + monthlyDebt;
    const totalNeeded = monthlyNeed * monthsUnemployed;
    const available = this.cash + (this.assets.bank || 0);

    return {
      monthsAnalyzed: monthsUnemployed,
      monthlyNeed: Math.round(monthlyNeed),
      totalNeeded: Math.round(totalNeeded),
      available: Math.round(available),
      gap: Math.round(available - totalNeeded),
      canSurvive: available >= totalNeeded,
      survivalMonths: monthlyNeed > 0 ? parseFloat((available / monthlyNeed).toFixed(1)) : Infinity,
      message: available >= totalNeeded
        ? `${monthsUnemployed} ay işsiz kalsan da dayanabilirsin (${parseFloat((available / monthlyNeed).toFixed(1))} ay yeterli)`
        : `${monthsUnemployed} ay işsiz kalırsan ${Math.round(totalNeeded - available).toLocaleString('tr-TR')} ₺ açık oluşur`
    };
  }

  // ─── B4: Constraint-Based Optimizasyon ────────────────────────
  constraintOptimization(maxMonthlyPayment, minLivingExpense) {
    const available = maxMonthlyPayment;
    const debts = [...this.debts].sort((a, b) => b.interestRate - a.interestRate); // avalanche

    const allocation = debts.map(d => {
      const minPay = d.minPayment;
      return { name: d.name, balance: AnalysisEngine._bal(d), rate: d.interestRate, minPayment: minPay, allocated: minPay };
    });

    // Distribute remaining to highest interest first
    let remaining = available - allocation.reduce((s, a) => s + a.allocated, 0);
    for (const alloc of allocation) {
      if (remaining <= 0) break;
      const extra = Math.min(remaining, alloc.balance - alloc.allocated);
      alloc.allocated += extra;
      alloc.extra = extra;
      remaining -= extra;
    }

    return {
      maxPayment: maxMonthlyPayment,
      minLiving: minLivingExpense,
      totalAllocated: allocation.reduce((s, a) => s + a.allocated, 0),
      remaining: Math.round(remaining),
      allocation: allocation.map(a => ({
        ...a,
        allocated: Math.round(a.allocated),
        extra: Math.round(a.extra || 0)
      }))
    };
  }

  // ─── B5: Forecast (Trend Tahmini) ─────────────────────────────
  forecast(months = 3) {
    const monthlyData = this._monthlyTotals();
    if (monthlyData.length < 2) return { message: 'Yetersiz veri (en az 2 ay gerekli)', predictions: [] };

    // Simple linear regression on expenses
    const expenses = monthlyData.map(m => m.expense);
    const incomes = monthlyData.map(m => m.income);

    const expTrend = this._linearTrend(expenses);
    const incTrend = this._linearTrend(incomes);

    // Moving average
    const recentExp = expenses.slice(-3);
    const recentInc = incomes.slice(-3);
    const avgExp = recentExp.reduce((s, v) => s + v, 0) / recentExp.length;
    const avgInc = recentInc.reduce((s, v) => s + v, 0) / recentInc.length;

    const predictions = [];
    for (let i = 1; i <= months; i++) {
      const predExp = Math.round(avgExp + expTrend.slope * i);
      const predInc = Math.round(avgInc + incTrend.slope * i);
      predictions.push({
        monthOffset: i,
        predictedIncome: predInc,
        predictedExpense: predExp,
        predictedNet: predInc - predExp,
        confidence: Math.max(50, 90 - i * 10) // azalan güven
      });
    }

    return {
      basedOnMonths: monthlyData.length,
      expenseTrend: expTrend.slope > 100 ? 'Artıyor' : expTrend.slope < -100 ? 'Azalıyor' : 'Stabil',
      incomeTrend: incTrend.slope > 100 ? 'Artıyor' : incTrend.slope < -100 ? 'Azalıyor' : 'Stabil',
      predictions
    };
  }

  // ─── B6: Kategori Gider Tahmini ───────────────────────────────
  categoryForecast() {
    const catData = {};
    this.txs.filter(t => t.type === 'expense').forEach(t => {
      if (!catData[t.category]) catData[t.category] = [];
      catData[t.category].push(t.amount);
    });

    return Object.entries(catData).map(([cat, amounts]) => {
      const avg = amounts.reduce((s, v) => s + v, 0) / Math.max(1, this._uniqueMonths());
      const std = Math.sqrt(amounts.reduce((s, v) => s + Math.pow(v - (avg / amounts.length * this._uniqueMonths()), 2), 0) / amounts.length);
      return {
        category: cat,
        avgMonthly: Math.round(avg),
        min: Math.round(Math.max(0, avg - std)),
        max: Math.round(avg + std),
        range: `${Math.round(Math.max(0, avg - std)).toLocaleString('tr-TR')} – ${Math.round(avg + std).toLocaleString('tr-TR')} ₺`
      };
    }).sort((a, b) => b.avgMonthly - a.avgMonthly);
  }

  // ─── B7: Harcama Sapma Analizi ────────────────────────────────
  deviationAnalysis(year, month) {
    const current = this.monthlySnapshot(year, month);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const previous = this.monthlySnapshot(prevYear, prevMonth);

    const catDelta = {};
    current.categoryBreakdown.forEach(c => { catDelta[c.category] = { current: c.amount, previous: 0 }; });
    previous.categoryBreakdown.forEach(c => {
      if (!catDelta[c.category]) catDelta[c.category] = { current: 0, previous: 0 };
      catDelta[c.category].previous = c.amount;
    });

    const deviations = Object.entries(catDelta).map(([cat, d]) => ({
      category: cat,
      current: d.current,
      previous: d.previous,
      delta: d.current - d.previous,
      deltaPercent: d.previous > 0 ? Math.round((d.current - d.previous) / d.previous * 100) : null,
      trend: d.current > d.previous * 1.2 ? 'artış' : d.current < d.previous * 0.8 ? 'azalış' : 'stabil'
    })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    return {
      currentMonth: current,
      previousMonth: previous,
      incomeDelta: current.income - previous.income,
      expenseDelta: current.expense - previous.expense,
      netDelta: current.net - previous.net,
      deviations
    };
  }

  // ─── B8: Dönem Sonu Tahmin ────────────────────────────────────
  endOfMonthEstimate(year, month) {
    const now = new Date();
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysPassed = Math.min(now.getDate(), daysInMonth);
    const remaining = daysInMonth - daysPassed;

    const monthTxs = this.txs.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === year && (d.getMonth() + 1) === month;
    });

    const spentSoFar = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const incomeSoFar = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);

    const dailySpend = daysPassed > 0 ? spentSoFar / daysPassed : 0;
    const projectedExpense = Math.round(spentSoFar + dailySpend * remaining);
    const expectedIncome = this.recurring.filter(r => r.type === 'income' && r.isActive).reduce((s, r) => s + r.amount, 0);

    return {
      daysPassed,
      daysRemaining: remaining,
      spentSoFar: Math.round(spentSoFar),
      incomeSoFar: Math.round(incomeSoFar),
      dailyAvgSpend: Math.round(dailySpend),
      projectedExpense,
      expectedIncome: Math.round(expectedIncome || incomeSoFar),
      projectedNet: Math.round((expectedIncome || incomeSoFar) - projectedExpense),
      message: `Bu tempoda ay sonunda ${projectedExpense.toLocaleString('tr-TR')} ₺ harcama, ${Math.round((expectedIncome || incomeSoFar) - projectedExpense).toLocaleString('tr-TR')} ₺ net`
    };
  }

  // ─── B9: Tasarruf Potansiyeli ─────────────────────────────────
  savingsPotential() {
    const cats = this.categoryForecast();
    const fixedCats = ['kira', 'fatura', 'kredi', 'taksit', 'sigorta'];
    const optimizableCats = ['market', 'yemek', 'ulaşım', 'akaryakıt', 'giyim'];

    const analysis = cats.map(c => {
      const catLower = c.category.toLowerCase();
      let type;
      if (fixedCats.some(f => catLower.includes(f))) type = 'dokunulmaz';
      else if (optimizableCats.some(o => catLower.includes(o))) type = 'optimize_edilebilir';
      else type = 'kesilebilir';

      const saveable = type === 'dokunulmaz' ? 0
        : type === 'optimize_edilebilir' ? Math.round(c.avgMonthly * 0.15)
        : Math.round(c.avgMonthly * 0.30);

      return { ...c, type, typeLabel: type === 'dokunulmaz' ? 'Dokunulmaz' : type === 'optimize_edilebilir' ? 'Optimize Edilebilir' : 'Kesilebilir', saveable };
    });

    const totalSaveable = analysis.reduce((s, a) => s + a.saveable, 0);
    const totalExpense = analysis.reduce((s, a) => s + a.avgMonthly, 0);

    return {
      categories: analysis,
      totalMonthlyExpense: totalExpense,
      totalSaveable,
      saveablePercent: totalExpense > 0 ? Math.round(totalSaveable / totalExpense * 100) : 0,
      message: `Aylık ${totalSaveable.toLocaleString('tr-TR')} ₺ tasarruf potansiyeli (harcamanın %${totalExpense > 0 ? Math.round(totalSaveable / totalExpense * 100) : 0}'${totalSaveable > totalExpense * 0.1 ? 'i' : 'u'})`
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────
  _avgMonthly(type) {
    const months = this._uniqueMonths() || 1;
    return this.txs.filter(t => t.type === type).reduce((s, t) => s + t.amount, 0) / months;
  }

  _uniqueMonths() {
    const months = new Set(this.txs.map(t => t.date.substring(0, 7)));
    return months.size || 1;
  }

  _monthlyTotals() {
    const grouped = {};
    this.txs.forEach(t => {
      const key = t.date.substring(0, 7);
      if (!grouped[key]) grouped[key] = { income: 0, expense: 0 };
      grouped[key][t.type] += t.amount;
    });
    return Object.entries(grouped).sort().map(([k, v]) => ({ month: k, ...v }));
  }

  _linearTrend(values) {
    const n = values.length;
    if (n < 2) return { slope: 0, intercept: values[0] || 0 };
    const sumX = n * (n - 1) / 2;
    const sumY = values.reduce((s, v) => s + v, 0);
    const sumXY = values.reduce((s, v, i) => s + i * v, 0);
    const sumXX = n * (n - 1) * (2 * n - 1) / 6;
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return { slope: Math.round(slope), intercept: Math.round(intercept) };
  }
}

module.exports = AnalysisEngine;
