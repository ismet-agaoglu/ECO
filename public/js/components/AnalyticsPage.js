// ═══════════════════════════════════════════════════════════════════
// AnalyticsPage — Financial ratios, trends, what-if, recommendations
// ═══════════════════════════════════════════════════════════════════

import { api } from '../services/ApiService.js';
import { formatCurrency, MONTH_NAMES } from '../utils/formatters.js';

export class AnalyticsPage {
  constructor(container) {
    this.container = container;
    this.ratiosData = null;
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

      this.ratiosData = ratios;
      this.categories = await api.getCategories();
      this.catTrends = catTrends;

      this.container.innerHTML = `
        <div class="section-header"><h2 class="section-title">Analitik</h2></div>
        ${this.renderRatios(ratios)}
        ${this.renderTrends(trends)}
        ${this.renderRecommendations(recommendations)}
        ${this.renderCategoryTrends(catTrends)}
        ${this.renderWhatIf()}
        <div id="modal-container"></div>
      `;
      this.bindWhatIf();
      this.bindGauges();
    } catch (err) {
      this.container.innerHTML = '<div class="empty-state"><p>Analiz yüklenemedi</p></div>';
      console.error(err);
    }
  }

  renderRatios(r) {
    const gauges = [
      { id: 'debt-to-income', label: 'Toplam Borc / Yillik Gelir', desc: 'Toplam borcunuzun yillik gelirinize orani. %40 alti saglikli', value: r.debtToIncome, safe: 40, warn: 60, unit: '%', icon: '🏦' },
      { id: 'fixed-obligation', label: 'Sabit Gider Orani', desc: 'Aylik sabit giderlerinizin (kira, fatura, abonelik) gelirinize orani. %50 alti ideal', value: r.fixedObligationRatio, safe: 50, warn: 70, unit: '%', icon: '📌' },
      { id: 'savings-rate', label: 'Tasarruf Orani', desc: 'Gelirinizden harcamalar ciktiktan sonra kalan oran. %20 ustu hedefleyin', value: r.savingsRate, safe: 20, warn: 10, unit: '%', icon: '💰', invert: true },
      { id: 'interest-burden', label: 'Faiz / Gelir Orani', desc: 'Borc faizlerinin aylik gelirinize orani. %5 alti guvenli', value: r.interestBurden, safe: 5, warn: 10, unit: '%', icon: '📉' }
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
            <div class="card stat-card fade-in stagger-${i + 1}" data-gauge-id="${g.id}" style="cursor:pointer;transition:transform 0.2s,box-shadow 0.2s">
              <div class="stat-icon">${g.icon}</div>
              <p class="card-title">${g.label}</p>
              <p class="card-value" style="color:${color}">%${g.value.toFixed(1)}</p>
              <div class="progress-bar-container mt-sm">
                <div class="progress-bar" style="width:${Math.min(100, g.value)}%;background:${color}"></div>
              </div>
              ${g.desc ? `<p style="font-size:var(--font-xs);color:var(--text-muted);margin-top:var(--space-sm);line-height:1.4">${g.desc}</p>` : ''}
              <p style="font-size:var(--font-xs);color:var(--accent-primary);margin-top:var(--space-sm);font-weight:600">📊 Nasıl Hesaplandı?</p>
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

  bindGauges() {
    document.querySelectorAll('[data-gauge-id]').forEach(el => {
      el.addEventListener('mouseover', () => {
        el.style.transform = 'scale(1.02)';
        el.style.boxShadow = '0 8px 24px rgba(0,255,170,0.1)';
      });
      el.addEventListener('mouseout', () => {
        el.style.transform = 'scale(1)';
        el.style.boxShadow = '';
      });
      el.addEventListener('click', () => {
        const gaugeId = el.dataset.gaugeId;
        this.showBreakdownModal(gaugeId);
      });
    });
  }

  showBreakdownModal(gaugeId) {
    if (!this.ratiosData) return;

    const r = this.ratiosData;
    let title = '';
    let content = '';

    if (gaugeId === 'debt-to-income') {
      title = 'Toplam Borç / Yıllık Gelir Oranı';
      const breakdown = r.debtToIncomeBreakdown;
      content = `
        <div style="padding:var(--space-lg)">
          <div class="breakdown-row">
            <span>Toplam Borç:</span>
            <span style="font-weight:600">${formatCurrency(breakdown.totalDebt)}</span>
          </div>
          <div class="breakdown-row">
            <span>Yıllık Gelir:</span>
            <span style="font-weight:600">${formatCurrency(breakdown.yearlyIncome)} (${formatCurrency(r.totalIncome)}/ay × 12)</span>
          </div>
          <div class="breakdown-row mt-md" style="border-top:1px solid var(--surface-3);padding-top:var(--space-md)">
            <span>Hesaplama:</span>
            <span>${formatCurrency(breakdown.totalDebt)} / ${formatCurrency(breakdown.yearlyIncome)} = %${r.debtToIncome.toFixed(1)}</span>
          </div>
          <div style="margin-top:var(--space-lg);font-size:var(--font-xs);color:var(--text-muted)">
            <strong>Formül:</strong> ${breakdown.formula}
          </div>
        </div>
      `;
    } else if (gaugeId === 'fixed-obligation') {
      title = 'Sabit Gider Oranı';
      const breakdown = r.fixedObligationBreakdown;
      const itemsList = breakdown.items.map(item => `
        <div class="breakdown-row">
          <span>  ${item.name}:</span>
          <span>${formatCurrency(item.amount)}</span>
        </div>
      `).join('');
      content = `
        <div style="padding:var(--space-lg)">
          <div style="font-weight:600;margin-bottom:var(--space-md)">Sabit Giderler:</div>
          ${itemsList}
          <div class="breakdown-row" style="border-top:1px solid var(--surface-3);margin-top:var(--space-md);padding-top:var(--space-md)">
            <span>Toplam:</span>
            <span style="font-weight:600">${formatCurrency(breakdown.fixedExpensesAmount)}</span>
          </div>
          <div class="breakdown-row mt-md">
            <span>Aylık Gelir:</span>
            <span style="font-weight:600">${formatCurrency(breakdown.monthlyIncome)}</span>
          </div>
          <div class="breakdown-row mt-md" style="border-top:1px solid var(--surface-3);padding-top:var(--space-md)">
            <span>Hesaplama:</span>
            <span>${formatCurrency(breakdown.fixedExpensesAmount)} / ${formatCurrency(breakdown.monthlyIncome)} = %${r.fixedObligationRatio.toFixed(1)}</span>
          </div>
          <div style="margin-top:var(--space-lg);font-size:var(--font-xs);color:var(--text-muted)">
            <strong>Formül:</strong> ${breakdown.formula}
          </div>
        </div>
      `;
    } else if (gaugeId === 'savings-rate') {
      title = 'Tasarruf Oranı';
      const breakdown = r.savingsRateBreakdown;
      content = `
        <div style="padding:var(--space-lg)">
          <div class="breakdown-row">
            <span>Aylık Gelir:</span>
            <span style="font-weight:600">${formatCurrency(breakdown.monthlyIncome)}</span>
          </div>
          <div class="breakdown-row">
            <span>Aylık Gider:</span>
            <span style="font-weight:600">${formatCurrency(breakdown.monthlyExpense)}</span>
          </div>
          <div class="breakdown-row" style="border-top:1px solid var(--surface-3);margin-top:var(--space-md);padding-top:var(--space-md)">
            <span>Aylık Tasarruf:</span>
            <span style="font-weight:600">${formatCurrency(breakdown.monthlySavings)}</span>
          </div>
          <div class="breakdown-row mt-md">
            <span>Hesaplama:</span>
            <span>${formatCurrency(breakdown.monthlySavings)} / ${formatCurrency(breakdown.monthlyIncome)} = %${r.savingsRate.toFixed(1)}</span>
          </div>
          <div style="margin-top:var(--space-lg);font-size:var(--font-xs);color:var(--text-muted)">
            <strong>Formül:</strong> ${breakdown.formula}
          </div>
        </div>
      `;
    } else if (gaugeId === 'interest-burden') {
      title = 'Faiz / Gelir Oranı';
      const breakdown = r.interestBurdenBreakdown;
      const debtsList = breakdown.debtBreakdown.map(debt => `
        <div style="margin-bottom:var(--space-md);padding:var(--space-md);background:var(--surface-3);border-radius:6px">
          <div class="breakdown-row">
            <span>${debt.name}:</span>
            <span>${formatCurrency(debt.balance)}</span>
          </div>
          <div class="breakdown-row" style="font-size:var(--font-xs);color:var(--text-muted);margin-top:4px">
            <span>%${debt.monthlyRate}/ay = ${formatCurrency(debt.monthlyInterest)}/ay</span>
          </div>
        </div>
      `).join('');
      content = `
        <div style="padding:var(--space-lg)">
          <div style="font-weight:600;margin-bottom:var(--space-md)">Borç Detayları:</div>
          ${debtsList}
          <div class="breakdown-row">
            <span>Toplam Aylık Faiz:</span>
            <span style="font-weight:600">${formatCurrency(breakdown.monthlyInterestTotal)}</span>
          </div>
          <div class="breakdown-row mt-md">
            <span>Aylık Gelir:</span>
            <span style="font-weight:600">${formatCurrency(breakdown.monthlyIncome)}</span>
          </div>
          <div class="breakdown-row mt-md" style="border-top:1px solid var(--surface-3);padding-top:var(--space-md)">
            <span>Hesaplama:</span>
            <span>${formatCurrency(breakdown.monthlyInterestTotal)} / ${formatCurrency(breakdown.monthlyIncome)} = %${r.interestBurden.toFixed(1)}</span>
          </div>
          <div style="margin-top:var(--space-lg);font-size:var(--font-xs);color:var(--text-muted)">
            <strong>Formül:</strong> ${breakdown.formula}
          </div>
        </div>
      `;
    }

    const modal = document.createElement('div');
    modal.style.cssText = `
      position:fixed;top:0;left:0;right:0;bottom:0;
      background:rgba(0,0,0,0.5);
      display:flex;align-items:center;justify-content:center;
      z-index:1000;backdrop-filter:blur(4px)
    `;
    modal.innerHTML = `
      <div style="background:var(--surface-1);border-radius:12px;max-width:600px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
        <div style="padding:var(--space-lg);border-bottom:1px solid var(--surface-3);display:flex;justify-content:space-between;align-items:center">
          <h3 style="margin:0;font-size:var(--font-lg)">${title}</h3>
          <button style="background:none;border:none;font-size:24px;cursor:pointer;color:var(--text-muted);padding:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center">×</button>
        </div>
        ${content}
      </div>
    `;
    modal.querySelector('button').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    document.getElementById('modal-container')?.appendChild(modal) || document.body.appendChild(modal);
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
