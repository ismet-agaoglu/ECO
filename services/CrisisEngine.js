// ═══════════════════════════════════════════════════════════════════
// CrisisEngine — Emergency Liquidity / Kriz Modu (Takla) algorithms
// S13–S21: Takla işlem tipleri, net likidite, köprü maliyeti,
//          döngü tespiti, zorunlu karşılaştırma, karar motoru
// ═══════════════════════════════════════════════════════════════════

const CRISIS_TX_TYPES = {
  KMH_TO_KMH_ROLLOVER: 'KMH arası çevirme',
  CARD_TO_GOLD_TO_CASH: 'Kartla altın alıp bozdurma',
  CARD_CASHLIKE_CONVERSION: 'Kart ile nakit-benzeri dönüşüm',
  SHORT_TERM_BRIDGE_BORROWING: 'Kısa vadeli köprü borçlanma',
  INFORMAL_HIGH_COST_ROLLOVER: 'Gayri resmi yüksek maliyetli çevirme'
};

class CrisisEngine {
  /**
   * @param {Array}  crisisTransactions — [{type, sourceDebt, targetDebt, grossAmount, netCashReceived, fees, newInterestRate, termDays, date, riskScore, note}]
   * @param {Object} financials — {monthlyIncome, currentCash, mandatoryExpenses, nextPayday}
   * @param {Array}  debts
   */
  constructor({ crisisTransactions = [], financials = {}, debts = [] }) {
    this.txs = crisisTransactions;
    this.fin = financials;
    this.debts = debts;
  }

  // ─── S15: Net Likidite Kazanımı ───────────────────────────────
  netLiquidityGain(tx) {
    const netGain = tx.netCashReceived - (tx.fees || 0);
    const effectiveCost = (tx.grossAmount - tx.netCashReceived + (tx.fees || 0)) / tx.netCashReceived;

    return {
      grossAmount: tx.grossAmount,
      netCashReceived: tx.netCashReceived,
      fees: tx.fees || 0,
      netGain,
      effectiveCostPercent: parseFloat((effectiveCost * 100).toFixed(2)),
      verdict: effectiveCost > 0.15
        ? 'Çok pahalı likidite — efektif maliyet %' + (effectiveCost * 100).toFixed(1)
        : effectiveCost > 0.05
          ? 'Orta maliyetli — daha ucuz alternatif araştırın'
          : 'Düşük maliyetli likidite'
    };
  }

  // ─── S16: Köprü Maliyeti ──────────────────────────────────────
  bridgeCost(tx) {
    const totalCost = tx.grossAmount - tx.netCashReceived + (tx.fees || 0);
    const dailyCost = tx.termDays > 0 ? totalCost / tx.termDays : totalCost;

    return {
      totalCost: Math.round(totalCost),
      daysGained: tx.termDays,
      dailyCost: Math.round(dailyCost),
      weeklyEquivalent: Math.round(dailyCost * 7),
      message: `Bu işlem ${tx.termDays} gün kazandırıyor, günlük maliyeti ${Math.round(dailyCost)} ₺`
    };
  }

  // ─── S17: Borç Büyütme Testi ──────────────────────────────────
  debtGrowthAfterManeuver(tx, oldTotalDebt) {
    // After the maneuver, total debt = old - paid off + new obligation
    const newTotalDebt = oldTotalDebt - (tx.netCashReceived || 0) + tx.grossAmount;
    const delta = newTotalDebt - oldTotalDebt;

    return {
      oldTotal: oldTotalDebt,
      newTotal: Math.round(newTotalDebt),
      delta: Math.round(delta),
      grew: delta > 0,
      message: delta > 0
        ? `Toplam borç ${Math.round(delta)} ₺ arttı — çöküşü erteliyor ama büyütüyor`
        : delta === 0
          ? 'Toplam borç değişmedi'
          : `Toplam borç ${Math.abs(Math.round(delta))} ₺ azaldı`
    };
  }

  // ─── S18: Çöküş Önleme Testi ─────────────────────────────────
  collapsePreventionTest(tx, urgentPayments = []) {
    const totalUrgent = urgentPayments.reduce((s, p) => s + p.amount, 0);
    const availableAfter = (this.fin.currentCash || 0) + tx.netCashReceived;
    const prevented = availableAfter >= totalUrgent;

    const unpayable = urgentPayments.filter(p => {
      let running = (this.fin.currentCash || 0) + tx.netCashReceived;
      return running < p.amount;
    });

    return {
      totalUrgent,
      availableBefore: this.fin.currentCash || 0,
      availableAfter,
      prevented,
      urgentPayments: urgentPayments.map(p => ({
        ...p,
        covered: availableAfter >= p.amount
      })),
      message: prevented
        ? 'Temerrüt önlendi — ama toplam zararı inceleyin'
        : `Manevra sonrası bile ${totalUrgent - availableAfter} ₺ açık var`
    };
  }

