// ═══════════════════════════════════════════════════════════════════
// ApiService — Centralized HTTP Client for ECO v2
// ═══════════════════════════════════════════════════════════════════

import { API_BASE } from '../utils/constants.js';

class ApiServiceClass {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = { headers: { 'Content-Type': 'application/json' }, ...options };
    if (config.body && typeof config.body === 'object') config.body = JSON.stringify(config.body);
    const res = await fetch(url, config);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  }

  // Transactions
  getTransactions(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/transactions${q ? '?' + q : ''}`);
  }
  addTransaction(data) { return this.request('/transactions', { method: 'POST', body: data }); }
  updateTransaction(id, data) { return this.request(`/transactions/${id}`, { method: 'PUT', body: data }); }
  deleteTransaction(id) { return this.request(`/transactions/${id}`, { method: 'DELETE' }); }
  getPendingTransactions() { return this.request('/transactions/pending'); }
  approveTransaction(id, data = {}) { return this.request(`/transactions/${id}/approve`, { method: 'PUT', body: data }); }
  rejectTransaction(id) { return this.request(`/transactions/${id}/reject`, { method: 'PUT', body: {} }); }

  // Debts
  getDebts() { return this.request('/debts'); }
  addDebt(data) { return this.request('/debts', { method: 'POST', body: data }); }
  updateDebt(id, data) { return this.request(`/debts/${id}`, { method: 'PUT', body: data }); }
  deleteDebt(id) { return this.request(`/debts/${id}`, { method: 'DELETE' }); }
  addDebtPayment(id, data) { return this.request(`/debts/${id}/payments`, { method: 'POST', body: data }); }

  // Accounts
  getAccounts() { return this.request('/accounts'); }
  addAccount(data) { return this.request('/accounts', { method: 'POST', body: data }); }
  updateAccount(id, data) { return this.request(`/accounts/${id}`, { method: 'PUT', body: data }); }
  deleteAccount(id) { return this.request(`/accounts/${id}`, { method: 'DELETE' }); }
  depositAccount(id, data) { return this.request(`/accounts/${id}/deposit`, { method: 'POST', body: data }); }

  // Installments
  getInstallments() { return this.request('/installments'); }
  addInstallment(data) { return this.request('/installments', { method: 'POST', body: data }); }
  deleteInstallment(id) { return this.request(`/installments/${id}`, { method: 'DELETE' }); }

  // Notes
  getNotes() { return this.request('/notes'); }
  addNote(data) { return this.request('/notes', { method: 'POST', body: data }); }
  updateNote(id, data) { return this.request(`/notes/${id}`, { method: 'PUT', body: data }); }
  deleteNote(id) { return this.request(`/notes/${id}`, { method: 'DELETE' }); }
  convertNote(id, data = {}) { return this.request(`/notes/${id}/convert`, { method: 'POST', body: data }); }

  // Categories
  getCategories() { return this.request('/categories'); }
  addCategory(data) { return this.request('/categories', { method: 'POST', body: data }); }

  // Budgets
  getBudget(year, month) { return this.request(`/budget/${year}/${month}`); }
  setBudget(data) { return this.request('/budget', { method: 'POST', body: data }); }
  getRemainingBudget(year, month) { return this.request(`/remaining-budget/${year}/${month}`); }

  // Recurring
  getRecurring() { return this.request('/recurring'); }
  addRecurring(data) { return this.request('/recurring', { method: 'POST', body: data }); }
  deleteRecurring(id) { return this.request(`/recurring/${id}`, { method: 'DELETE' }); }

  // Summary & Analytics
  getSummary(year, month) { return this.request(`/summary?year=${year}&month=${month}`); }
  getCategorySummary(year, month) { return this.request(`/categories/summary?year=${year}&month=${month}`); }
  getDebtAnalysis(extra = 0) { return this.request(`/analysis/debt-payoff?extraPayment=${extra}`); }
  getSavingsAnalysis() { return this.request('/analysis/savings'); }

  // NEW: Enhanced Analytics
  getStrategies(extra = 0) { return this.request(`/analysis/strategies?extraPayment=${extra}`); }
  getTrends(months = 6) { return this.request(`/analytics/trends?months=${months}`); }
  getCategoryTrends(months = 6) { return this.request(`/analytics/category-trends?months=${months}`); }
  getRatios() { return this.request('/analytics/ratios'); }
  getWhatIf(category, percent) { return this.request(`/analytics/what-if?category=${category}&reducePercent=${percent}`); }
  getRecommendations() { return this.request('/recommendations'); }
  getUpcomingPayments() { return this.request('/upcoming-payments'); }
  getAggregations(year, month, groupBy) { return this.request(`/aggregations?year=${year}&month=${month}&groupBy=${groupBy}`); }

  // Audit
  getAuditLog(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/audit-log${q ? '?' + q : ''}`);
  }

  // Survival Engine
  getSurvivalStatus(cash = 0) { return this.request(`/survival/status?cash=${cash}`); }
  postConsolidationSim(data) { return this.request('/survival/consolidation-sim', { method: 'POST', body: data }); }
  getSustainability(cutPercent = 20) { return this.request(`/survival/sustainability?cutPercent=${cutPercent}`); }
  getCrisisTransactions() { return this.request('/crisis-transactions'); }
  addCrisisTransaction(data) { return this.request('/crisis-transactions', { method: 'POST', body: data }); }
  deleteCrisisTransaction(id) { return this.request(`/crisis-transactions/${id}`, { method: 'DELETE' }); }
  getCrisisAnalysis(income = 90000, cash = 0) { return this.request(`/survival/crisis-analysis?income=${income}&cash=${cash}`); }
  getCycleDetection(days = 60) { return this.request(`/survival/cycle-detection?days=${days}`); }

  // Tax & Overtime Engine
  postTaxSimulation(data) { return this.request('/tax/simulate-year', { method: 'POST', body: data }); }
  getTaxBracketForecast(gross = 90000) { return this.request(`/tax/bracket-forecast?gross=${gross}`); }
  getTaxMarginalRate(gross = 90000, month = null) { return this.request(`/tax/marginal-rate?gross=${gross}${month ? '&month=' + month : ''}`); }
  postExtraIncomeSim(data) { return this.request('/tax/extra-income-sim', { method: 'POST', body: data }); }
  postTaxOptimize(data) { return this.request('/tax/optimize', { method: 'POST', body: data }); }
  postOvertimeSim(data) { return this.request('/overtime/simulate', { method: 'POST', body: data }); }
  postOvertimeTarget(data) { return this.request('/overtime/target', { method: 'POST', body: data }); }
  postOvertimeDebtAdvice(data) { return this.request('/overtime/debt-advice', { method: 'POST', body: data }); }
  postOvertimeSurvival(data) { return this.request('/overtime/survival-impact', { method: 'POST', body: data }); }

  // Akıllı Analiz (Faz 3, B1-B9)
  getAnalysisSnapshot(year, month) { return this.request(`/analysis/snapshot?year=${year}&month=${month}`); }
  getNetWorth() { return this.request('/analysis/net-worth'); }
  getLiquidityRisk(months = 3) { return this.request(`/analysis/liquidity-risk?months=${months}`); }
  postConstraintOptimization(data) { return this.request('/analysis/constraint-optimization', { method: 'POST', body: data }); }
  getAnalysisForecast(months = 3) { return this.request(`/analysis/forecast?months=${months}`); }
  getCategoryForecast() { return this.request('/analysis/category-forecast'); }
  getDeviation(year, month) { return this.request(`/analysis/deviation?year=${year}&month=${month}`); }
  getEndOfMonth(year, month) { return this.request(`/analysis/end-of-month?year=${year}&month=${month}`); }
  getSavingsPotential() { return this.request('/analysis/savings-potential'); }
  getAnalysisFull(year, month) { return this.request(`/analysis/full?year=${year}&month=${month}`); }

  // Davranışsal Finans (Faz 4, B10-B17)
  getBehavioralPatterns() { return this.request('/behavioral/patterns'); }
  getBehavioralAnomalies() { return this.request('/behavioral/anomalies'); }
  getWhatChanged(year, month) { return this.request(`/behavioral/what-changed?year=${year}&month=${month}`); }
  getFinancialStress() { return this.request('/behavioral/stress'); }
  getSalaryErosion(year, month) { return this.request(`/behavioral/salary-erosion?year=${year}&month=${month}`); }
  getRiskScore() { return this.request('/behavioral/risk-score'); }
  getDailyLimit(year, month) { return this.request(`/behavioral/daily-limit?year=${year}&month=${month}`); }
  getMonteCarlo(months = 6) { return this.request(`/behavioral/monte-carlo?months=${months}`); }
  getBehavioralFull(year, month) { return this.request(`/behavioral/full?year=${year}&month=${month}`); }

  // Faz 5 — Agent & Pipeline
  postNLPParse(text) { return this.request('/nlp/parse', { method: 'POST', body: { text } }); }
  postNLPParseBatch(texts) { return this.request('/nlp/parse', { method: 'POST', body: { texts } }); }
  postImportProcess(items, source = 'manual') { return this.request('/import/process', { method: 'POST', body: { items, source } }); }
  postImportCommit(items) { return this.request('/import/commit', { method: 'POST', body: { items } }); }
  postDuplicateCheck(transaction) { return this.request('/duplicate/check', { method: 'POST', body: { transaction } }); }
  postCategorize(text) { return this.request('/categorize', { method: 'POST', body: { text } }); }
  getCategorizeMappings() { return this.request('/categorize/mappings'); }
  getNotifications() { return this.request('/notifications'); }
  getSnapshots() { return this.request('/snapshots'); }
  postSnapshotsGenerate() { return this.request('/snapshots/generate', { method: 'POST', body: {} }); }
  getSnapshotsTrend(months = 6) { return this.request(`/snapshots/trend?months=${months}`); }
  getActions() { return this.request('/actions'); }
  postValidatePlan(plan) { return this.request('/actions/validate-plan', { method: 'POST', body: plan }); }
  postReverseGoal(data) { return this.request('/actions/reverse-goal', { method: 'POST', body: data }); }

  // Faz 6 — Goals, Inflation, Reports, Calendar
  getGoals() { return this.request('/goals'); }
  addGoal(data) { return this.request('/goals', { method: 'POST', body: data }); }
  updateGoal(id, data) { return this.request(`/goals/${id}`, { method: 'PUT', body: data }); }
  deleteGoal(id) { return this.request(`/goals/${id}`, { method: 'DELETE' }); }
  simulateGoal(id) { return this.request(`/goals/simulate/${id}`); }
  postGoalReverseCalc(data) { return this.request('/goals/reverse-calc', { method: 'POST', body: data }); }
  postInflationFuture(data) { return this.request('/inflation/future-value', { method: 'POST', body: data }); }
  postInflationPast(data) { return this.request('/inflation/past-value', { method: 'POST', body: data }); }
  postInflationExpense(data) { return this.request('/inflation/expense-projection', { method: 'POST', body: data }); }
  postInflationSalary(data) { return this.request('/inflation/salary-erosion', { method: 'POST', body: data }); }
  getYearlyComparison(y1, y2) { return this.request(`/reports/yearly-comparison?year1=${y1}&year2=${y2}`); }
  getTaxSummary(year) { return this.request(`/reports/tax-summary?year=${year}`); }
  getCalendar(year, month) { return this.request(`/calendar?year=${year}&month=${month}`); }

  // Finance Engine
  getInterestInfo() { return this.request('/finance/interest-info'); }
  postMinPaymentTrap(data) { return this.request('/finance/min-payment-trap', { method: 'POST', body: data }); }
  getCashflow() { return this.request('/finance/cashflow'); }
  getDebtPriority() { return this.request('/finance/debt-priority'); }
  getAmortization(debtId) { return this.request(`/finance/amortization/${debtId}`); }
}

export const api = new ApiServiceClass();
