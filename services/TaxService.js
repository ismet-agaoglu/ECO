// ═══════════════════════════════════════════════════════════════════
// TaxService — TR Kümülatif Vergi & Maaş Hesaplama (Faz 1, T1–T8)
// 2026 Gelir Vergisi Dilimleri + SGK/İşsizlik/Damga
// ═══════════════════════════════════════════════════════════════════

// 2026 vergi dilimleri (ücret gelirleri tarifesi)
const TAX_BRACKETS_2026 = [
  { limit: 190000,   rate: 0.15 },
  { limit: 400000,   rate: 0.20 },
  { limit: 1500000,  rate: 0.27 },
  { limit: 5300000,  rate: 0.35 },
  { limit: Infinity, rate: 0.40 }
];

const SGK_EMPLOYEE_RATE = 0.14;       // %14 SGK işçi payı
const UNEMPLOYMENT_RATE = 0.01;        // %1 İşsizlik sigortası
const STAMP_TAX_RATE = 0.00759;        // Damga vergisi ‰7.59
const SGK_CEILING_2026 = 132399.90;    // 2026 SGK tavan (aylık brüt)

class TaxService {
  /**
   * @param {Object} opts
   * @param {number} opts.monthlyGross — Aylık brüt maaş
   * @param {number[]} opts.extraIncomeByMonth — 12 elemanlı dizi, her ay ek brüt gelir (ek mesai, teşvik vs)
   * @param {number} opts.startMonth — Hangi aydan başlanacak (1=Ocak, default=1)
   */
  constructor({ monthlyGross, extraIncomeByMonth = new Array(12).fill(0), startMonth = 1 }) {
    this.monthlyGross = monthlyGross;
    this.extras = extraIncomeByMonth;
    this.startMonth = startMonth;
  }

  // ─── T1: Kümülatif Vergi Hesaplama ────────────────────────────
  // Her ay için: brüt → net pipeline (5 adım)
  calculateFullYear() {
    let cumulativeMatrah = 0;
    let cumulativeTax = 0;
    const months = [];

    for (let m = 0; m < 12; m++) {
      const gross = this.monthlyGross + (this.extras[m] || 0);

      // STEP 1: Brüt → Vergi matrahı
      const sgkBase = Math.min(gross, SGK_CEILING_2026);
      const sgk = sgkBase * SGK_EMPLOYEE_RATE;
      const unemployment = sgkBase * UNEMPLOYMENT_RATE;
      const matrah = gross - sgk - unemployment;

      // STEP 2: Kümülatif matrah
      cumulativeMatrah += matrah;

      // STEP 3: Kademeli vergi (kümülatif)
      const cumulativeTaxNow = this._calculateProgressiveTax(cumulativeMatrah);

      // STEP 4: Bu ayın vergisi
      const monthTax = cumulativeTaxNow - cumulativeTax;
      cumulativeTax = cumulativeTaxNow;

      // STEP 5: Net maaş
      const stampTax = gross * STAMP_TAX_RATE;
      const net = gross - sgk - unemployment - monthTax - stampTax;

      // Current bracket
      const bracket = this._getCurrentBracket(cumulativeMatrah);
      const marginalRate = bracket.rate;

      months.push({
        month: m + 1,
        monthName: this._monthName(m),
        gross,
        extra: this.extras[m] || 0,
        sgk: Math.round(sgk * 100) / 100,
        unemployment: Math.round(unemployment * 100) / 100,
        matrah: Math.round(matrah * 100) / 100,
        cumulativeMatrah: Math.round(cumulativeMatrah * 100) / 100,
        incomeTax: Math.round(monthTax * 100) / 100,
        stampTax: Math.round(stampTax * 100) / 100,
        totalDeductions: Math.round((sgk + unemployment + monthTax + stampTax) * 100) / 100,
        net: Math.round(net * 100) / 100,
        marginalRate,
        bracketLabel: `%${(marginalRate * 100).toFixed(0)}`,
        effectiveTaxRate: Math.round((monthTax / gross) * 10000) / 100
      });
    }

    // Year totals
    const totalGross = months.reduce((s, m) => s + m.gross, 0);
    const totalNet = months.reduce((s, m) => s + m.net, 0);
    const totalTax = months.reduce((s, m) => s + m.incomeTax, 0);

    return {
      months,
      yearly: {
        totalGross: Math.round(totalGross),
        totalNet: Math.round(totalNet),
        totalIncomeTax: Math.round(totalTax),
        effectiveRate: Math.round((totalTax / totalGross) * 10000) / 100,
        avgMonthlyNet: Math.round(totalNet / 12)
      }
    };
  }

