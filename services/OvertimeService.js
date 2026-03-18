// ═══════════════════════════════════════════════════════════════════
// OvertimeService — Ek Mesai Simülasyon Motoru (Faz 1, T9–T15)
// Marjinal net kazanç, saat başı değer, hedef, borç yönlendirme
// ═══════════════════════════════════════════════════════════════════

const TaxService = require('./TaxService');

class OvertimeService {
  /**
   * @param {Object} opts
   * @param {number} opts.monthlyGross — Base monthly gross salary
   * @param {number} opts.hourlyOvertimeGross — Gross pay per overtime hour
   * @param {number[]} opts.extraIncomeByMonth — existing extra income by month
   * @param {number} opts.targetMonth — month to simulate (1-12)
   */
  constructor({ monthlyGross, hourlyOvertimeGross, extraIncomeByMonth = new Array(12).fill(0), targetMonth }) {
    this.gross = monthlyGross;
    this.hourlyGross = hourlyOvertimeGross;
    this.extras = extraIncomeByMonth;
    this.month = targetMonth || new Date().getMonth() + 1;
  }

  // ─── T9: Marjinal Net Kazanç ──────────────────────────────────
  marginalNetIncome(hours) {
    const extraGross = hours * this.hourlyGross;

    // Baseline (no overtime this month)
    const baseTax = new TaxService({ monthlyGross: this.gross, extraIncomeByMonth: [...this.extras] });
    const baseYear = baseTax.calculateFullYear();

    // With overtime
    const scenExtras = [...this.extras];
    scenExtras[this.month - 1] = (scenExtras[this.month - 1] || 0) + extraGross;
    const scenTax = new TaxService({ monthlyGross: this.gross, extraIncomeByMonth: scenExtras });
    const scenYear = scenTax.calculateFullYear();

    // Immediate gain (this month)
    const immediateNet = scenYear.months[this.month - 1].net - baseYear.months[this.month - 1].net;

    // Future months impact (remaining months lose net due to higher cumulative bracket)
    const futureImpact = scenYear.months.slice(this.month).reduce((s, m, i) =>
      s + (m.net - baseYear.months[this.month + i].net), 0);

    const realNetBenefit = immediateNet + futureImpact;

    return {
      hours,
      grossEarned: extraGross,
      immediateNet: Math.round(immediateNet),
      futureImpact: Math.round(futureImpact),
      realNetBenefit: Math.round(realNetBenefit),
      taxTaken: Math.round(extraGross - realNetBenefit),
      effectiveRetention: Math.round(realNetBenefit / extraGross * 100),
      message: `${hours} saat ek mesai → Brüt: ${extraGross.toLocaleString('tr-TR')} ₺, Net: ${Math.round(realNetBenefit).toLocaleString('tr-TR')} ₺ (${Math.round(realNetBenefit / extraGross * 100)}% kalıyor)`
    };
  }

  // ─── T10: Saat Başına Gerçek Net ──────────────────────────────
  hourlyRealNet(hours) {
    const marginal = this.marginalNetIncome(hours);
    const realHourly = marginal.realNetBenefit / hours;
    const grossHourly = this.hourlyGross;

    return {
      hours,
      grossHourly,
      netHourly: Math.round(realHourly),
      breakdown: {
        brütSaatlik: `${grossHourly.toLocaleString('tr-TR')} ₺`,
        netSaatlik: `${Math.round(realHourly).toLocaleString('tr-TR')} ₺`
      }
    };
  }

  // ─── T11: Değme Skoru ─────────────────────────────────────────
  worthinessScore(hours) {
    const marginal = this.marginalNetIncome(hours);
    const hourly = this.hourlyRealNet(hours);
    const retentionRate = marginal.effectiveRetention;

    let verdict, label, color;
    if (retentionRate >= 60) {
      verdict = 'VERY_WORTH'; label = 'Çok Mantıklı'; color = 'green';
    } else if (retentionRate >= 45) {
      verdict = 'WORTH'; label = 'Mantıklı Ama Sınırlı'; color = 'yellow';
    } else if (retentionRate >= 30) {
      verdict = 'ONLY_IF_NEEDED'; label = 'Sadece Mecbursan'; color = 'orange';
    } else {
      verdict = 'NOT_WORTH'; label = 'Değmiyor'; color = 'red';
    }

    return {
      hours,
      verdict,
      label,
      color,
      retentionRate,
      netHourly: hourly.netHourly
    };
  }

