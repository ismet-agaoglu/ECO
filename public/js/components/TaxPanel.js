// ═══════════════════════════════════════════════════════════════════
// TaxPanel — Vergi & Maaş & Ek Mesai Paneli (Faz 1 UI, T8)
// Vergi dilimi gauge, kümülatif matrah, maaş projeksiyonu,
// ek mesai simülatörü
// ═══════════════════════════════════════════════════════════════════

import { api } from '../services/ApiService.js';
import { formatCurrency } from '../utils/formatters.js';

export class TaxPanel {
  constructor(container, helpers) {
    this.container = container;
    this.helpers = helpers;
    this.gross = 90000;
    this.overtimeHourlyGross = 750;
  }

  async render() {
    this.container.innerHTML = '<div class="text-center mt-lg" style="color:var(--text-muted)">Yükleniyor...</div>';
    try {
      const [yearData, brackets, marginal] = await Promise.all([
        api.postTaxSimulation({ monthlyGross: this.gross }),
        api.getTaxBracketForecast(this.gross),
        api.getTaxMarginalRate(this.gross)
      ]);
      this.yearData = yearData;
      this.brackets = brackets;
      this.marginal = marginal;
      this.container.innerHTML = this.renderPage();
      this.bindEvents();
    } catch (err) {
      this.container.innerHTML = `<div class="empty-state"><p>Hata: ${err.message}</p></div>`;
    }
  }