  // ─── T2: Vergi Kırılma Noktası ────────────────────────────────
  bracketTransitions() {
    const year = this.calculateFullYear();
    const transitions = [];
    let prevRate = null;

    for (const m of year.months) {
      if (prevRate !== null && m.marginalRate !== prevRate) {
        transitions.push({
          month: m.month,
          monthName: m.monthName,
          fromRate: `%${(prevRate * 100).toFixed(0)}`,
          toRate: m.bracketLabel,
          cumulativeMatrah: m.cumulativeMatrah,
          netDrop: prevRate !== null ? Math.round((year.months[m.month - 2]?.net || 0) - m.net) : 0,
          message: `${m.monthName} ayında vergi dilimi ${m.bracketLabel}'e geçiyor`
        });
      }
      prevRate = m.marginalRate;
    }

    // Also show how far from next bracket each month
    const distanceToNext = year.months.map(m => {
      const bracket = this._getCurrentBracket(m.cumulativeMatrah);
      const nextLimit = this._getNextBracketLimit(m.cumulativeMatrah);
      return {
        month: m.month,
        monthName: m.monthName,
        currentRate: m.bracketLabel,
        distanceToNext: nextLimit ? Math.round(nextLimit - m.cumulativeMatrah) : null,
        nextRate: nextLimit ? `%${(this._getNextBracketRate(m.cumulativeMatrah) * 100).toFixed(0)}` : null
      };
    });

    return { transitions, distanceToNext };
  }

  // ─── T3: Yıl Sonu Net Maaş Projeksiyonu ──────────────────────
  netSalaryProjection() {
    const year = this.calculateFullYear();
    return year.months.map(m => ({
      month: m.month,
      monthName: m.monthName,
      net: m.net,
      gross: m.gross,
      taxRate: m.effectiveTaxRate,
      bracket: m.bracketLabel
    }));
  }

  // ─── T4: Ek Mesai Etki Simülasyonu ────────────────────────────
  simulateExtraIncome(extraAmount, targetMonth = null) {
    // Baseline: no extra income for target month
    const baseExtras = [...this.extras];

    // Scenario: add extra income
    const scenarioExtras = [...this.extras];
    if (targetMonth) {
      scenarioExtras[targetMonth - 1] = (scenarioExtras[targetMonth - 1] || 0) + extraAmount;
    } else {
      // Spread across all months
      for (let i = 0; i < 12; i++) scenarioExtras[i] = (scenarioExtras[i] || 0) + extraAmount;
    }

    const baseline = new TaxService({ monthlyGross: this.monthlyGross, extraIncomeByMonth: baseExtras });
    const scenario = new TaxService({ monthlyGross: this.monthlyGross, extraIncomeByMonth: scenarioExtras });

    const baseYear = baseline.calculateFullYear();
    const scenYear = scenario.calculateFullYear();

    const monthlyComparison = baseYear.months.map((bm, i) => ({
      month: bm.month,
      monthName: bm.monthName,
      baseNet: bm.net,
      scenarioNet: scenYear.months[i].net,
      netDelta: Math.round(scenYear.months[i].net - bm.net),
      baseBracket: bm.bracketLabel,
      scenarioBracket: scenYear.months[i].bracketLabel,
      bracketChanged: bm.marginalRate !== scenYear.months[i].marginalRate
    }));

    // Future months tax impact
    const futureImpact = targetMonth ? monthlyComparison.slice(targetMonth).reduce((s, m) => s + m.netDelta, 0) : 0;
    const immediateGain = targetMonth ? monthlyComparison[targetMonth - 1]?.netDelta || 0 : 0;

    return {
      extraAmount,
      targetMonth: targetMonth ? this._monthName(targetMonth - 1) : 'Tüm Yıl',
      yearlyNetDelta: scenYear.yearly.totalNet - baseYear.yearly.totalNet,
      immediateGain,
      futureImpact,
      realNetBenefit: Math.round(scenYear.yearly.totalNet - baseYear.yearly.totalNet),
      monthlyComparison,
      bracketShifts: monthlyComparison.filter(m => m.bracketChanged),
      message: targetMonth
        ? `${this._monthName(targetMonth - 1)}'da ${extraAmount.toLocaleString('tr-TR')} ₺ ek gelir → yıl sonu net fark: ${Math.round(scenYear.yearly.totalNet - baseYear.yearly.totalNet).toLocaleString('tr-TR')} ₺`
        : `Her ay ${extraAmount.toLocaleString('tr-TR')} ₺ ek gelir → yıllık net fark: ${Math.round(scenYear.yearly.totalNet - baseYear.yearly.totalNet).toLocaleString('tr-TR')} ₺`
    };
  }

