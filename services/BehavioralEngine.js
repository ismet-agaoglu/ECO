// ═══════════════════════════════════════════════════════════════════
// BehavioralEngine — Davranışsal Finans Motoru (Faz 4, B10–B17)
// Harcama pattern, anomali, what changed, stres, maaş erime,
// risk skoru, günlük limit, Monte Carlo
// ═══════════════════════════════════════════════════════════════════

class BehavioralEngine {
  /**
   * @param {Object} opts
   * @param {Array}  opts.transactions
   * @param {Array}  opts.debts
   * @param {Array}  opts.recurring
   * @param {number} opts.monthlyIncome
   */
  constructor({ transactions = [], debts = [], recurring = [], monthlyIncome = 0 }) {
    this.txs = transactions;
    this.debts = debts;
    this.recurring = recurring;
    this.monthlyIncome = monthlyIncome;
  }

  static _bal(d) {
    if (d.type === 'credit_card' || d.type === 'overdraft') {
      return d.usedAmount !== undefined ? d.usedAmount : (d.currentBalance || 0);
    }
    return d.currentBalance !== undefined ? d.currentBalance : (d.usedAmount || 0);
  }

  // ─── B10: Harcama Pattern Analizi ───────────────────────────
  spendingPatterns() {
    const expenses = this.txs.filter(t => t.type === 'expense');
    if (expenses.length === 0) return { dayOfWeek: [], weekOfMonth: [], hourly: [], message: 'Yeterli veri yok' };

    // Gün bazlı (Pazartesi–Pazar)
    const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const byDay = new Array(7).fill(null).map(() => ({ total: 0, count: 0 }));
    // Hafta bazlı (1–5. hafta)
    const byWeek = new Array(5).fill(null).map(() => ({ total: 0, count: 0 }));
    // Ay içi periyot (1-10, 11-20, 21-31)
    const byPeriod = [
      { label: '1–10. gün (Ay başı)', total: 0, count: 0 },
      { label: '11–20. gün (Ay ortası)', total: 0, count: 0 },
      { label: '21–31. gün (Ay sonu)', total: 0, count: 0 }
    ];

    expenses.forEach(t => {
      const d = new Date(t.date);
      const day = d.getDay();
      const date = d.getDate();
      const weekIdx = Math.min(4, Math.floor((date - 1) / 7));
      const periodIdx = date <= 10 ? 0 : date <= 20 ? 1 : 2;

      byDay[day].total += t.amount;
      byDay[day].count++;
      byWeek[weekIdx].total += t.amount;
      byWeek[weekIdx].count++;
      byPeriod[periodIdx].total += t.amount;
      byPeriod[periodIdx].count++;
    });

    const dayOfWeek = byDay.map((d, i) => ({
      day: dayNames[i],
      total: Math.round(d.total),
      count: d.count,
      avg: d.count > 0 ? Math.round(d.total / d.count) : 0
    }));

    const peakDay = dayOfWeek.reduce((max, d) => d.total > max.total ? d : max, dayOfWeek[0]);
    const quietDay = dayOfWeek.filter(d => d.count > 0).reduce((min, d) => d.total < min.total ? d : min, dayOfWeek.find(d => d.count > 0) || dayOfWeek[0]);

    const weekOfMonth = byWeek.map((w, i) => ({
      week: `${i + 1}. hafta`,
      total: Math.round(w.total),
      count: w.count,
      avg: w.count > 0 ? Math.round(w.total / w.count) : 0
    }));

    const periods = byPeriod.map(p => ({
      ...p,
      total: Math.round(p.total),
      avg: p.count > 0 ? Math.round(p.total / p.count) : 0
    }));

    return {
      dayOfWeek,
      weekOfMonth,
      periods,
      peakDay: peakDay.day,
      quietDay: quietDay ? quietDay.day : null,
      insight: `En çok harcama ${peakDay.day} günleri (${peakDay.count} işlem, toplam ${peakDay.total.toLocaleString('tr-TR')} ₺). En sakin gün: ${quietDay ? quietDay.day : 'N/A'}.`
    };
  }