  // ─── S19: Döngü Tespiti ───────────────────────────────────────
  cycleDetection(lookbackDays = 60) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - lookbackDays);

    const recentTxs = this.txs.filter(t => new Date(t.date) >= cutoff);
    const rolloverCount = recentTxs.length;

    // Check debt growth trend
    const totalNewDebt = recentTxs.reduce((s, t) => s + (t.grossAmount - t.netCashReceived), 0);
    const avgDaysGained = recentTxs.length > 0
      ? recentTxs.reduce((s, t) => s + (t.termDays || 0), 0) / recentTxs.length
      : 0;

    // Score
    let score = 0;
    score += Math.min(rolloverCount * 25, 75);  // max 75 from count
    score += totalNewDebt > 10000 ? 15 : totalNewDebt > 5000 ? 10 : 5;
    score += avgDaysGained < 7 ? 10 : avgDaysGained < 14 ? 5 : 0;
    score = Math.min(score, 100);

    let status, label;
    if (score < 25) { status = 'low'; label = 'Düşük'; }
    else if (score < 50) { status = 'rising'; label = 'Yükseliyor'; }
    else if (score < 75) { status = 'chronic'; label = 'Kronik'; }
    else { status = 'critical'; label = 'Kritik — borç spirali'; }

    return {
      lookbackDays,
      rolloverCount,
      totalCostGenerated: Math.round(totalNewDebt),
      avgDaysGained: Math.round(avgDaysGained),
      score,
      status,
      label,
      message: score >= 75
        ? 'Bu artık köprü değil, borç spiraline dönmüş. Hemen yapılandırma değerlendirin.'
        : score >= 50
          ? 'Tekrarlayan kriz manevraları tespit edildi. Alternatif çözüm arayın.'
          : null
    };
  }

  // ─── S20: Zorunlu Karşılaştırma ──────────────────────────────
  mandatoryComparison(tx) {
    const totalDebt = this.debts.reduce((s, d) => s + d.currentBalance, 0);
    const weightedRate = this.debts.reduce((s, d) =>
      s + (d.currentBalance / totalDebt) * d.interestRate, 0);

    const scenarios = [];

    // 1. Do nothing
    scenarios.push({
      name: 'Hiçbir Şey Yapmama',
      monthlyCost: 0,
      totalCost: 0,
      risk: 'Temerrüt, gecikme faizi, icra riski',
      recommendation: 'baseline'
    });

    // 2. Official restructuring (BDDK)
    scenarios.push({
      name: 'Resmi Yapılandırma (BDDK)',
      monthlyCost: null,
      totalCost: null,
      risk: 'Düşük - resmi yol',
      note: 'BDDK 2024-2026 yapılandırma kararlarını inceleyin. Banka ile görüşün.',
      recommendation: 'preferred'
    });

    // 3. Consolidation loan
    const consolidationRate = Math.max(24, weightedRate * 0.6);
    const consolidationPmt = totalDebt * (consolidationRate / 100 / 12 * Math.pow(1 + consolidationRate / 100 / 12, 24)) /
      (Math.pow(1 + consolidationRate / 100 / 12, 24) - 1);
    scenarios.push({
      name: 'Konsolidasyon Kredisi (24 ay)',
      monthlyCost: Math.round(consolidationPmt),
      totalCost: Math.round(consolidationPmt * 24),
      risk: 'Orta - disiplin gerektirir',
      recommendation: 'alternative'
    });

    // 4. The crisis maneuver
    const bridge = this.bridgeCost(tx);
    scenarios.push({
      name: `Kriz Manevrası: ${CRISIS_TX_TYPES[tx.type] || tx.type}`,
      monthlyCost: Math.round(bridge.totalCost * 30 / (tx.termDays || 30)),
      totalCost: bridge.totalCost,
      daysGained: tx.termDays,
      risk: 'Yüksek - borç büyütme + döngü riski',
      recommendation: 'last_resort'
    });

    return { scenarios };
  }

  // ─── S21: Kriz Karar Motoru ───────────────────────────────────
  crisisDecision(tx, urgentPayments = []) {
    const liquidity = this.netLiquidityGain(tx);
    const bridge = this.bridgeCost(tx);
    const collapse = this.collapsePreventionTest(tx, urgentPayments);
    const cycle = this.cycleDetection();

    // Decision matrix
    let decision, label, color;

    if (!collapse.prevented) {
      decision = 'INSUFFICIENT';
      label = 'Yetersiz — manevra sonrası bile açık var';
      color = 'red';
    } else if (cycle.status === 'critical') {
      decision = 'UNSUSTAINABLE_CYCLE';
      label = 'Sürdürülemez döngü — hemen yapılandırma bakılmalı';
      color = 'red';
    } else if (liquidity.effectiveCostPercent > 20) {
      decision = 'TOO_EXPENSIVE';
      label = 'Maliyeti çok yüksek';
      color = 'red';
    } else if (collapse.prevented && bridge.daysGained <= 3) {
      decision = 'MINIMAL_BENEFIT';
      label = 'Çok kısa süreli nefes — değmeyebilir';
      color = 'orange';
    } else if (collapse.prevented && cycle.status === 'low') {
      decision = 'ACCEPTABLE_BRIDGE';
      label = 'Kısa köprü olarak kabul edilebilir';
      color = 'yellow';
    } else {
      decision = 'DEBT_GROWING';
      label = 'Temerrüdü önlüyor ama borcu büyütüyor';
      color = 'orange';
    }

    const officialBetter = liquidity.effectiveCostPercent > 10; // rough heuristic

    return {
      decision,
      label,
      color,
      liquidity,
      bridge,
      collapse: collapse.prevented,
      cycleRisk: cycle.label,
      officialRestructuringBetter: officialBetter,
      advice: officialBetter
        ? 'Resmi yapılandırma mümkünse bu manevradan daha ucuz olacaktır. Önce bankayı arayın.'
        : 'Dikkatli kullanın, döngüye girme riskine karşı izleyin.'
    };
  }
}

CrisisEngine.TX_TYPES = CRISIS_TX_TYPES;

module.exports = CrisisEngine;