  renderPage() {
    const { yearly, months } = this.yearData;
    const currentMonth = new Date().getMonth();
    const cm = months[currentMonth] || months[0];

    return `
      <div class="section-title"><h2>🧾 Vergi & Maaş Paneli</h2></div>

      <!-- Current Month Status -->
      <div class="card fade-in" style="border-left:4px solid var(--accent-info)">
        <div class="flex-between" style="margin-bottom:var(--space-sm)">
          <div>
            <h3 style="font-weight:800">${cm.monthName} — ${cm.bracketLabel} Diliminde</h3>
            <p style="font-size:var(--font-xs);color:var(--text-muted)">Kümülatif Matrah: ${formatCurrency(cm.cumulativeMatrah)}</p>
          </div>
          <div style="text-align:right">
            <div style="font-size:var(--font-xxl);font-weight:900;color:var(--accent-primary)">${formatCurrency(cm.net)}</div>
            <div style="font-size:var(--font-xs);color:var(--text-muted)">Net Maaş</div>
          </div>
        </div>
        <div class="stats-grid" style="margin:0">
          <div style="padding:var(--space-sm);text-align:center">
            <div style="font-size:var(--font-xs);color:var(--text-muted)">Brüt</div>
            <div style="font-weight:700">${formatCurrency(cm.gross)}</div>
          </div>
          <div style="padding:var(--space-sm);text-align:center">
            <div style="font-size:var(--font-xs);color:var(--text-muted)">Yıl İçi Vergi</div>
            <div style="font-weight:700;color:var(--accent-warning)">${formatCurrency(months.slice(0, currentMonth + 1).reduce((s, m) => s + m.incomeTax, 0))}</div>
          </div>
          <div style="padding:var(--space-sm);text-align:center">
            <div style="font-size:var(--font-xs);color:var(--text-muted)">Gelir Vergisi</div>
            <div style="font-weight:700;color:var(--accent-danger)">${formatCurrency(cm.incomeTax)}</div>
          </div>
          <div style="padding:var(--space-sm);text-align:center">
            <div style="font-size:var(--font-xs);color:var(--text-muted)">Efektif Oran</div>
            <div style="font-weight:700;color:var(--accent-warning)">%${cm.effectiveTaxRate}</div>
          </div>
        </div>
      </div>

      <!-- Marginal Rate -->
      ${this.marginal ? `
        <div class="card fade-in mt-md" style="border-left:4px solid var(--accent-warning)">
          <h3 class="card-title">📊 Marjinal Vergi</h3>
          <p style="color:var(--text-secondary);font-size:var(--font-sm)">${this.marginal.message}</p>
          <p style="font-size:var(--font-sm);margin-top:var(--space-xs)">➤ Ek 1.000 ₺ kazanırsan net kalan: <strong style="color:var(--accent-primary)">${formatCurrency(this.marginal.perExtra1000.netAfterTax)}</strong></p>
        </div>
      ` : ''}

      <!-- Bracket Transitions -->
      ${this.brackets.transitions.length > 0 ? `
        <div class="card fade-in mt-md">
          <h3 class="card-title">⚠️ Dilim Geçişleri</h3>
          ${this.brackets.transitions.map(t => `
            <div class="card mb-sm" style="background:rgba(255,165,0,0.1)">
              <strong>${t.monthName}</strong>: ${t.fromRate} → ${t.toRate}
              ${t.netDrop > 0 ? `<span style="color:var(--accent-danger);margin-left:var(--space-sm)">Maaş ${formatCurrency(t.netDrop)} düşecek</span>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Net Salary Projection (12 months) -->
      <div class="card fade-in mt-md">
        <h3 class="card-title">📈 Yıllık Net Maaş Projeksiyonu</h3>
        <div style="display:flex;gap:2px;align-items:flex-end;height:200px;margin-top:var(--space-md)">
          ${months.map((m, i) => {
            const maxNet = Math.max(...months.map(x => x.net));
            const minNet = Math.min(...months.map(x => x.net));
            const range = maxNet - minNet || 1;
            const height = 30 + ((m.net - minNet) / range) * 150;
            const isCurrent = i === currentMonth;
            return `
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
                <div style="font-size:9px;color:var(--text-muted);transform:rotate(-45deg);white-space:nowrap">${formatCurrency(m.net)}</div>
                <div style="width:100%;height:${height}px;background:${isCurrent ? 'var(--accent-primary)' : 'var(--accent-info)'};opacity:${isCurrent ? 1 : 0.5};border-radius:4px 4px 0 0;transition:opacity .2s" title="${m.monthName}: ${formatCurrency(m.net)} (${m.bracketLabel})"></div>
                <div style="font-size:10px;color:${isCurrent ? 'var(--accent-primary)' : 'var(--text-muted)'}; font-weight:${isCurrent ? '800' : '400'}">${m.monthName.substring(0, 3)}</div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="flex-between mt-md" style="font-size:var(--font-sm)">
          <span>Yıllık Toplam Net: <strong style="color:var(--accent-primary)">${formatCurrency(yearly.totalNet)}</strong></span>
          <span>Yıllık Efektif Oran: <strong style="color:var(--accent-warning)">%${yearly.effectiveRate}</strong></span>
        </div>
      </div>

      <!-- Year Summary -->
      <div class="card fade-in mt-md">
        <h3 class="card-title">📋 Yıllık Özet</h3>
        <div class="stats-grid" style="margin:0">
          <div style="text-align:center;padding:var(--space-sm)">
            <div style="font-size:var(--font-xs);color:var(--text-muted)">Toplam Brüt</div>
            <div style="font-size:var(--font-lg);font-weight:800">${formatCurrency(yearly.totalGross)}</div>
          </div>
          <div style="text-align:center;padding:var(--space-sm)">
            <div style="font-size:var(--font-xs);color:var(--text-muted)">Toplam Net</div>
            <div style="font-size:var(--font-lg);font-weight:800;color:var(--accent-primary)">${formatCurrency(yearly.totalNet)}</div>
          </div>
          <div style="text-align:center;padding:var(--space-sm)">
            <div style="font-size:var(--font-xs);color:var(--text-muted)">Toplam Vergi</div>
            <div style="font-size:var(--font-lg);font-weight:800;color:var(--accent-danger)">${formatCurrency(yearly.totalIncomeTax)}</div>
          </div>
          <div style="text-align:center;padding:var(--space-sm)">
            <div style="font-size:var(--font-xs);color:var(--text-muted)">Ort. Aylık Net</div>
            <div style="font-size:var(--font-lg);font-weight:800">${formatCurrency(yearly.avgMonthlyNet)}</div>
          </div>
        </div>
      </div>

      <!-- Overtime Simulator -->
      <div class="card fade-in mt-md" style="border-left:4px solid var(--accent-info)">
        <h3 class="card-title">⏰ Ek Mesai Simülatörü</h3>
        <div style="display:flex;gap:var(--space-md);flex-wrap:wrap;margin-bottom:var(--space-md);align-items:center">
          <div>
            <label style="font-size:var(--font-xs);color:var(--text-muted)">Saat</label>
            <input type="range" id="otHours" min="1" max="40" value="10" style="width:150px">
            <span id="otHoursLabel" style="font-weight:700;margin-left:var(--space-xs)">10</span>
          </div>
          <button class="btn btn-primary" id="btnSimOvertime">Hesapla</button>
        </div>
        <div id="overtimeResult" style="font-size:var(--font-sm);color:var(--text-secondary)">
          Slider'ı ayarlayıp "Hesapla" butonuna tıklayın.
        </div>
      </div>
    `;
  }

  bindEvents() {
    const slider = document.getElementById('otHours');
    const label = document.getElementById('otHoursLabel');
    slider?.addEventListener('input', () => { label.textContent = slider.value; });

    document.getElementById('btnSimOvertime')?.addEventListener('click', async () => {
      const hours = parseInt(document.getElementById('otHours')?.value || 10);
      const result = document.getElementById('overtimeResult');
      result.innerHTML = 'Hesaplanıyor...';

      try {
        const sim = await api.postOvertimeSim({
          monthlyGross: this.gross,
          hourlyOvertimeGross: this.overtimeHourlyGross,
          hours
        });

        const { marginal, hourly, worthiness } = sim;
        const wColors = { green: 'var(--accent-primary)', yellow: 'var(--accent-warning)', orange: 'var(--accent-danger)', red: 'var(--accent-danger)' };

        result.innerHTML = `
          <div class="card" style="background:var(--surface-2);border-left:4px solid ${wColors[worthiness.color]}">
            <div class="flex-between">
              <strong style="font-size:var(--font-md)">${hours} Saat Ek Mesai</strong>
              <span style="color:${wColors[worthiness.color]};font-weight:800;font-size:var(--font-md)">${worthiness.label}</span>
            </div>
            <div class="stats-grid mt-sm" style="margin-bottom:0">
              <div style="text-align:center">
                <div style="font-size:var(--font-xs);color:var(--text-muted)">Brüt Kazanç</div>
                <div style="font-weight:700">${formatCurrency(marginal.grossEarned)}</div>
              </div>
              <div style="text-align:center">
                <div style="font-size:var(--font-xs);color:var(--text-muted)">Net Kalan</div>
                <div style="font-weight:700;color:var(--accent-primary)">${formatCurrency(marginal.realNetBenefit)}</div>
              </div>
              <div style="text-align:center">
                <div style="font-size:var(--font-xs);color:var(--text-muted)">Vergiye Giden</div>
                <div style="font-weight:700;color:var(--accent-danger)">${formatCurrency(marginal.taxTaken)}</div>
              </div>
              <div style="text-align:center">
                <div style="font-size:var(--font-xs);color:var(--text-muted)">Net Saatlik</div>
                <div style="font-weight:700;color:${wColors[worthiness.color]}">${formatCurrency(hourly.netHourly)}/sa</div>
              </div>
            </div>
            <p style="font-size:var(--font-xs);color:var(--text-muted);margin-top:var(--space-sm)">
              Brüt: ${hourly.breakdown.brütSaatlik}/sa → Net: ${hourly.breakdown.netSaatlik}/sa | Kazancın %${marginal.effectiveRetention}'${marginal.effectiveRetention >= 50 ? 'i' : 'u'} kalıyor
            </p>
          </div>
        `;
      } catch (err) {
        result.innerHTML = `<p style="color:var(--accent-danger)">Hata: ${err.message}</p>`;
      }
    });
  }
}
