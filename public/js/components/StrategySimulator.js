// ═══════════════════════════════════════════════════════════════════
// StrategySimulator — 5-mode debt payoff comparison
// ═══════════════════════════════════════════════════════════════════

import { api } from '../services/ApiService.js';
import { formatCurrency } from '../utils/formatters.js';

export class StrategySimulator {
  constructor(container) {
    this.container = container;
    this.strategiesData = null;
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
        <div id="modal-container"></div>
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
      this.strategiesData = data;
      if (!data.strategies || data.strategies.length === 0) {
        el.innerHTML = '<p style="color:var(--text-muted)">Yeterli veri yok</p>';
        return;
      }

      const icons = { avalanche: '🏔️', snowball: '⛄', minimum: '🐢', aggressive: '🚀', balanced: '⚖️' };
      const descriptions = {
        avalanche: 'En yuksek faizli borca oncelik verir. Her ay minimum odemeleri yaptiktan sonra kalan ekstra odemeyi en yuksek faizli borca yonlendirir. Toplam faiz maliyetini en aza indirir.',
        snowball: 'En kucuk bakiyeli borcu once kapatir. Psikolojik motivasyon saglar. Kapanan her borc bir sonrakine aktarilir.',
        minimum: 'Sadece minimum odemeleri yapar. En yavas ve en pahali yontem. Ek odeme yapilmaz.',
        aggressive: `Aylik fazlanizin tamamini (${data.avgMonthlySurplus > 0 ? formatCurrency(data.avgMonthlySurplus) : '?'}) borc odemesine yonlendirir. En hizli kapanma suresi.`,
        balanced: `Aylik fazlanizin %60'ini borc odemesine, %40'ini tasarrufa ayirir. Hem borc azalir hem birikim artar.`
      };
      const best = [...data.strategies].sort((a, b) => a.totalInterest - b.totalInterest)[0];
      const minStrategy = data.strategies.find(s => s.name === 'minimum');
      const maxInterest = Math.max(...data.strategies.map(s => s.totalInterest), 1);

      el.innerHTML = `
        ${data.avgMonthlySurplus > 0 ? `
          <div class="card mb-lg fade-in" style="border-left:3px solid var(--accent-primary)">
            <p style="font-size:var(--font-sm)">Ortalama aylik fazlaniz: <strong>${formatCurrency(data.avgMonthlySurplus)}</strong> — Bu tutar ekstra odeme kapasitenizidir.</p>
          </div>
        ` : ''}
        <div style="display:grid;gap:var(--space-lg)">
          ${data.strategies.map(s => {
            const isBest = s.name === best.name && s.converged;
            const saving = minStrategy && s.converged ? minStrategy.totalInterest - s.totalInterest : 0;
            const barW = s.converged ? (s.totalInterest / maxInterest) * 100 : 100;
            const desc = descriptions[s.name] || '';
            const cannotConverge = !s.converged;
            const displayMonths = cannotConverge ? '∞' : s.totalMonths + ' ay';
            const displayInterest = cannotConverge ? 'Sınırsız ↑' : formatCurrency(s.totalInterest);
            const bgColor = cannotConverge ? 'var(--accent-danger)' : isBest ? 'var(--accent-primary)' : 'var(--accent-danger)';
            return `
              <div class="card fade-in" style="${isBest ? 'border:1px solid var(--accent-primary);box-shadow:0 0 20px rgba(0,255,170,0.1)' : ''}">
                ${isBest ? '<div style="position:absolute;top:-10px;right:16px;background:var(--accent-primary);color:var(--bg-primary);padding:2px 12px;border-radius:10px;font-size:var(--font-xs);font-weight:700">EN IYI</div>' : ''}
                <div class="flex-between mb-sm">
                  <h3 style="font-weight:700">${icons[s.name] || '📊'} ${s.label}</h3>
                  <span style="font-size:var(--font-sm);color:${cannotConverge ? 'var(--accent-danger)' : 'var(--text-muted)'}">${displayMonths}</span>
                </div>
                ${desc ? `<p style="font-size:var(--font-xs);color:var(--text-muted);margin-bottom:var(--space-md);line-height:1.5">${desc}</p>` : ''}
                <div class="flex-between mb-sm">
                  <span style="font-size:var(--font-sm)">Toplam Faiz</span>
                  <span style="font-weight:600;color:var(--accent-danger)">${displayInterest}</span>
                </div>
                <div class="progress-bar-container mb-md">
                  <div class="progress-bar" style="width:${Math.min(100, barW)}%;background:${bgColor}"></div>
                </div>
                ${cannotConverge ? `
                  <p style="font-size:var(--font-xs);color:var(--accent-danger);font-weight:600">⚠️ Ödeme tutarı aylık faizi karşılamıyor. Borç büyümeye devam edecek.</p>
                ` : ''}
                ${!cannotConverge && saving > 0 ? `
                  <p style="font-size:var(--font-xs);color:var(--accent-primary)">💰 Minimum ödemeye kıyasla ${formatCurrency(saving)} faiz tasarrufu</p>
                ` : ''}
                <button class="breakdown-btn" data-strategy="${s.name}" style="width:100%;margin-top:var(--space-md);padding:var(--space-sm) var(--space-md);background:var(--surface-3);border:1px solid var(--surface-2);border-radius:6px;color:var(--accent-primary);cursor:pointer;font-size:var(--font-xs);font-weight:600;transition:all 0.2s">📊 Nasıl Hesaplandı?</button>
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
                const saving = minStrategy && s.converged ? minStrategy.totalInterest - s.totalInterest : 0;
                const displayMonths = !s.converged ? '∞' : s.totalMonths + ' ay';
                const displayFaiz = !s.converged ? 'Sınırsız ↑' : formatCurrency(s.totalInterest);
                return `<tr ${s.name === best.name && s.converged ? 'style="background:rgba(0,255,170,0.05)"' : ''}>
                  <td>${icons[s.name] || ''} ${s.label}</td>
                  <td class="text-right" style="color:${!s.converged ? 'var(--accent-danger)' : ''}">${displayMonths}</td>
                  <td class="text-right" style="color:${!s.converged ? 'var(--accent-danger)' : 'var(--accent-danger)'}">${displayFaiz}</td>
                  <td class="text-right amount-income">${!s.converged ? 'N/A' : saving > 0 ? formatCurrency(saving) : '-'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table></div>
        </div>

        ${data.avgMonthlySurplus > 0 ? `
          <div class="card mt-lg fade-in" style="border-left:3px solid var(--accent-primary)">
            <p style="font-size:var(--font-sm)">Ortalama aylik fazlaniz: <strong>${formatCurrency(data.avgMonthlySurplus)}</strong>. Tamamini borca yonlendirirseniz "Agresif" strateji uygulanir.</p>
          </div>
        ` : ''}
      `;

      this.bindBreakdownButtons();
    } catch (err) {
      el.innerHTML = '<p style="color:var(--accent-danger)">Hesaplama hatası</p>';
    }
  }

  bindBreakdownButtons() {
    document.querySelectorAll('.breakdown-btn').forEach(btn => {
      btn.addEventListener('mouseover', () => {
        btn.style.background = 'var(--surface-2)';
        btn.style.borderColor = 'var(--accent-primary)';
      });
      btn.addEventListener('mouseout', () => {
        btn.style.background = 'var(--surface-3)';
        btn.style.borderColor = 'var(--surface-2)';
      });
      btn.addEventListener('click', () => {
        const strategyName = btn.dataset.strategy;
        this.showStrategyBreakdown(strategyName);
      });
    });
  }

  showStrategyBreakdown(strategyName) {
    if (!this.strategiesData) return;

    const strategy = this.strategiesData.strategies.find(s => s.name === strategyName);
    if (!strategy || !strategy.breakdown) return;

    const bd = strategy.breakdown;
    const icons = { avalanche: '🏔️', snowball: '⛄', minimum: '🐢', aggressive: '🚀', balanced: '⚖️' };

    const debtsList = bd.totalDebts.map(debt => `
      <div style="margin-bottom:var(--space-md);padding:var(--space-md);background:var(--surface-3);border-radius:6px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span>${debt.name}</span>
          <span style="font-weight:600">${formatCurrency(debt.balance)}</span>
        </div>
        <div style="font-size:var(--font-xs);color:var(--text-muted)">
          %${debt.monthlyRate}/ay = ${formatCurrency(debt.monthlyInterest)}/ay
        </div>
      </div>
    `).join('');

    const stepsHtml = bd.calculationSteps.map(step => `
      <div style="padding:var(--space-sm) 0;font-size:var(--font-sm);color:var(--text-muted)">
        ${step}
      </div>
    `).join('');

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
          <h3 style="margin:0;font-size:var(--font-lg)">${icons[strategyName] || '📊'} ${bd.strategy}</h3>
          <button style="background:none;border:none;font-size:24px;cursor:pointer;color:var(--text-muted);padding:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center">×</button>
        </div>
        <div style="padding:var(--space-lg)">
          <div style="margin-bottom:var(--space-lg)">
            <div style="font-weight:600;margin-bottom:var(--space-md)">💳 Borçlarınız:</div>
            ${debtsList}
          </div>

          <div style="margin-bottom:var(--space-lg)">
            <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-sm)">
              <span>Aylık Ödeme:</span>
              <span style="font-weight:600">${formatCurrency(bd.monthlyPayment)} ekstra</span>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span>Aylık Fazlanız:</span>
              <span style="font-weight:600">${formatCurrency(bd.avgMonthlySurplus)}</span>
            </div>
          </div>

          <div style="margin-bottom:var(--space-lg);padding:var(--space-md);background:var(--surface-3);border-radius:6px">
            <div style="font-weight:600;margin-bottom:var(--space-md)">📈 Hesaplama Adımları:</div>
            ${stepsHtml}
          </div>

          <div style="padding:var(--space-md);background:var(--surface-2);border-left:3px solid var(--accent-primary);border-radius:6px">
            <div style="font-weight:600;margin-bottom:var(--space-sm)">✅ Sonuç:</div>
            <div style="font-size:var(--font-sm)">${bd.result}</div>
          </div>
        </div>
      </div>
    `;
    modal.querySelector('button').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    document.getElementById('modal-container')?.appendChild(modal) || document.body.appendChild(modal);
  }
}