  // ─── T5: Marjinal Vergi Oranı ─────────────────────────────────
  marginalTaxRate(month = null) {
    const year = this.calculateFullYear();
    const m = month ? year.months[month - 1] : year.months[new Date().getMonth()];
    if (!m) return null;

    const marginal = m.marginalRate;
    const effectiveWithDeductions = marginal + SGK_EMPLOYEE_RATE + UNEMPLOYMENT_RATE + STAMP_TAX_RATE;

    return {
      month: m.month,
      monthName: m.monthName,
      marginalIncomeTax: `%${(marginal * 100).toFixed(0)}`,
      effectiveTotal: `%${(effectiveWithDeductions * 100).toFixed(1)}`,
      message: `Bu ay ek kazancının %${(marginal * 100).toFixed(0)}'${marginal >= 0.27 ? 'si' : 'i'} gelir vergisine, toplam %${(effectiveWithDeductions * 100).toFixed(0)}'${effectiveWithDeductions >= 0.4 ? 'ı' : 'i'} kesintilere gidiyor`,
      perExtra1000: {
        gross: 1000,
        netAfterTax: Math.round(1000 * (1 - effectiveWithDeductions))
      }
    };
  }

  // ─── T6: Teşvik Erimesi Analizi ───────────────────────────────
  incentiveErosion(incentiveAmount, month) {
    // Calculate with and without incentive
    const withoutExtras = [...this.extras];
    withoutExtras[month - 1] = (withoutExtras[month - 1] || 0);
    const withExtras = [...this.extras];
    withExtras[month - 1] = (withExtras[month - 1] || 0) + incentiveAmount;

    const without = new TaxService({ monthlyGross: this.monthlyGross, extraIncomeByMonth: withoutExtras }).calculateFullYear();
    const withInc = new TaxService({ monthlyGross: this.monthlyGross, extraIncomeByMonth: withExtras }).calculateFullYear();

    const netGain = withInc.yearly.totalNet - without.yearly.totalNet;
    const taxTaken = incentiveAmount - netGain;
    const erosionPercent = (taxTaken / incentiveAmount * 100);

    return {
      incentiveAmount,
      month: this._monthName(month - 1),
      grossIncentive: incentiveAmount,
      netGain: Math.round(netGain),
      taxTaken: Math.round(taxTaken),
      erosionPercent: Math.round(erosionPercent * 10) / 10,
      message: `${incentiveAmount.toLocaleString('tr-TR')} ₺ teşvikin %${Math.round(erosionPercent)}'${erosionPercent >= 30 ? 'i' : 'u'} vergiye gitti. Net kalan: ${Math.round(netGain).toLocaleString('tr-TR')} ₺`
    };
  }

