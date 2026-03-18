// ═══════════════════════════════════════════════════════════════════
// AnalyticsPage — Financial ratios, trends, what-if, recommendations
// ═══════════════════════════════════════════════════════════════════

import { api } from '../services/ApiService.js';
import { formatCurrency, MONTH_NAMES } from '../utils/formatters.js';

export class AnalyticsPage {
  constructor(container) {
    this.container = container;
  }

  async render() {
    this.container.innerHTML = '<div class="loading">Analiz yükleniyor...</div>';
    try {
      const [ratios, trends, recommendations, catTrends] = await Promise.all([
        api.getRatios(),
        api.getTrends(6),
        api.getRecommendations(),
        api.getCategoryTrends(6)
      ]);

      this.categories = await api.getCategories();
      this.catTrends = catTrends;

      this.container.innerHTML = `
        <div class="section-header"><h2 class="section-title">Analitik</h2></div>
        ${this.renderRatios(ratios)}
        ${this.renderTrends(trends)}
        ${this.renderRecommendations(recommendations)}
        ${this.renderCategoryTrends(catTrends)}
        ${this.renderWhatIf()}
      `;
      this.bindWhatIf();
    } catch (err) {
      this.container.innerHTML = '<div class="empty-state"><p>Analiz yüklenemedi</p></div>';
      console.error(err);
    }
  }