  // ─── B11: Anomali Tespiti ───────────────────────────────────
  anomalyDetection() {
    const expenses = this.txs.filter(t => t.type === 'expense');
    if (expenses.length < 5) return { anomalies: [], message: 'Yeterli veri yok (en az 5 harcama gerekli)' };

    // Kategori bazlı ortalama ve std
    const catStats = {};
    expenses.forEach(t => {
      if (!catStats[t.category]) catStats[t.category] = [];
      catStats[t.category].push(t.amount);
    });

    const anomalies = [];
    expenses.forEach(t => {
      const vals = catStats[t.category];
      if (vals.length < 3) return;
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      const std = Math.sqrt(vals.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / vals.length);
      const zScore = std > 0 ? (t.amount - avg) / std : 0;

      if (zScore > 1.5) {
        anomalies.push({
          ...t,
          zScore: parseFloat(zScore.toFixed(2)),
          categoryAvg: Math.round(avg),
          deviation: Math.round(t.amount - avg),
          deviationPercent: Math.round((t.amount - avg) / avg * 100),
          severity: zScore > 3 ? 'kritik' : zScore > 2 ? 'yüksek' : 'orta'
        });
      }
    });

    anomalies.sort((a, b) => b.zScore - a.zScore);

    return {
      anomalies: anomalies.slice(0, 10),
      totalAnomalies: anomalies.length,
      totalAnomalyAmount: anomalies.reduce((s, a) => s + a.amount, 0),
      message: anomalies.length > 0
        ? `${anomalies.length} olağandışı harcama tespit edildi (toplam ${anomalies.reduce((s, a) => s + a.amount, 0).toLocaleString('tr-TR')} ₺)`
        : 'Olağandışı harcama tespit edilmedi'
    };
  }

