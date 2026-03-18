// ═══════════════════════════════════════════════════════════════════
// GoalService — Birikim Hedefleri & Simülasyon (Faz 6)
// Hedef koyma, ilerleme takibi, ters hesaplama
// ═══════════════════════════════════════════════════════════════════

class GoalService {
  constructor({ goals = [], monthlyIncome = 0, monthlyExpense = 0, monthlyDebtPayment = 0 }) {
    this.goals = goals;
    this.income = monthlyIncome;
    this.expense = monthlyExpense;
    this.debtPayment = monthlyDebtPayment;
  }

  /**
   * Tüm hedeflerin durumunu getir
   */
  status() {
    return this.goals.map(g => this._goalStatus(g));
  }

  /**
   * Tek hedef simülasyonu
   */
  simulate(goal) {
    const monthlySavings = goal.monthlySavings || this._availableMonthlySavings();
    if (monthlySavings <= 0) {
      return { ...goal, feasible: false, message: 'Aylık tasarruf kapasitesi yok' };
    }

    const remaining = goal.targetAmount - (goal.currentAmount || 0);
    const monthsNeeded = Math.ceil(remaining / monthlySavings);
    const targetDate = goal.targetDate ? new Date(goal.targetDate) : null;
    const monthsAvailable = targetDate
      ? Math.max(1, Math.ceil((targetDate - new Date()) / (1000 * 60 * 60 * 24 * 30)))
      : monthsNeeded;

    const feasible = monthsNeeded <= monthsAvailable;

    // Aylık projeksiyon
    const projection = [];
    let cumulative = goal.currentAmount || 0;
    for (let i = 1; i <= Math.min(monthsNeeded, 36); i++) {
      cumulative += monthlySavings;
      projection.push({
        month: i,
        cumulative: Math.round(cumulative),
        remaining: Math.max(0, Math.round(goal.targetAmount - cumulative)),
        percent: Math.min(100, Math.round(cumulative / goal.targetAmount * 100))
      });
    }

    return {
      ...goal,
      remaining: Math.round(remaining),
      monthlySavings: Math.round(monthlySavings),
      monthsNeeded,
      monthsAvailable,
      feasible,
      projection,
      percent: Math.round((goal.currentAmount || 0) / goal.targetAmount * 100),
      message: feasible
        ? `${monthsNeeded} ayda hedefe ulaşılabilir (aylık ${monthlySavings.toLocaleString('tr-TR')} ₺ biriktirerek)`
        : `Hedef tarihine kadar ${monthsAvailable} ay var ama ${monthsNeeded} ay gerekiyor. Aylık tasarrufu artırmalısın.`
    };
  }

  /**
   * Ters hesaplama: hedef için ne gerekir?
   */
  reverseCalculate(targetAmount, targetMonths) {
    const monthlySavings = Math.ceil(targetAmount / targetMonths);
    const available = this._availableMonthlySavings();

    return {
      targetAmount,
      targetMonths,
      requiredMonthlySavings: monthlySavings,
      availableMonthlySavings: Math.round(available),
      feasible: monthlySavings <= available,
      gap: Math.round(monthlySavings - available),
      message: monthlySavings <= available
        ? `Aylık ${monthlySavings.toLocaleString('tr-TR')} ₺ biriktirerek ${targetMonths} ayda hedefe ulaşılabilir.`
        : `Aylık ${monthlySavings.toLocaleString('tr-TR')} ₺ gerekiyor ama sadece ${Math.round(available).toLocaleString('tr-TR')} ₺ mevcut. ${Math.round(monthlySavings - available).toLocaleString('tr-TR')} ₺ açık var.`
    };
  }

  _goalStatus(g) {
    const percent = g.targetAmount > 0 ? Math.round((g.currentAmount || 0) / g.targetAmount * 100) : 0;
    const remaining = Math.max(0, g.targetAmount - (g.currentAmount || 0));
    return {
      ...g,
      percent,
      remaining: Math.round(remaining),
      status: percent >= 100 ? 'completed' : percent >= 50 ? 'on_track' : 'behind'
    };
  }

  _availableMonthlySavings() {
    return Math.max(0, this.income - this.expense - this.debtPayment);
  }
}

module.exports = GoalService;
