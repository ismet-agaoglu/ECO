// ═══════════════════════════════════════════════════════════════════
// SavingsView Component — Savings projections, debt payoff timeline
// ═══════════════════════════════════════════════════════════════════

import { api } from '../services/ApiService.js';
import { formatCurrency } from '../utils/formatters.js';

export class SavingsView {
  constructor(container) {
    this.container = container;
  }

  async render() {
    this.container.innerHTML = '<div class="loading">Analiz hazırlanıyor...</div>';

    try {
      const savings = await api.getSavingsAnalysis();

      this.container.innerHTML = `
        <div class="section-header">
          <h2 class="section-title">Tasarruf & Analiz</h2>
        </div>

        ${this.renderOverview(savings)}
        ${this.renderProjectionTable(savings)}
        ${this.renderSpendingPatterns(savings)}
        ${this.renderTips(savings)}
      `;
    } catch (err) {
      this.container.innerHTML = '<div class="empty-state"><p>Analiz yüklenemedi</p></div>';
      console.error(err);
    }
  }

  renderOverview(data) {
    const savingsClass = data.monthlySavings >= 0 ? 'positive' : 'negative';

    let debtFreeText, debtFreeColor, debtFreeSubtext;
    switch (data.debtPayoffStatus) {
      case 'no_debt':
        debtFreeText = 'Borç yok';
        debtFreeColor = 'var(--accent-primary)';
        debtFreeSubtext = 'Tebrikler! 🎉';
        break;
      case 'payable':
        const years = Math.floor(data.monthsToPayOffDebt / 12);
        const months = data.monthsToPayOffDebt % 12;
        debtFreeText = years > 0 ? `${years} yıl ${months} ay` : `${months} ay`;
        debtFreeColor = 'var(--accent-warning)';
        debtFreeSubtext = `Tüm tasarruf borç ödemesine giderse`;
        break;
      case 'insufficient':
        debtFreeText = 'Yetersiz';
        debtFreeColor = 'var(--accent-danger)';
        debtFreeSubtext = `Tasarruf (${formatCurrency(data.monthlySavings)}) aylık faizi (${formatCurrency(data.totalMonthlyInterest)}) karşılamıyor`;
        break;
      case 'negative_savings':
        debtFreeText = 'Açık var';
        debtFreeColor = 'var(--accent-danger)';
        debtFreeSubtext = `Aylık ${formatCurrency(Math.abs(data.monthlySavings))} açık — borç büyüyor`;
        break;
      default:
        debtFreeText = '—';
        debtFreeColor = 'var(--text-muted)';
        debtFreeSubtext = '';
    }

    return `
      <div class="stats-grid">
        <div class="card stat-card income fade-in stagger-1">
          <div class="stat-icon">💰</div>
          <p class="card-title">Ort. Aylık Gelir</p>
          <p class="card-value positive">${formatCurrency(data.avgMonthlyIncome)}</p>
        </div>
        <div class="card stat-card expense fade-in stagger-2">
          <div class="stat-icon">💸</div>
          <p class="card-title">Ort. Aylık Gider</p>
          <p class="card-value negative">${formatCurrency(data.avgMonthlyExpense)}</p>
        </div>
        <div class="card stat-card net fade-in stagger-3">
          <div class="stat-icon">📈</div>
          <p class="card-title">Aylık Tasarruf</p>
          <p class="card-value ${savingsClass}">${formatCurrency(data.monthlySavings)}</p>
          ${data.totalMonthlyInterest > 0 ? `<p class="card-subtitle">Aylık faiz yükü: ${formatCurrency(data.totalMonthlyInterest)}</p>` : ''}
        </div>
        <div class="card stat-card debt fade-in stagger-4">
          <div class="stat-icon">🎯</div>
          <p class="card-title">Borçsuz Kalma</p>
          <p class="card-value" style="font-size:var(--font-lg);color:${debtFreeColor}">${debtFreeText}</p>
          ${debtFreeSubtext ? `<p class="card-subtitle">${debtFreeSubtext}</p>` : ''}
        </div>
        ${data.totalDebt > 0 ? `
        <div class="card stat-card fade-in stagger-5">
          <div class="stat-icon">🏦</div>
          <p class="card-title">Toplam Borç</p>
          <p class="card-value negative">${formatCurrency(data.totalDebt)}</p>
          <p class="card-subtitle">Aylık faiz: ${formatCurrency(data.totalMonthlyInterest)}</p>
        </div>
        ` : ''}
      </div>
    `;
  }

