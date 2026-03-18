// ═══════════════════════════════════════════════════════════════════
// InterestModels — Gerçek Faiz Hesaplama Motoru (Faz 2, A1–A6)
// DailyCompounding (KK), MonthlyCompounding (KMH), AnnuityLoan
// BSMV/KKDF dahil, 3 senaryolu nakit akışı, borç önceliklendirme
// ═══════════════════════════════════════════════════════════════════

// TR vergi/masraf oranları
const BSMV_RATE = 0.10;   // %10 BSMV
const KKDF_RATE = 0.15;   // %15 KKDF (bireysel)

// ─── A1: Faiz Modelleri ─────────────────────────────────────────

class DailyCompoundingInterest {
  /**
   * Kredi kartı stili: günlük bileşik faiz
   * @param {number} annualRate — Yıllık nominal faiz (%)
   * @param {boolean} includeTax — BSMV+KKDF dahil mi
   */
  constructor(annualRate, includeTax = true) {
    this.nominalRate = annualRate;
    const taxMultiplier = includeTax ? (1 + BSMV_RATE + KKDF_RATE) : 1;
    this.effectiveAnnual = annualRate * taxMultiplier;
    this.dailyRate = this.effectiveAnnual / 100 / 365;
  }

  /** Belirli gün sayısı sonunda bakiye */
  balance(principal, days) {
    return principal * Math.pow(1 + this.dailyRate, days);
  }

  /** Aylık faiz tutarı (30 gün) */
  monthlyInterest(principal) {
    return this.balance(principal, 30) - principal;
  }

  /** Yıllık efektif faiz (bileşik) */
  effectiveAnnualRate() {
    return (Math.pow(1 + this.dailyRate, 365) - 1) * 100;
  }

  info() {
    return {
      type: 'daily_compounding',
      label: 'Günlük Bileşik (KK)',
      nominalRate: this.nominalRate,
      effectiveAnnualWithTax: parseFloat(this.effectiveAnnual.toFixed(2)),
      effectiveAnnualCompound: parseFloat(this.effectiveAnnualRate().toFixed(2)),
      dailyRate: parseFloat((this.dailyRate * 100).toFixed(6))
    };
  }
}

class MonthlyCompoundingInterest {
  /**
   * Ek hesap / KMH stili: aylık bileşik faiz
   * @param {number} monthlyRate — Aylık faiz (%)
   * @param {boolean} includeTax — BSMV+KKDF dahil mi
   */
  constructor(monthlyRate, includeTax = true) {
    this.nominalMonthly = monthlyRate;
    const taxMultiplier = includeTax ? (1 + BSMV_RATE + KKDF_RATE) : 1;
    this.effectiveMonthly = monthlyRate * taxMultiplier;
  }

  balance(principal, months) {
    return principal * Math.pow(1 + this.effectiveMonthly / 100, months);
  }

  monthlyInterest(principal) {
    return principal * (this.effectiveMonthly / 100);
  }

  effectiveAnnualRate() {
    return (Math.pow(1 + this.effectiveMonthly / 100, 12) - 1) * 100;
  }

  info() {
    return {
      type: 'monthly_compounding',
      label: 'Aylık Bileşik (KMH)',
      nominalMonthly: this.nominalMonthly,
      effectiveMonthlyWithTax: parseFloat(this.effectiveMonthly.toFixed(2)),
      effectiveAnnual: parseFloat(this.effectiveAnnualRate().toFixed(2))
    };
  }
}

class AnnuityLoanModel {
  /**
   * Tüketici kredisi: sabit taksitli annuity
   * @param {number} annualRate — Yıllık faiz (%)
   * @param {number} termMonths — Vade (ay)
   * @param {number} principal — Anapara
   */
  constructor(annualRate, termMonths, principal) {
    this.annualRate = annualRate;
    this.termMonths = termMonths;
    this.principal = principal;
    this.monthlyRate = annualRate / 100 / 12;
  }

  /** Aylık taksit (PMT) */
  payment() {
    const r = this.monthlyRate;
    const n = this.termMonths;
    if (r === 0) return this.principal / n;
    return this.principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }

  /** Toplam geri ödeme */
  totalPayment() {
    return this.payment() * this.termMonths;
  }

  /** Toplam faiz */
  totalInterest() {
    return this.totalPayment() - this.principal;
  }

  /** Amortisman tablosu */
  amortizationTable() {
    const pmt = this.payment();
    let balance = this.principal;
    const table = [];

    for (let m = 1; m <= this.termMonths; m++) {
      const interest = balance * this.monthlyRate;
      const principalPaid = pmt - interest;
      balance -= principalPaid;
      table.push({
        month: m,
        payment: Math.round(pmt),
        interest: Math.round(interest),
        principal: Math.round(principalPaid),
        balance: Math.max(0, Math.round(balance))
      });
    }
    return table;
  }

  info() {
    return {
      type: 'annuity_loan',
      label: 'Sabit Taksit (Kredi)',
      annualRate: this.annualRate,
      termMonths: this.termMonths,
      principal: this.principal,
      monthlyPayment: Math.round(this.payment()),
      totalPayment: Math.round(this.totalPayment()),
      totalInterest: Math.round(this.totalInterest())
    };
  }
}