  // ─── T12: Optimal Eşik Analizi ────────────────────────────────
  optimalThreshold(maxHours = 40) {
    const results = [];
    let peakEfficiency = { hours: 0, netHourly: 0 };

    for (let h = 1; h <= maxHours; h += 1) {
      const hourly = this.hourlyRealNet(h);
      const score = this.worthinessScore(h);
      const marginal = this.marginalNetIncome(h);

      results.push({
        hours: h,
        netTotal: marginal.realNetBenefit,
        netHourly: hourly.netHourly,
        verdict: score.label
      });

      if (hourly.netHourly > peakEfficiency.netHourly) {
        peakEfficiency = { hours: h, netHourly: hourly.netHourly };
      }
    }

    // Find zones based on retention rate
    const highZone = results.filter(r => r.netHourly > peakEfficiency.netHourly * 0.7);

    return {
      peakEfficiency,
      zones: {
        optimal: { from: 1, to: highZone.length > 0 ? highZone[highZone.length - 1].hours : 0, label: 'Çok Mantıklı' },
        limited: { from: highZone.length > 0 ? highZone[highZone.length - 1].hours + 1 : 1, to: maxHours, label: 'Sınırlı Fayda' }
      },
      dataPoints: results.filter((_, i) => i % 2 === 0 || i < 10)
    };
  }

  // ─── T13: Hedef Bazlı Hesaplama ───────────────────────────────
  hoursForTarget(targetNet) {
    let h = 0;
    let achieved = 0;

    while (h < 100 && achieved < targetNet) {
      h++;
      const marginal = this.marginalNetIncome(h);
      achieved = marginal.realNetBenefit;
    }

    if (achieved < targetNet) {
      return {
        targetNet,
        possible: false,
        message: `${targetNet.toLocaleString('tr-TR')} ₺ net hedefe ulaşmak bu ay mümkün görünmüyor (100 saatte bile ${Math.round(achieved).toLocaleString('tr-TR')} ₺)`
      };
    }

    const score = this.worthinessScore(h);
    const hourly = this.hourlyRealNet(h);

    return {
      targetNet,
      possible: true,
      requiredHours: h,
      grossRequired: h * this.hourlyGross,
      actualNet: Math.round(achieved),
      netHourly: hourly.netHourly,
      verdict: score.label,
      color: score.color,
      message: `Net ${targetNet.toLocaleString('tr-TR')} ₺ için yaklaşık ${h} saat ek mesai gerekiyor (${score.label})`
    };
  }

  // ─── T14: Borç Yönlendirme ───────────────────────────────────
  debtAllocationAdvice(hours, debts = []) {
    const marginal = this.marginalNetIncome(hours);
    const netGain = marginal.realNetBenefit;

    if (netGain <= 0 || debts.length === 0) {
      return { netGain, allocations: [], message: 'Net kazanç yok veya borç bilgisi eksik' };
    }

    const allocations = debts.map(d => {
      const interestSavedPerMonth = Math.min(netGain, d.currentBalance) * (d.interestRate / 100);
      return {
        debtName: d.name,
        debtType: d.type,
        balance: d.currentBalance,
        interestRate: d.interestRate,
        interestSavedMonthly: Math.round(interestSavedPerMonth),
        interestSavedYearly: Math.round(interestSavedPerMonth * 12)
      };
    }).sort((a, b) => b.interestSavedYearly - a.interestSavedYearly);

    const best = allocations[0];
    return {
      netGain: Math.round(netGain),
      allocations,
      bestTarget: best.debtName,
      message: `${hours} saat ek mesaiden ${Math.round(netGain).toLocaleString('tr-TR')} ₺ kazanç → ${best.debtName}'a yönlendirin (yıllık ${best.interestSavedYearly.toLocaleString('tr-TR')} ₺ faiz tasarrufu)`
    };
  }

  // ─── T15: Survival Bağlantısı ────────────────────────────────
  survivalImpact(hours, currentGap) {
    const marginal = this.marginalNetIncome(hours);
    const newGap = currentGap + marginal.realNetBenefit;

    let status, label;
    if (newGap > 0) { status = 'resolved'; label = 'Açık kapatıldı'; }
    else if (marginal.realNetBenefit > Math.abs(currentGap) * 0.5) { status = 'significant'; label = 'Açık önemli ölçüde azaldı'; }
    else if (marginal.realNetBenefit > 0) { status = 'partial'; label = 'Açık kısmen azaldı'; }
    else { status = 'insufficient'; label = 'Ek mesaiyle bile sistem negatif'; }

    return {
      hours,
      currentGap,
      netGain: Math.round(marginal.realNetBenefit),
      newGap: Math.round(newGap),
      status,
      label,
      message: newGap > 0
        ? `${hours} saat ek mesai açığı kapatıyor (+${Math.round(newGap).toLocaleString('tr-TR')} ₺ fazla)`
        : `${hours} saat ek mesai sonrası bile ${Math.abs(Math.round(newGap)).toLocaleString('tr-TR')} ₺ açık devam ediyor`
    };
  }
}

module.exports = OvertimeService;