  renderProjectionTable(data) {
    if (!data.projections || data.projections.length === 0) {
      return `
        <div class="card mt-lg fade-in">
          <p class="card-title">Yeterli veri yok — Gelir ve gider girdikçe projeksiyon görünecek.</p>
        </div>
      `;
    }

    // Show 12-month projection
    const show = data.projections.slice(0, 12);
    const maxSavings = Math.max(...show.map(p => Math.abs(p.savings)), 1);

    return `
      <div class="card mt-lg fade-in">
        <h3 class="card-title" style="margin-bottom:var(--space-lg)">📅 12 Aylık Tasarruf Projeksiyonu</h3>
        <div class="bar-chart" style="min-height:200px">
          ${show.map(p => {
            const heightPercent = Math.abs(p.savings) / maxSavings * 100;
            const isNeg = p.savings < 0;
            return `
              <div class="bar-group">
                <div style="font-size:var(--font-xs);color:${isNeg ? 'var(--accent-danger)' : 'var(--accent-primary)'};font-weight:600">${formatCurrency(p.savings)}</div>
                <div class="bar ${isNeg ? 'expense' : 'income'}" style="height:${Math.max(4, heightPercent)}%"></div>
                <div class="bar-label">${p.month}. Ay</div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="table-responsive mt-lg"><table class="data-table">
          <thead>
            <tr>
              <th>Ay</th>
              <th style="text-align:right">Birikmiş Tasarruf</th>
              <th style="text-align:right">Kalan Borç</th>
            </tr>
          </thead>
          <tbody>
            ${show.map((p, idx) => {
              const prevDebt = idx > 0 ? show[idx - 1].debtRemaining : data.totalDebt;
              const debtGrowing = p.debtRemaining > prevDebt;
              const debtColor = p.debtRemaining <= 0 ? 'var(--accent-primary)' : debtGrowing ? 'var(--accent-danger)' : 'var(--accent-warning)';
              return `
              <tr>
                <td>${p.month}. Ay</td>
                <td class="text-right ${p.savings >= 0 ? 'amount-income' : 'amount-expense'}">${formatCurrency(p.savings)}</td>
                <td class="text-right" style="color:${debtColor}">
                  ${p.debtRemaining <= 0 ? '✅ Borçsuz' : (debtGrowing ? '📈 ' : '📉 ') + formatCurrency(p.debtRemaining)}
                </td>
              </tr>
            `}).join('')}
          </tbody>
        </table></div>
      </div>
    `;
  }

  renderSpendingPatterns(data) {
    const entries = Object.entries(data.categorySpending || {});
    if (entries.length === 0) return '';

    const total = entries.reduce((s, [, v]) => s + v, 0);
    entries.sort((a, b) => b[1] - a[1]);

    return `
      <div class="card mt-lg fade-in">
        <h3 class="card-title" style="margin-bottom:var(--space-lg)">📊 Harcama Kalıpları (Tüm Zamanlar)</h3>
        ${entries.slice(0, 8).map(([catId, amount]) => {
          const percent = ((amount / total) * 100).toFixed(1);
          return `
            <div class="flex-between mb-md">
              <span style="font-size:var(--font-sm)">${catId}</span>
              <span style="font-weight:600">${formatCurrency(amount)} (%${percent})</span>
            </div>
            <div class="progress-bar-container mb-md">
              <div class="progress-bar" style="width:${percent}%"></div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderTips(data) {
    const tips = [];

    if (data.monthlySavings < 0) {
      tips.push({
        icon: '🚨',
        title: 'Aylık Açık!',
        desc: `Her ay ortalama ${formatCurrency(Math.abs(data.monthlySavings))} açık veriyorsunuz. Harcamalarınızı gözden geçirin.`,
        type: 'danger'
      });
    }

    if (data.totalDebt > 0 && data.monthlySavings > 0 && data.debtPayoffStatus === 'payable') {
      const y = Math.floor(data.monthsToPayOffDebt / 12);
      const m = data.monthsToPayOffDebt % 12;
      const timeStr = y > 0 ? `${y} yıl ${m} ay` : `${m} ay`;
      tips.push({
        icon: '💡',
        title: 'Borç Önceliği',
        desc: `Tasarrufunuzun tamamını borç ödemesine yönlendirirseniz yaklaşık ${timeStr}da borçsuz olabilirsiniz.`,
        type: 'info'
      });
    }

    if (data.totalDebt > 0 && data.debtPayoffStatus === 'insufficient') {
      tips.push({
        icon: '🔴',
        title: 'Borç Faizi Tasarrufu Aşıyor',
        desc: `Aylık tasarrufunuz (${formatCurrency(data.monthlySavings)}) borçlarınızın aylık faizini (${formatCurrency(data.totalMonthlyInterest)}) karşılamıyor. Borç büyümeye devam edecek. Geliri artırma veya harcama azaltma yollarını değerlendirin.`,
        type: 'danger'
      });
    }

    if (data.totalDebt > 0 && data.monthlySavings < 0) {
      tips.push({
        icon: '🚨',
        title: 'Borç Sarmalı Riski',
        desc: `Hem aylık açık veriyorsunuz (${formatCurrency(Math.abs(data.monthlySavings))}) hem de ${formatCurrency(data.totalDebt)} borcunuz var. Her ay borç faiz + açık kadar büyüyor. Acil önlem alınmalı.`,
        type: 'danger'
      });
    }

    if (data.monthlySavings > 0 && data.totalDebt === 0) {
      tips.push({
        icon: '🎉',
        title: 'Harika Gidiyorsunuz!',
        desc: `Aylık ${formatCurrency(data.monthlySavings)} tasarruf ediyorsunuz. 1 yılda ${formatCurrency(data.monthlySavings * 12)} biriktirebilirsiniz.`,
        type: 'success'
      });
    }

    if (data.avgMonthlyExpense > data.avgMonthlyIncome * 0.8) {
      tips.push({
        icon: '⚠️',
        title: 'Yüksek Harcama Oranı',
        desc: 'Gelirinizin %80\'inden fazlasını harcıyorsunuz. İdeal oran %70 civarıdır.',
        type: 'warning'
      });
    }

    if (tips.length === 0) return '';

    return `
      <div class="section-header mt-lg">
        <h3 class="section-title">💡 Öneriler</h3>
      </div>
      ${tips.map(tip => `
        <div class="card mb-md fade-in" style="border-left:3px solid var(--accent-${tip.type === 'success' ? 'primary' : tip.type === 'danger' ? 'danger' : tip.type === 'warning' ? 'warning' : 'info'})">
          <div class="flex gap-md" style="align-items:flex-start">
            <span style="font-size:1.5rem">${tip.icon}</span>
            <div>
              <h4 style="font-weight:700;margin-bottom:var(--space-xs)">${tip.title}</h4>
              <p style="font-size:var(--font-sm);color:var(--text-secondary)">${tip.desc}</p>
            </div>
          </div>
        </div>
      `).join('')}
    `;
  }
}
