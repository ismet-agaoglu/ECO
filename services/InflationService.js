// ═══════════════════════════════════════════════════════════════════
// InflationService — Enflasyon Hesaplayıcı (Faz 6)
// Geçmiş/gelecek değer, satın alma gücü, enflasyonlu projeksiyon
// ═══════════════════════════════════════════════════════════════════

class InflationService {
  constructor() {
    // TR yıllık enflasyon oranları (TÜFE yaklaşık)
    this.historicalRates = {
      2020: 14.6, 2021: 36.1, 2022: 64.3, 2023: 64.8,
      2024: 44.4, 2025: 30.0, 2026: 25.0
    };
  }

  /**
   * Gelecek değer hesaplama (enflasyonla eriyen satın alma gücü)
   */
  futureValue(amount, years, annualRate = null) {
    const rate = annualRate || this._currentRate();
    const futureAmount = amount * Math.pow(1 + rate / 100, years);
    const purchasingPower = amount / Math.pow(1 + rate / 100, years);

    return {
      originalAmount: amount,
      years,
      annualRate: rate,
      futureEquivalent: Math.round(futureAmount),
      purchasingPower: Math.round(purchasingPower),
      erosion: Math.round(amount - purchasingPower),
      erosionPercent: Math.round((1 - purchasingPower / amount) * 100),
      message: `${amount.toLocaleString('tr-TR')} ₺'nin ${years} yıl sonra satın alma gücü: ${Math.round(purchasingPower).toLocaleString('tr-TR')} ₺ (-%${Math.round((1 - purchasingPower / amount) * 100)})`
    };
  }

  /**
   * Geçmiş değer hesaplama (şimdiki paranın geçmişteki karşılığı)
   */
  pastValue(amount, fromYear, toYear = new Date().getFullYear()) {
    let adjusted = amount;
    for (let y = fromYear; y < toYear; y++) {
      const rate = this.historicalRates[y] || 25;
      adjusted = adjusted * (1 + rate / 100);
    }

    return {
      originalAmount: amount,
      fromYear,
      toYear,
      adjustedValue: Math.round(adjusted),
      multiplier: parseFloat((adjusted / amount).toFixed(2)),
      message: `${fromYear}'deki ${amount.toLocaleString('tr-TR')} ₺ bugün ${Math.round(adjusted).toLocaleString('tr-TR')} ₺ değerinde`
    };
  }

  /**
   * Aylık harcama projeksiyonu (enflasyon dahil)
   */
  expenseProjection(monthlyExpense, months = 12, annualRate = null) {
    const rate = annualRate || this._currentRate();
    const monthlyRate = Math.pow(1 + rate / 100, 1 / 12) - 1;

    const projection = [];
    let total = 0;
    let totalWithout = 0;

    for (let i = 1; i <= months; i++) {
      const adjusted = monthlyExpense * Math.pow(1 + monthlyRate, i);
      total += adjusted;
      totalWithout += monthlyExpense;
      projection.push({
        month: i,
        nominal: Math.round(monthlyExpense),
        adjusted: Math.round(adjusted),
        delta: Math.round(adjusted - monthlyExpense)
      });
    }

    return {
      monthlyExpense,
      annualRate: rate,
      months,
      projection,
      totalWithInflation: Math.round(total),
      totalWithout: Math.round(totalWithout),
      extraCost: Math.round(total - totalWithout),
      message: `${months} ayda enflasyon etkisiyle ${Math.round(total - totalWithout).toLocaleString('tr-TR')} ₺ ekstra maliyet`
    };
  }

  /**
   * Maaş değer kaybı analizi
   */
  salaryErosionByInflation(monthlySalary, years = 3) {
    const rate = this._currentRate();
    const projection = [];

    for (let y = 1; y <= years; y++) {
      const needed = monthlySalary * Math.pow(1 + rate / 100, y);
      const loss = needed - monthlySalary;
      projection.push({
        year: y,
        currentSalary: Math.round(monthlySalary),
        neededSalary: Math.round(needed),
        monthlyLoss: Math.round(loss),
        yearlyLoss: Math.round(loss * 12),
        requiredRaise: Math.round((needed / monthlySalary - 1) * 100)
      });
    }

    return {
      monthlySalary,
      annualRate: rate,
      projection,
      message: `Maaşın aynı kalırsa ${years} yılda satın alma gücü %${Math.round((1 - 1 / Math.pow(1 + rate / 100, years)) * 100)} azalır`
    };
  }

  /**
   * Birikim hedefi enflasyon ayarlı
   */
  adjustedGoal(targetAmount, targetYears) {
    const rate = this._currentRate();
    const adjustedTarget = targetAmount * Math.pow(1 + rate / 100, targetYears);

    return {
      nominalTarget: targetAmount,
      adjustedTarget: Math.round(adjustedTarget),
      difference: Math.round(adjustedTarget - targetAmount),
      targetYears,
      annualRate: rate,
      message: `${targetAmount.toLocaleString('tr-TR')} ₺ hedefin enflasyon ayarlı gerçek değeri: ${Math.round(adjustedTarget).toLocaleString('tr-TR')} ₺`
    };
  }

  _currentRate() {
    return this.historicalRates[new Date().getFullYear()] || 25;
  }
}

module.exports = InflationService;
