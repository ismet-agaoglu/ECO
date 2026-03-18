// ═══════════════════════════════════════════════════════════════════
// Dashboard Component — Overview stats, charts, recent transactions
// ═══════════════════════════════════════════════════════════════════

import { api } from '../services/ApiService.js';
import { formatCurrency, formatMonthYear, MONTH_NAMES } from '../utils/formatters.js';

export class Dashboard {
  constructor(container, year, month) {
    this.container = container;
    this.year = year;
    this.month = month;
  }

  async render() {
    this.container.innerHTML = '<div class="loading">Yükleniyor...</div>';

    try {
      const [summary, categorySummary, transactions, debts, budgetInfo, upcoming, recommendations, pending] = await Promise.all([
        api.getSummary(this.year, this.month),
        api.getCategorySummary(this.year, this.month),
        api.getTransactions({ year: this.year, month: this.month }),
        api.getDebts(),
        api.getRemainingBudget(this.year, this.month),
        api.getUpcomingPayments().catch(() => []),
        api.getRecommendations().catch(() => []),
        api.getPendingTransactions().catch(() => [])
      ]);

      this.container.innerHTML = `
        ${this.renderStats(summary, budgetInfo)}
        <div class="charts-grid">
          ${this.renderCategoryChart(categorySummary)}
          ${this.renderBudgetWidget(budgetInfo, summary)}
        </div>
        ${this.renderUpcoming(upcoming)}
        ${this.renderAlerts(recommendations, pending)}
        ${this.renderRecentTransactions(transactions)}
        ${this.renderDebtSummary(debts)}
      `;
    } catch (err) {
      this.container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><p class="empty-state-text">Veri yüklenirken hata oluştu</p></div>';
      console.error(err);
    }
  }

  renderStats(summary, budget) {
    const netClass = summary.net >= 0 ? 'positive' : 'negative';
    return `
      <div class="stats-grid">
        <div class="card stat-card income fade-in stagger-1">
          <div class="stat-icon">💰</div>
          <p class="card-title">Toplam Gelir</p>
          <p class="card-value positive">${formatCurrency(summary.totalIncome)}</p>
          <p class="card-subtitle">${summary.transactionCount} işlem</p>
        </div>
        <div class="card stat-card expense fade-in stagger-2">
          <div class="stat-icon">💸</div>
          <p class="card-title">Toplam Gider</p>
          <p class="card-value negative">${formatCurrency(summary.totalExpense)}</p>
        </div>
        <div class="card stat-card net fade-in stagger-3">
          <div class="stat-icon">📊</div>
          <p class="card-title">Net Durum</p>
          <p class="card-value ${netClass}">${formatCurrency(summary.net)}</p>
        </div>
        <div class="card stat-card debt fade-in stagger-4">
          <div class="stat-icon">🏦</div>
          <p class="card-title">Toplam Borç</p>
          <p class="card-value negative">${formatCurrency(summary.totalDebt)}</p>
          <p class="card-subtitle">Aylık faiz: ${formatCurrency(summary.totalInterestPerMonth)}</p>
        </div>
      </div>
    `;
  }

