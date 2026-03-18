// ═══════════════════════════════════════════════════════════════════
// StrategySimulator — 5-mode debt payoff comparison
// ═══════════════════════════════════════════════════════════════════

import { api } from '../services/ApiService.js';
import { formatCurrency } from '../utils/formatters.js';

export class StrategySimulator {
  constructor(container) {
    this.container = container;
  }

  async render() {
    this.container.innerHTML = '<div class="loading">Stratejiler hesaplanıyor...</div>';
    try {
      const debts = await api.getDebts();
      if (debts.length === 0) {
        this.container.innerHTML = `
          <div class="section-header"><h2 class="section-title">Strateji Simülatörü</h2></div>
          <div class="card text-center" style="padding:var(--space-2xl)">
            <p style="font-size:2rem;margin-bottom:var(--space-md)">🎉</p>
            <p style="color:var(--text-muted)">Borcunuz yok! Strateji simülatörü borç eklendiğinde aktif olur.</p>
          </div>`;
        return;
      }

      this.container.innerHTML = `
        <div class="section-header"><h2 class="section-title">Strateji Simülatörü</h2></div>
        <div class="card mb-lg fade-in">
          <h3 class="card-title" style="margin-bottom:var(--space-lg)">💰 Ekstra Ödeme Simülasyonu</h3>
          <div class="inline-form mb-md">
            <div class="field" style="flex:2;min-width:150px">
              <label>Aylık Ekstra Ödeme (₺)</label>
              <input class="form-input" type="range" id="extraSlider" min="0" max="20000" step="500" value="2000">
            </div>
            <div class="field" style="flex:1;min-width:80px">
              <p id="extraLabel" style="font-size:var(--font-xl);font-weight:700;color:var(--accent-primary);text-align:center">₺2.000</p>
            </div>
          </div>
        </div>
        <div id="strategyResults">Yükleniyor...</div>
      `;

      this.loadStrategies(2000);

      const slider = document.getElementById('extraSlider');
      const label = document.getElementById('extraLabel');
      slider?.addEventListener('input', () => {
        const val = parseInt(slider.value);
        label.textContent = formatCurrency(val);
        clearTimeout(this._debounce);
        this._debounce = setTimeout(() => this.loadStrategies(val), 300);
      });
    } catch (err) {
      this.container.innerHTML = '<div class="empty-state"><p>Simülatör yüklenemedi</p></div>';
      console.error(err);
    }
  }

  async loadStrategies(extra) {
    const el = document.getElementById('strategyResults');
    if (!el) return;

    try {
      const data = await api.getStrategies(extra);
      if (!data.strategies || data.strategies.length === 0) {
        el.innerHTML = '<p style="color:var(--text-muted)">Yeterli veri yok</p>';
        return;
      }

      const icons = { avalanche: '🏔️', snowball: '⛄', minimum: '🐢', aggressive: '🚀', balanced: '⚖️' };
      const best = [...data.strategies].sort((a, b) => a.totalInterest - b.totalInterest)[0];
      const minStrategy = data.strategies.find(s => s.name === 'minimum');
      const maxInterest = Math.max(...data.strategies.map(s => s.totalInterest), 1);

      el.innerHTML = `
        <div style="display:grid;gap:var(--space-lg)">
          ${data.strategies.map(s => {
            const isBest = s.name === best.name;
            const saving = minStrategy ? minStrategy.totalInterest - s.totalInterest : 0;
            const barW = (s.totalInterest / maxInterest) * 100;
            return `
              <div class="card fade-in" style="${isBest ? 'border:1px solid var(--accent-primary);box-shadow:0 0 20px rgba(0,255,170,0.1)' : ''}">
                ${isBest ? '<div style="position:absolute;top:-10px;right:16px;background:var(--accent-primary);color:var(--bg-primary);padding:2px 12px;border-radius:10px;font-size:var(--font-xs);font-weight:700">EN İYİ</div>' : ''}
                <div class="flex-between mb-md">
                  <h3 style="font-weight:700">${icons[s.name] || '📊'} ${s.label}</h3>
                  <span style="font-size:var(--font-sm);color:var(--text-muted)">${s.totalMonths} ay</span>
                </div>
                <div class="flex-between mb-sm">
                  <span style="font-size:var(--font-sm)">Toplam Faiz</span>
                  <span style="font-weight:600;color:var(--accent-danger)">${formatCurrency(s.totalInterest)}</span>
                </div>
                <div class="progress-bar-container mb-md">
                  <div class="progress-bar" style="width:${barW}%;background:${isBest ? 'var(--accent-primary)' : 'var(--accent-danger)'}"></div>
                </div>
                ${saving > 0 ? `
                  <p style="font-size:var(--font-xs);color:var(--accent-primary)">💰 Minimum ödemeye kıyasla ${formatCurrency(saving)} faiz tasarrufu</p>
                ` : ''}
                ${s.totalMonths >= 600 ? '<p style="font-size:var(--font-xs);color:var(--accent-danger)">⚠️ Ödeme ile anapara karşılanamıyor</p>' : ''}
              </div>
            `;
          }).join('')}
        </div>

        <div class="card mt-lg fade-in">
          <h3 class="card-title">Karşılaştırma Tablosu</h3>
          <div class="table-responsive mt-md"><table class="data-table">
            <thead><tr><th>Strateji</th><th style="text-align:right">Süre</th><th style="text-align:right">Toplam Faiz</th><th style="text-align:right">Faiz Tasarrufu</th></tr></thead>
            <tbody>
              ${data.strategies.map(s => {
                const saving = minStrategy ? minStrategy.totalInterest - s.totalInterest : 0;
                return `<tr ${s.name === best.name ? 'style="background:rgba(0,255,170,0.05)"' : ''}>
                  <td>${icons[s.name] || ''} ${s.label}</td>
                  <td class="text-right">${s.totalMonths >= 600 ? '∞' : s.totalMonths + ' ay'}</td>
                  <td class="text-right amount-expense">${formatCurrency(s.totalInterest)}</td>
                  <td class="text-right amount-income">${saving > 0 ? formatCurrency(saving) : '-'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table></div>
        </div>

        ${data.avgMonthlySurplus > 0 ? `
          <div class="card mt-lg fade-in" style="border-left:3px solid var(--accent-primary)">
            <p style="font-size:var(--font-sm)">💡 Ortalama aylık fazlanız: <strong>${formatCurrency(data.avgMonthlySurplus)}</strong>. Tamamını borca yönlendirirseniz "Agresif" strateji uygulanır.</p>
          </div>
        ` : ''}
      `;
    } catch (err) {
      el.innerHTML = '<p style="color:var(--accent-danger)">Hesaplama hatası</p>';
    }
  }
}