// ─── A3: Transaction Source Types ───────────────────────────────
const TRANSACTION_SOURCE_TYPES = {
  CASH: { label: 'Nakit', debtImpact: false },
  CREDIT_CARD: { label: 'Kredi Kartı', debtImpact: true },
  OVERDRAFT: { label: 'Ek Hesap (KMH)', debtImpact: true },
  LOAN: { label: 'Kredi', debtImpact: true }
};

// ─── A4: Min Ödeme Tuzağı Simülasyonu ──────────────────────────
function minPaymentTrapSimulation(balance, annualRate, minPaymentPercent = 0.02, minPaymentFloor = 100) {
  const interest = new DailyCompoundingInterest(annualRate);
  let remaining = balance;
  let totalPaid = 0;
  let totalInterest = 0;
  let months = 0;
  const history = [];

  while (remaining > 1 && months < 600) { // max 50 yıl
    months++;
    const monthInterest = interest.monthlyInterest(remaining);
    const minPay = Math.max(remaining * minPaymentPercent, minPaymentFloor);
    const payment = Math.min(minPay, remaining + monthInterest);

    totalInterest += monthInterest;
    remaining = remaining + monthInterest - payment;
    totalPaid += payment;

    if (months <= 60 || months % 12 === 0) {
      history.push({
        month: months,
        payment: Math.round(payment),
        interest: Math.round(monthInterest),
        remaining: Math.round(remaining)
      });
    }
  }

  return {
    originalBalance: balance,
    totalMonths: months,
    totalYears: parseFloat((months / 12).toFixed(1)),
    totalPaid: Math.round(totalPaid),
    totalInterest: Math.round(totalInterest),
    interestMultiplier: parseFloat((totalPaid / balance).toFixed(2)),
    history,
    message: `${balance.toLocaleString('tr-TR')} ₺ borcu min ödemeyle kapatmak ${(months / 12).toFixed(1)} yıl ve toplam ${Math.round(totalPaid).toLocaleString('tr-TR')} ₺ (${(totalPaid / balance).toFixed(1)}x)`
  };
}

// ─── A5: 3 Senaryolu Nakit Akışı ────────────────────────────────
function threeScenarioCashflow({ income, guaranteedIncome = 0, fixedExpenses, variableExpenses, debtPayments, interestCosts }) {
  const total = fixedExpenses + variableExpenses + debtPayments + interestCosts;

  return {
    guaranteed: {
      label: 'Garanti Senaryo',
      income: guaranteedIncome || income,
      expenses: fixedExpenses + debtPayments + interestCosts,
      free: (guaranteedIncome || income) - fixedExpenses - debtPayments - interestCosts,
      description: 'Sadece kesin gelir ve zorunlu giderler'
    },
    projected: {
      label: 'Normal Senaryo',
      income,
      expenses: total,
      free: income - total,
      description: 'Beklenen gelir ve normal harcamalar'
    },
    stress: {
      label: 'Kötü Senaryo',
      income: income * 0.85,  // gelir %15 düşük
      expenses: total * 1.15, // gider %15 fazla
      free: income * 0.85 - total * 1.15,
      description: 'Gelir -%15, giderler +%15'
    }
  };
}

// ─── A6: Borç Önceliklendirme Skoru ─────────────────────────────
function debtPriorityScore(debt, weights = { interest: 0.35, delay: 0.15, pressure: 0.25, psychological: 0.15, critical: 0.10 }) {
  const interestScore = Math.min(debt.interestRate * 12 / 5, 10); // aylık oran → yıllığa çevir, max 50% → 10
  const delayScore = (debt.daysOverdue || 0) > 0 ? Math.min(debt.daysOverdue / 3, 10) : 0;
  const bal = (debt.type === 'credit_card' || debt.type === 'overdraft')
    ? (debt.usedAmount !== undefined ? debt.usedAmount : (debt.currentBalance || 0))
    : (debt.currentBalance !== undefined ? debt.currentBalance : (debt.usedAmount || 0));
  const pressureScore = debt.minPayment > 0 ? Math.min((debt.minPayment / (bal || 1)) * 100, 10) : 0;
  const psychologicalScore = bal < 10000 ? 8 : bal < 30000 ? 5 : 2; // küçük borç → yüksek
  const criticalScore = debt.isEssential ? 10 : debt.hasCollateral ? 7 : 3;

  const total =
    interestScore * weights.interest +
    delayScore * weights.delay +
    pressureScore * weights.pressure +
    psychologicalScore * weights.psychological +
    criticalScore * weights.critical;

  let classification;
  if (debt.isEssential || debt.daysOverdue > 30) classification = 'hayati';
  else if (interestScore > 7 || delayScore > 5) classification = 'sistemik';
  else classification = 'düşük';

  return {
    debtName: debt.name,
    score: parseFloat(total.toFixed(2)),
    classification,
    components: {
      faiz: parseFloat(interestScore.toFixed(1)),
      gecikme: parseFloat(delayScore.toFixed(1)),
      baskı: parseFloat(pressureScore.toFixed(1)),
      psikolojik: parseFloat(psychologicalScore.toFixed(1)),
      kritiklik: parseFloat(criticalScore.toFixed(1))
    }
  };
}

module.exports = {
  DailyCompoundingInterest,
  MonthlyCompoundingInterest,
  AnnuityLoanModel,
  TRANSACTION_SOURCE_TYPES,
  BSMV_RATE,
  KKDF_RATE,
  minPaymentTrapSimulation,
  threeScenarioCashflow,
  debtPriorityScore
};