  // ─── T7: Vergi Optimizasyonu ──────────────────────────────────
  taxOptimization(totalExtraYearly) {
    const scenarios = [];

    // Scenario 1: All in January
    const janExtras = new Array(12).fill(0); janExtras[0] = totalExtraYearly;
    const janSvc = new TaxService({ monthlyGross: this.monthlyGross, extraIncomeByMonth: janExtras });
    scenarios.push({ name: 'Tümü Ocak', net: janSvc.calculateFullYear().yearly.totalNet });

    // Scenario 2: Spread evenly
    const evenExtras = new Array(12).fill(totalExtraYearly / 12);
    const evenSvc = new TaxService({ monthlyGross: this.monthlyGross, extraIncomeByMonth: evenExtras });
    scenarios.push({ name: 'Eşit Dağıtım', net: evenSvc.calculateFullYear().yearly.totalNet });

    // Scenario 3: All in December
    const decExtras = new Array(12).fill(0); decExtras[11] = totalExtraYearly;
    const decSvc = new TaxService({ monthlyGross: this.monthlyGross, extraIncomeByMonth: decExtras });
    scenarios.push({ name: 'Tümü Aralık', net: decSvc.calculateFullYear().yearly.totalNet });

    // Scenario 4: First half heavy
    const firstHalf = new Array(12).fill(0);
    for (let i = 0; i < 6; i++) firstHalf[i] = totalExtraYearly / 6;
    const fhSvc = new TaxService({ monthlyGross: this.monthlyGross, extraIncomeByMonth: firstHalf });
    scenarios.push({ name: 'İlk 6 Ay', net: fhSvc.calculateFullYear().yearly.totalNet });

    // Baseline (no extra)
    const baseSvc = new TaxService({ monthlyGross: this.monthlyGross });
    const baseNet = baseSvc.calculateFullYear().yearly.totalNet;

    const ranked = scenarios
      .map(s => ({ ...s, netGain: Math.round(s.net - baseNet), net: Math.round(s.net) }))
      .sort((a, b) => b.netGain - a.netGain);

    const best = ranked[0];
    const worst = ranked[ranked.length - 1];

    return {
      totalExtraYearly,
      scenarios: ranked,
      bestStrategy: best.name,
      worstStrategy: worst.name,
      savingsDelta: best.netGain - worst.netGain,
      message: `${best.name} stratejisi ${worst.name}'a göre ${(best.netGain - worst.netGain).toLocaleString('tr-TR')} ₺ daha avantajlı`
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────
  _calculateProgressiveTax(cumulativeIncome) {
    let tax = 0;
    let remaining = cumulativeIncome;
    let prevLimit = 0;

    for (const bracket of TAX_BRACKETS_2026) {
      const taxableInBracket = Math.min(remaining, bracket.limit - prevLimit);
      if (taxableInBracket <= 0) break;
      tax += taxableInBracket * bracket.rate;
      remaining -= taxableInBracket;
      prevLimit = bracket.limit;
    }
    return tax;
  }

  _getCurrentBracket(cumulativeMatrah) {
    let prev = 0;
    for (const b of TAX_BRACKETS_2026) {
      if (cumulativeMatrah <= b.limit) return b;
      prev = b.limit;
    }
    return TAX_BRACKETS_2026[TAX_BRACKETS_2026.length - 1];
  }

  _getNextBracketLimit(cumulativeMatrah) {
    for (const b of TAX_BRACKETS_2026) {
      if (cumulativeMatrah < b.limit && b.limit !== Infinity) return b.limit;
    }
    return null;
  }

  _getNextBracketRate(cumulativeMatrah) {
    let found = false;
    for (const b of TAX_BRACKETS_2026) {
      if (found) return b.rate;
      if (cumulativeMatrah < b.limit) found = true;
    }
    return null;
  }

  _monthName(i) {
    return ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'][i];
  }
}

module.exports = TaxService;