  renderRatios(r) {
    const gauges = [
      { label: 'Borç/Gelir Oranı', value: r.debtToIncome, safe: 40, warn: 60, unit: '%', icon: '🏦' },
      { label: 'Sabit Yükümlülük', value: r.fixedObligationRatio, safe: 50, warn: 70, unit: '%', icon: '📌' },
      { label: 'Tasarruf Oranı', value: r.savingsRate, safe: 20, warn: 10, unit: '%', icon: '💰', invert: true },
      { label: 'Faiz Yükü', value: r.interestBurden, safe: 5, warn: 10, unit: '%', icon: '📉' }
    ];

    return `
      <div class="stats-grid">
        ${gauges.map((g, i) => {
          let color = 'var(--accent-primary)';
          if (g.invert) {
            if (g.value < g.warn) color = 'var(--accent-danger)';
            else if (g.value < g.safe) color = 'var(--accent-warning)';
          } else {
            if (g.value > g.warn) color = 'var(--accent-danger)';
            else if (g.value > g.safe) color = 'var(--accent-warning)';
          }
          return `
            <div class="card stat-card fade-in stagger-${i + 1}">
              <div class="stat-icon">${g.icon}</div>
              <p class="card-title">${g.label}</p>
              <p class="card-value" style="color:${color}">%${g.value.toFixed(1)}</p>
              <div class="progress-bar-container mt-sm">
                <div class="progress-bar" style="width:${Math.min(100, g.value)}%;background:${color}"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="stats-grid mt-md">
        <div class="card stat-card fade-in">
          <p class="card-title">Harcanabilir Gelir</p>
          <p class="card-value positive">${formatCurrency(r.discretionaryIncome)}</p>
          <p class="card-subtitle">Sabit gider + faiz düşüldükten sonra</p>
        </div>
        <div class="card stat-card fade-in">
          <p class="card-title">Aylık Faiz Ödemesi</p>
          <p class="card-value negative">${formatCurrency(r.monthlyInterest)}</p>
        </div>
        <div class="card stat-card fade-in">
          <p class="card-title">Toplam Borç</p>
          <p class="card-value" style="color:var(--accent-warning)">${formatCurrency(r.totalDebt)}</p>
        </div>
      </div>
    `;
  }

  renderTrends(trends) {
    if (trends.length === 0) return '';
    const maxVal = Math.max(...trends.map(t => Math.max(t.income, t.expense)), 1);

    return `
      <div class="card mt-lg fade-in">
        <h3 class="card-title mb-lg">Gelir/Gider Trendi (Son 6 Ay)</h3>
        <div style="display:flex;gap:var(--space-md);align-items:flex-end;height:180px;padding:0 var(--space-md)">
          ${trends.map(t => {
            const incH = (t.income / maxVal) * 100;
            const expH = (t.expense / maxVal) * 100;
            return `
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:var(--space-xs)">
                <div style="display:flex;gap:2px;align-items:flex-end;width:100%;height:140px">
                  <div style="flex:1;background:var(--accent-primary);border-radius:4px 4px 0 0;height:${Math.max(2, incH)}%;opacity:0.8" title="Gelir: ${formatCurrency(t.income)}"></div>
                  <div style="flex:1;background:var(--accent-danger);border-radius:4px 4px 0 0;height:${Math.max(2, expH)}%;opacity:0.8" title="Gider: ${formatCurrency(t.expense)}"></div>
                </div>
                <div style="font-size:var(--font-xs);color:var(--text-muted)">${MONTH_NAMES[t.month - 1]?.slice(0, 3)}</div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="flex gap-lg mt-md" style="justify-content:center">
          <span style="font-size:var(--font-xs)"><span style="display:inline-block;width:10px;height:10px;background:var(--accent-primary);border-radius:2px;margin-right:4px"></span>Gelir</span>
          <span style="font-size:var(--font-xs)"><span style="display:inline-block;width:10px;height:10px;background:var(--accent-danger);border-radius:2px;margin-right:4px"></span>Gider</span>
        </div>
      </div>
    `;
  }

  renderRecommendations(recs) {
    if (recs.length === 0) return '';
    const typeColors = { danger: 'var(--accent-danger)', warning: 'var(--accent-warning)', info: 'var(--accent-info)', tip: 'var(--accent-primary)', success: 'var(--accent-primary)' };

    return `
      <div class="section-header mt-lg"><h3 class="section-title">💡 Akıllı Öneriler</h3></div>
      ${recs.map(r => `
        <div class="card mb-md fade-in" style="border-left:3px solid ${typeColors[r.type] || 'var(--accent-info)'}">
          <h4 class="card-title">${r.title}</h4>
          <p class="card-subtitle">${r.description}</p>
          <p class="card-subtitle">📌 ${r.impact}</p>
          <p class="card-subtitle mt-sm" style="color:var(--accent-primary)">✅ ${r.action}</p>
        </div>
      `).join('')}
    `;
  }

  renderCategoryTrends(catTrends) {
    if (catTrends.length === 0) return '';
    return `
      <div class="card mt-lg fade-in">
        <h3 class="card-title mb-lg">Kategori Trendleri (Son 6 Ay)</h3>
        <table class="data-table">
          <thead><tr><th>Kategori</th>${catTrends[0]?.months?.map(m => `<th style="text-align:right">${MONTH_NAMES[m.month - 1]?.slice(0, 3)}</th>`).join('') || ''}</tr></thead>
          <tbody>
            ${catTrends.map(ct => `
              <tr>
                <td>${ct.icon} ${ct.name}</td>
                ${ct.months.map(m => `<td class="text-right">${m.total > 0 ? formatCurrency(m.total) : '-'}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderWhatIf() {
    const catOpts = (this.categories || []).map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
    return `
      <div class="card mt-lg fade-in">
        <h3 class="card-title mb-lg">Ya Şöyle Olsaydı?</h3>
        <p class="card-subtitle mb-lg">Bir kategoriyi belirli oranda azaltırsanız ne kadar tasarruf edersiniz?</p>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Kategori</label>
            <select class="form-select" id="whatIfCategory">${catOpts}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Azaltma (%)</label>
            <input class="form-input" type="number" id="whatIfPercent" value="20" min="5" max="100" step="5">
          </div>
          <div class="form-group" style="display:flex;align-items:flex-end">
            <button class="btn btn-primary" id="whatIfBtn">Hesapla</button>
          </div>
        </div>
        <div id="whatIfResult"></div>
      </div>
    `;
  }

  bindWhatIf() {
    document.getElementById('whatIfBtn')?.addEventListener('click', async () => {
      const cat = document.getElementById('whatIfCategory').value;
      const pct = document.getElementById('whatIfPercent').value;
      const result = await api.getWhatIf(cat, pct);
      const el = document.getElementById('whatIfResult');
      if (!el) return;
      el.innerHTML = `
        <div class="stats-grid mt-lg">
          <div class="card stat-card">
            <p class="card-title">Aylık Tasarruf</p>
            <p class="card-value positive">${formatCurrency(result.monthlySavings)}</p>
          </div>
          <div class="card stat-card">
            <p class="card-title">Yıllık Tasarruf</p>
            <p class="card-value positive">${formatCurrency(result.yearlySavings)}</p>
          </div>
          <div class="card stat-card">
            <p class="card-title">Yeni Aylık Net</p>
            <p class="card-value" style="color:${result.newMonthlyNet >= 0 ? 'var(--accent-primary)' : 'var(--accent-danger)'}">${formatCurrency(result.newMonthlyNet)}</p>
          </div>
        </div>
      `;
    });
  }
}