  renderCategoryChart(categories) {
    if (categories.length === 0) {
      return `
        <div class="card chart-card fade-in stagger-5">
          <div class="card-header"><h3 class="card-title">Harcama Dağılımı</h3></div>
          <div class="empty-state">
            <div class="empty-state-icon">📂</div>
            <p class="empty-state-text">Bu ay henüz harcama yok</p>
          </div>
        </div>
      `;
    }

    const total = categories.reduce((s, c) => s + c.total, 0);
    let accumulated = 0;
    const gradientParts = categories.map(cat => {
      const start = (accumulated / total) * 100;
      accumulated += cat.total;
      const end = (accumulated / total) * 100;
      return `${cat.color} ${start}% ${end}%`;
    });

    return `
      <div class="card chart-card fade-in stagger-5">
        <div class="card-header"><h3 class="card-title">Harcama Dağılımı</h3></div>
        <div class="donut-chart-container">
          <div class="donut-chart" style="background: conic-gradient(${gradientParts.join(', ')})">
            <div class="donut-center">
              <span class="donut-center-label">Toplam</span>
              <span class="donut-center-value">${formatCurrency(total)}</span>
            </div>
          </div>
          <div class="donut-legend">
            ${categories.slice(0, 6).map(cat => `
              <div class="legend-item">
                <span class="legend-dot" style="background:${cat.color}"></span>
                <span class="legend-label">${cat.icon} ${cat.name}</span>
                <span class="legend-value">${formatCurrency(cat.total)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderBudgetWidget(budget, summary) {
    if (!budget.budgetLimit || budget.budgetLimit === 0) {
      return `
        <div class="card chart-card fade-in stagger-6">
          <div class="card-header"><h3 class="card-title">Bütçe Takibi</h3></div>
          <div class="empty-state">
            <div class="empty-state-icon">🎯</div>
            <p class="empty-state-text">Henüz bütçe belirlenmedi</p>
            <p class="card-subtitle">Ayarlar bölümünden aylık bütçe belirleyebilirsiniz</p>
          </div>
        </div>
      `;
    }

    const percent = Math.min(100, (budget.spent / budget.budgetLimit) * 100);
    const circumference = 2 * Math.PI * 85;
    const offset = circumference - (percent / 100) * circumference;
    const strokeColor = percent > 90 ? 'var(--accent-danger)' : percent > 70 ? 'var(--accent-warning)' : 'var(--accent-primary)';
    const isOver = budget.remaining < 0;

    return `
      <div class="card chart-card fade-in stagger-6">
        <div class="card-header"><h3 class="card-title">Bütçe Takibi</h3></div>
        <div class="budget-display">
          <div class="budget-circle">
            <svg viewBox="0 0 200 200">
              <circle class="budget-circle-bg" cx="100" cy="100" r="85"></circle>
              <circle class="budget-circle-progress" cx="100" cy="100" r="85"
                stroke="${strokeColor}"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${offset}">
              </circle>
            </svg>
            <div class="budget-inner">
              <div class="budget-remaining ${isOver ? 'negative' : 'positive'}">${formatCurrency(Math.abs(budget.remaining))}</div>
              <div class="budget-remaining-label">${isOver ? 'Bütçe Aşımı' : 'Kalan'}</div>
            </div>
          </div>
          <div class="budget-stats">
            <div class="budget-stat">
              <div class="budget-stat-value">${formatCurrency(budget.budgetLimit)}</div>
              <div class="budget-stat-label">Limit</div>
            </div>
            <div class="budget-stat">
              <div class="budget-stat-value negative">${formatCurrency(budget.spent)}</div>
              <div class="budget-stat-label">Harcanan</div>
            </div>
            <div class="budget-stat">
              <div class="budget-stat-value">${formatCurrency(budget.dailyAvg)}</div>
              <div class="budget-stat-label">Günlük</div>
            </div>
          </div>
          <div class="progress-bar-container mt-md">
            <div class="progress-bar ${percent > 90 ? 'danger' : percent > 70 ? 'warning' : ''}" style="width:${Math.min(100, percent)}%"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:var(--space-xs);font-size:var(--font-xs);color:var(--text-muted)">
            <span>%${percent.toFixed(0)} kullanıldı</span>
            <span>${isOver ? '⚠️ Aşım!' : `%${(100 - percent).toFixed(0)} kaldı`}</span>
          </div>
        </div>
      </div>
    `;
  }

  renderRecentTransactions(transactions) {
    const recent = transactions.slice(0, 8);
    if (recent.length === 0) {
      return `
        <div class="card mt-lg fade-in">
          <div class="card-header"><h3 class="card-title">Son İşlemler</h3></div>
          <div class="empty-state">
            <div class="empty-state-icon">💸</div>
            <p class="empty-state-text">Henüz işlem girişi yapılmadı</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="card mt-lg fade-in">
        <div class="card-header">
          <h3 class="card-title">Son İşlemler</h3>
        </div>
        <div class="recent-list">
          ${recent.map(tx => {
            const isIncome = tx.type === 'income';
            const amountClass = isIncome ? 'amount-income' : 'amount-expense';
            const prefix = isIncome ? '+' : '-';
            return `
              <div class="recent-item">
                <div class="recent-info">
                  <div class="recent-desc">${tx.description || 'İşlem'}</div>
                  <div class="recent-date">${new Date(tx.date).toLocaleDateString('tr-TR')}</div>
                </div>
                <div class="recent-amount ${amountClass}">${prefix}${formatCurrency(tx.amount)}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  renderDebtSummary(debts) {
    if (debts.length === 0) return '';

    const totalDebt = debts.reduce((s, d) => s + d.currentBalance, 0);
    const totalInterest = debts.reduce((s, d) => s + (d.currentBalance * d.interestRate / 100 / 12), 0);

    return `
      <div class="card mt-lg fade-in">
        <div class="card-header">
          <h3 class="card-title">Borç Özeti</h3>
          <span class="tag tag-expense">${debts.length} borç</span>
        </div>
        <div class="stats-grid">
          <div class="card stat-card debt">
            <p class="card-title">Toplam Borç</p>
            <p class="card-value">${formatCurrency(totalDebt)}</p>
          </div>
          <div class="card stat-card expense">
            <p class="card-title">Aylık Faiz</p>
            <p class="card-value negative">${formatCurrency(totalInterest)}</p>
          </div>
        </div>
      </div>
    `;
  }

  renderUpcoming(upcoming) {
    if (!upcoming || upcoming.length === 0) return '';
    const total = upcoming.reduce((s, u) => s + u.amount, 0);

    return `
      <div class="card mt-lg fade-in">
        <div class="card-header">
          <h3 class="card-title">📅 Yaklaşan Ödemeler</h3>
          <span class="tag tag-expense">${formatCurrency(total)}</span>
        </div>
        <div class="recent-list">
          ${upcoming.map(u => `
            <div class="recent-item">
              <div class="recent-info">
                <div class="recent-desc">${u.type === 'installment' ? '💳' : '🔄'} ${u.name}</div>
                <div class="recent-date">${u.remaining || u.type === 'recurring' ? 'Aylık' : ''}</div>
              </div>
              <div class="recent-amount amount-expense">-${formatCurrency(u.amount)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderAlerts(recommendations, pending) {
    const items = [];

    if (pending && pending.length > 0) {
      items.push(`
        <div class="card mb-md fade-in" style="border-left:3px solid var(--accent-info)">
            <div class="flex-between">
              <span>🤖 <strong>${pending.length} adet</strong> agent işlemi onay bekliyor</span>
              <span class="badge badge-info">Agent sekmesinden incele</span>
          </div>
        </div>
      `);
    }

    if (recommendations && recommendations.length > 0) {
      const typeColors = { danger: 'var(--accent-danger)', warning: 'var(--accent-warning)', info: 'var(--accent-info)', tip: 'var(--accent-primary)', success: 'var(--accent-primary)' };
      recommendations.slice(0, 3).forEach(r => {
        items.push(`
          <div class="card mb-md fade-in" style="border-left:3px solid ${typeColors[r.type] || 'var(--accent-info)'}">
            <h4 class="card-title">${r.title}</h4>
            <p class="card-subtitle">${r.description}</p>
          </div>
        `);
      });
    }

    if (items.length === 0) return '';
    return `
      <div class="mt-lg">
        <h3 class="section-title mb-md">⚡ Uyarılar & Öneriler</h3>
        ${items.join('')}
      </div>
    `;
  }
}