  // ─── B12: What Changed Panel ────────────────────────────────
  whatChanged(year, month) {
    const currentTxs = this._monthTxs(year, month);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const previousTxs = this._monthTxs(prevYear, prevMonth);

    const curIncome = this._sum(currentTxs, 'income');
    const curExpense = this._sum(currentTxs, 'expense');
    const prevIncome = this._sum(previousTxs, 'income');
    const prevExpense = this._sum(previousTxs, 'expense');

    // Yeni kategoriler
    const prevCats = new Set(previousTxs.filter(t => t.type === 'expense').map(t => t.category));
    const curCats = new Set(currentTxs.filter(t => t.type === 'expense').map(t => t.category));
    const newCategories = [...curCats].filter(c => !prevCats.has(c));
    const droppedCategories = [...prevCats].filter(c => !curCats.has(c));

    // En çok artan/azalan kategoriler
    const catDelta = {};
    currentTxs.filter(t => t.type === 'expense').forEach(t => {
      catDelta[t.category] = (catDelta[t.category] || 0) + t.amount;
    });
    previousTxs.filter(t => t.type === 'expense').forEach(t => {
      catDelta[t.category] = (catDelta[t.category] || 0) - t.amount;
    });

    const changes = Object.entries(catDelta)
      .map(([cat, delta]) => ({ category: cat, delta: Math.round(delta) }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    const biggestIncrease = changes.find(c => c.delta > 0);
    const biggestDecrease = changes.find(c => c.delta < 0);

    const highlights = [];
    if (curIncome !== prevIncome) {
      const d = curIncome - prevIncome;
      highlights.push(`Gelir ${d > 0 ? 'arttı' : 'azaldı'}: ${d > 0 ? '+' : ''}${d.toLocaleString('tr-TR')} ₺`);
    }
    if (biggestIncrease) highlights.push(`En çok artan: ${biggestIncrease.category} (+${biggestIncrease.delta.toLocaleString('tr-TR')} ₺)`);
    if (biggestDecrease) highlights.push(`En çok azalan: ${biggestDecrease.category} (${biggestDecrease.delta.toLocaleString('tr-TR')} ₺)`);
    if (newCategories.length > 0) highlights.push(`Yeni kategori: ${newCategories.join(', ')}`);
    if (droppedCategories.length > 0) highlights.push(`Bu ay hiç harcama yok: ${droppedCategories.join(', ')}`);

    return {
      current: { income: curIncome, expense: curExpense, net: curIncome - curExpense, txCount: currentTxs.length },
      previous: { income: prevIncome, expense: prevExpense, net: prevIncome - prevExpense, txCount: previousTxs.length },
      changes,
      newCategories,
      droppedCategories,
      highlights,
      txCountDelta: currentTxs.length - previousTxs.length
    };
  }

  // ─── B13: Financial Stress Index ────────────────────────────
  financialStress() {
    const totalDebt = this.debts.reduce((s, d) => s + BehavioralEngine._bal(d), 0);
    const totalMinPayment = this.debts.reduce((s, d) => s + d.minPayment, 0);
    const income = this.monthlyIncome;

    // Bileşenler (0–10 arası)
    const dtiRatio = income > 0 ? totalMinPayment / income : 1;
    const dtiScore = Math.min(10, dtiRatio * 20); // %50 DTI = 10

    const debtToIncomeAnnual = income > 0 ? totalDebt / (income * 12) : 1;
    const debtScore = Math.min(10, debtToIncomeAnnual * 5); // 2 yıllık gelir = 10

    const avgExpense = this._avgMonthly('expense');
    const expenseRatio = income > 0 ? avgExpense / income : 1;
    const expenseScore = Math.min(10, expenseRatio * 10); // %100 = 10

    const growingDebts = this.debts.filter(d => d.minPayment < BehavioralEngine._bal(d) * (d.interestRate / 100)).length;
    const growthScore = Math.min(10, growingDebts * 3.3);

    // Recurring yük
    const recurringExpense = this.recurring
      .filter(r => r.isActive && r.type === 'expense')
      .reduce((s, r) => s + r.amount, 0);
    const fixedRatio = income > 0 ? recurringExpense / income : 0;
    const fixedScore = Math.min(10, fixedRatio * 15); // %67 = 10

    // Ağırlıklı ortalama
    const weights = { dti: 0.25, debt: 0.2, expense: 0.2, growth: 0.2, fixed: 0.15 };
    const stressIndex = parseFloat((
      dtiScore * weights.dti +
      debtScore * weights.debt +
      expenseScore * weights.expense +
      growthScore * weights.growth +
      fixedScore * weights.fixed
    ).toFixed(1));

    const label = stressIndex <= 2.5 ? 'Düşük' : stressIndex <= 5 ? 'Orta' : stressIndex <= 7.5 ? 'Yüksek' : 'Kritik';

    return {
      stressIndex,
      label,
      components: {
        dti: { score: parseFloat(dtiScore.toFixed(1)), ratio: parseFloat(dtiRatio.toFixed(3)), weight: weights.dti },
        debtBurden: { score: parseFloat(debtScore.toFixed(1)), ratio: parseFloat(debtToIncomeAnnual.toFixed(2)), weight: weights.debt },
        expenseRatio: { score: parseFloat(expenseScore.toFixed(1)), ratio: parseFloat(expenseRatio.toFixed(3)), weight: weights.expense },
        debtGrowth: { score: parseFloat(growthScore.toFixed(1)), growingCount: growingDebts, weight: weights.growth },
        fixedCosts: { score: parseFloat(fixedScore.toFixed(1)), ratio: parseFloat(fixedRatio.toFixed(3)), weight: weights.fixed }
      },
      recommendations: this._stressRecommendations(stressIndex, { dtiScore, expenseScore, growthScore, fixedScore })
    };
  }

  // ─── B14: Maaş Erime Analizi ────────────────────────────────
  salaryErosion(year, month) {
    const income = this.monthlyIncome;
    if (income <= 0) return { message: 'Gelir bilgisi gerekli' };

    const monthTxs = this._monthTxs(year, month).filter(t => t.type === 'expense');
    monthTxs.sort((a, b) => new Date(a.date) - new Date(b.date));

    let remaining = income;
    const timeline = [];
    let daysSoFar = 0;

    monthTxs.forEach(t => {
      const d = new Date(t.date);
      const dayOfMonth = d.getDate();
      remaining -= t.amount;
      timeline.push({
        date: t.date,
        day: dayOfMonth,
        description: t.description || t.category,
        amount: t.amount,
        remaining: Math.round(remaining),
        erosionPercent: Math.round((1 - remaining / income) * 100)
      });
    });

    const daysInMonth = new Date(year, month, 0).getDate();
    const totalSpent = monthTxs.reduce((s, t) => s + t.amount, 0);
    const lastTxDay = monthTxs.length > 0 ? new Date(monthTxs[monthTxs.length - 1].date).getDate() : 0;

    // Zorunlu giderlerden sonra kalan
    const fixedExpenses = this.recurring
      .filter(r => r.isActive && r.type === 'expense')
      .reduce((s, r) => s + r.amount, 0);
    const afterFixed = income - fixedExpenses;

    // Erime hızı
    const dailyBurn = lastTxDay > 0 ? totalSpent / lastTxDay : 0;
    const zeroDayEstimate = dailyBurn > 0 ? Math.round(income / dailyBurn) : daysInMonth;

    return {
      income,
      totalSpent: Math.round(totalSpent),
      remaining: Math.round(remaining),
      erosionPercent: Math.round((totalSpent / income) * 100),
      fixedExpenses: Math.round(fixedExpenses),
      afterFixed: Math.round(afterFixed),
      dailyBurn: Math.round(dailyBurn),
      zeroDayEstimate,
      zeroDayLabel: zeroDayEstimate <= daysInMonth
        ? `Maaş ${zeroDayEstimate}. günde bitiyor!`
        : `Maaş ay sonuna yeter (${Math.round(remaining).toLocaleString('tr-TR')} ₺ kalır)`,
      timeline: timeline.slice(0, 30),
      phases: [
        { label: 'Zorunlu giderler', amount: fixedExpenses, percent: Math.round(fixedExpenses / income * 100) },
        { label: 'İhtiyari harcamalar', amount: Math.max(0, totalSpent - fixedExpenses), percent: Math.round(Math.max(0, totalSpent - fixedExpenses) / income * 100) },
        { label: 'Kalan', amount: Math.max(0, remaining), percent: Math.round(Math.max(0, remaining) / income * 100) }
      ]
    };
  }

  // ─── B15: Kapsamlı Risk Skoru ───────────────────────────────
  riskScore() {
    const income = this.monthlyIncome;
    const totalDebt = this.debts.reduce((s, d) => s + BehavioralEngine._bal(d), 0);
    const totalMinPayment = this.debts.reduce((s, d) => s + d.minPayment, 0);
    const avgExpense = this._avgMonthly('expense');
    const avgIncome = this._avgMonthly('income');

    const factors = [];

    // 1. Borç/Gelir oranı
    const dti = income > 0 ? totalMinPayment / income : 0;
    factors.push({ name: 'Borç/Gelir Oranı', value: `%${Math.round(dti * 100)}`, score: Math.min(100, Math.round(dti * 200)), risk: dti > 0.4 ? 'yüksek' : dti > 0.2 ? 'orta' : 'düşük' });

    // 2. Harcama/Gelir oranı
    const eir = income > 0 ? avgExpense / income : 0;
    factors.push({ name: 'Harcama/Gelir', value: `%${Math.round(eir * 100)}`, score: Math.min(100, Math.round(eir * 120)), risk: eir > 0.9 ? 'yüksek' : eir > 0.7 ? 'orta' : 'düşük' });

    // 3. Borç toplamı / yıllık gelir
    const debtRatio = income > 0 ? totalDebt / (income * 12) : 0;
    factors.push({ name: 'Toplam Borç Yükü', value: `${debtRatio.toFixed(1)}x yıllık gelir`, score: Math.min(100, Math.round(debtRatio * 50)), risk: debtRatio > 1.5 ? 'yüksek' : debtRatio > 0.5 ? 'orta' : 'düşük' });

    // 4. Büyüyen borç sayısı
    const growingDebts = this.debts.filter(d => d.minPayment < BehavioralEngine._bal(d) * (d.interestRate / 100)).length;
    const growScore = Math.min(100, growingDebts * 33);
    factors.push({ name: 'Büyüyen Borçlar', value: `${growingDebts}/${this.debts.length}`, score: growScore, risk: growingDebts > 1 ? 'yüksek' : growingDebts > 0 ? 'orta' : 'düşük' });

    // 5. Tasarruf kapasitesi
    const savings = income - avgExpense - totalMinPayment;
    const savingsRatio = income > 0 ? savings / income : 0;
    const savScore = savingsRatio < 0 ? 100 : Math.max(0, 100 - savingsRatio * 500);
    factors.push({ name: 'Tasarruf Kapasitesi', value: `%${Math.round(savingsRatio * 100)}`, score: Math.round(savScore), risk: savingsRatio < 0 ? 'yüksek' : savingsRatio < 0.1 ? 'orta' : 'düşük' });

    // 6. Gelir çeşitliliği (tekrarlayan gelir kaynağı sayısı)
    const incomeSources = this.recurring.filter(r => r.type === 'income' && r.isActive).length;
    const diversityScore = incomeSources <= 1 ? 60 : incomeSources === 2 ? 30 : 10;
    factors.push({ name: 'Gelir Çeşitliliği', value: `${incomeSources} kaynak`, score: diversityScore, risk: incomeSources <= 1 ? 'orta' : 'düşük' });

    // Toplam risk skoru (0-100, yüksek = riskli)
    const totalScore = Math.round(factors.reduce((s, f) => s + f.score, 0) / factors.length);
    const label = totalScore <= 25 ? 'Düşük Risk' : totalScore <= 50 ? 'Orta Risk' : totalScore <= 75 ? 'Yüksek Risk' : 'Kritik Risk';
    const grade = totalScore <= 20 ? 'A' : totalScore <= 35 ? 'B' : totalScore <= 50 ? 'C' : totalScore <= 70 ? 'D' : 'F';

    return {
      totalScore,
      label,
      grade,
      factors,
      summary: `Finansal risk seviyeniz: ${label} (${grade}). Skor: ${totalScore}/100`
    };
  }

  // ─── B16: Günlük Harcama Limiti ─────────────────────────────
  dailyLimit(year, month) {
    const income = this.monthlyIncome;
    const daysInMonth = new Date(year, month, 0).getDate();
    const now = new Date();
    const daysPassed = Math.min(now.getDate(), daysInMonth);
    const daysRemaining = daysInMonth - daysPassed;

    // Zorunlu sabit giderler
    const fixedExpenses = this.recurring
      .filter(r => r.isActive && r.type === 'expense')
      .reduce((s, r) => s + r.amount, 0);

    // Borç ödemeleri
    const debtPayments = this.debts.reduce((s, d) => s + d.minPayment, 0);

    // Kalan bütçe
    const flexBudget = income - fixedExpenses - debtPayments;

    // Bu ay yapılan harcamalar (sabit giderler hariç)
    const monthTxs = this._monthTxs(year, month).filter(t => t.type === 'expense');
    const spentSoFar = monthTxs.reduce((s, t) => s + t.amount, 0);
    const flexSpent = Math.max(0, spentSoFar - fixedExpenses);

    const remainingBudget = Math.max(0, flexBudget - flexSpent);
    const dailyBudget = daysRemaining > 0 ? Math.round(remainingBudget / daysRemaining) : 0;

    // Tasarruf hedefli (%10 gelir)
    const savingsTarget = income * 0.10;
    const savingsAdjusted = Math.max(0, remainingBudget - savingsTarget);
    const dailyWithSavings = daysRemaining > 0 ? Math.round(savingsAdjusted / daysRemaining) : 0;

    // Bugün harcanan
    const todayStr = `${year}-${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todaySpent = monthTxs.filter(t => t.date === todayStr).reduce((s, t) => s + t.amount, 0);

    return {
      income,
      fixedExpenses: Math.round(fixedExpenses),
      debtPayments: Math.round(debtPayments),
      flexBudget: Math.round(flexBudget),
      spentSoFar: Math.round(spentSoFar),
      remainingBudget: Math.round(remainingBudget),
      daysRemaining,
      dailyLimit: dailyBudget,
      dailyWithSavings,
      todaySpent: Math.round(todaySpent),
      todayRemaining: Math.max(0, dailyBudget - todaySpent),
      status: todaySpent > dailyBudget ? 'aşıldı' : todaySpent > dailyBudget * 0.8 ? 'sınırda' : 'iyi',
      message: todaySpent > dailyBudget
        ? `Bugün limiti ${Math.round(todaySpent - dailyBudget).toLocaleString('tr-TR')} ₺ aştınız!`
        : `Bugün harcayabileceğiniz: ${Math.max(0, dailyBudget - todaySpent).toLocaleString('tr-TR')} ₺`
    };
  }

  // ─── B17: Monte Carlo Stres Testi ──────────────────────────
  monteCarlo(months = 6, simulations = 500) {
    const monthlyData = this._monthlyTotals();
    if (monthlyData.length < 2) return { message: 'Yetersiz veri (en az 2 ay gerekli)', simulations: 0 };

    const incomes = monthlyData.map(m => m.income);
    const expenses = monthlyData.map(m => m.expense);

    const avgIncome = incomes.reduce((s, v) => s + v, 0) / incomes.length;
    const stdIncome = Math.sqrt(incomes.reduce((s, v) => s + Math.pow(v - avgIncome, 2), 0) / incomes.length);
    const avgExpense = expenses.reduce((s, v) => s + v, 0) / expenses.length;
    const stdExpense = Math.sqrt(expenses.reduce((s, v) => s + Math.pow(v - avgExpense, 2), 0) / expenses.length);

    const totalDebt = this.debts.reduce((s, d) => s + BehavioralEngine._bal(d), 0);
    const debtPayment = this.debts.reduce((s, d) => s + d.minPayment, 0);

    // Simülasyonlar
    const results = [];
    let bankruptCount = 0;
    let debtFreeCount = 0;

    for (let sim = 0; sim < simulations; sim++) {
      let cash = 0;
      let debt = totalDebt;
      let minCash = 0;
      let bankrupt = false;

      for (let m = 0; m < months; m++) {
        const inc = this._normalRandom(avgIncome, stdIncome);
        const exp = this._normalRandom(avgExpense, stdExpense);
        const net = inc - exp - debtPayment;
        cash += net;
        debt = Math.max(0, debt - debtPayment);

        if (cash < minCash) minCash = cash;
        if (cash < -avgIncome) { bankrupt = true; break; }
      }

      results.push({ finalCash: Math.round(cash), finalDebt: Math.round(debt), minCash: Math.round(minCash), bankrupt });
      if (bankrupt) bankruptCount++;
      if (debt <= 0) debtFreeCount++;
    }

    results.sort((a, b) => a.finalCash - b.finalCash);
    const p10 = results[Math.floor(simulations * 0.1)];
    const p50 = results[Math.floor(simulations * 0.5)];
    const p90 = results[Math.floor(simulations * 0.9)];

    const bankruptPct = Math.round(bankruptCount / simulations * 100);

    return {
      months,
      simulations,
      percentiles: {
        pessimistic: { label: 'Kötü Senaryo (%10)', ...p10 },
        median: { label: 'Ortalama (%50)', ...p50 },
        optimistic: { label: 'İyi Senaryo (%90)', ...p90 }
      },
      bankruptcyRisk: bankruptPct,
      debtFreeProbability: Math.round(debtFreeCount / simulations * 100),
      riskLabel: bankruptPct <= 5 ? 'Düşük' : bankruptPct <= 20 ? 'Orta' : bankruptPct <= 40 ? 'Yüksek' : 'Kritik',
      message: `${months} ay sonunda iflas riski: %${bankruptPct} | Borçsuz kalma olasılığı: %${Math.round(debtFreeCount / simulations * 100)}`
    };
  }

  // ─── Helpers ────────────────────────────────────────────────
  _monthTxs(year, month) {
    return this.txs.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === year && (d.getMonth() + 1) === month;
    });
  }

  _sum(txs, type) {
    return txs.filter(t => t.type === type).reduce((s, t) => s + t.amount, 0);
  }

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

  _normalRandom(mean, std) {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.max(0, mean + z * std);
  }

  _stressRecommendations(index, scores) {
    const recs = [];
    if (scores.dtiScore > 5) recs.push('Borç ödeme/gelir oranınız yüksek — konsolidasyon veya yapılandırma değerlendirin');
    if (scores.expenseScore > 5) recs.push('Harcamalar gelire göre yüksek — kesilebilir giderleri gözden geçirin');
    if (scores.growthScore > 3) recs.push('Büyüyen borçlarınız var — minimum ödeme üstü ödeme yapın');
    if (scores.fixedScore > 5) recs.push('Sabit giderler yüksek — abonelik ve taahhütleri gözden geçirin');
    if (index <= 3) recs.push('Finansal durumunuz iyi — tasarruf ve yatırım fırsatlarını değerlendirin');
    return recs;
  }
}

module.exports = BehavioralEngine;
