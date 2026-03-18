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
    this.container.innerHTML = '<div class="loading">Yükleniyor...</div>';
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
        <div class="flex-between flex-col-mobile mb-sm">
          <div>
            <h3 class="card-title">${cm.monthName} — ${cm.bracketLabel} Diliminde</h3>
            <p class="card-subtitle" style="font-size:var(--font-xs)">Kümülatif Matrah: ${formatCurrency(cm.cumulativeMatrah)}</p>
          </div>
          <div style="text-align:right">
            <div class="card-value" style="color:var(--accent-primary)">${formatCurrency(cm.net)}</div>
            <div style="font-size:var(--font-xs);color:var(--text-muted)">Net Maaş</div>
          </div>
        </div>
        <div class="stats-grid">
          <div class="card stat-card">
            <p class="card-title">Brüt</p>
            <p class="card-value">${formatCurrency(cm.gross)}</p>
          </div>
          <div class="card stat-card">
            <p class="card-title">Yıl İçi Vergi</p>
            <p class="card-value" style="color:var(--accent-warning)">${formatCurrency(months.slice(0, currentMonth + 1).reduce((s, m) => s + m.incomeTax, 0))}</p>
          </div>
          <div class="card stat-card">
            <p class="card-title">Gelir Vergisi</p>
            <p class="card-value negative">${formatCurrency(cm.incomeTax)}</p>
          </div>
          <div class="card stat-card">
            <p class="card-title">Efektif Oran</p>
            <p class="card-value" style="color:var(--accent-warning)">%${cm.effectiveTaxRate}</p>
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
        <div class="bar-chart" style="height:200px;margin-top:var(--space-md)">
          ${months.map((m, i) => {
            const maxNet = Math.max(...months.map(x => x.net));
            const minNet = Math.min(...months.map(x => x.net));
            const range = maxNet - minNet || 1;
            const heightPercent = 20 + ((m.net - minNet) / range) * 80;
            const isCurrent = i === currentMonth;
            return `
              <div class="bar-group">
                <div style="font-size:9px;color:var(--text-muted);white-space:nowrap">${formatCurrency(m.net)}</div>
                <div class="bar" style="height:${heightPercent}%;background:${isCurrent ? 'var(--accent-primary)' : 'var(--accent-info)'};opacity:${isCurrent ? 1 : 0.5}" title="${m.monthName}: ${formatCurrency(m.net)} (${m.bracketLabel})"></div>
                <div class="bar-label" style="color:${isCurrent ? 'var(--accent-primary)' : 'var(--text-muted)'}; font-weight:${isCurrent ? '800' : '400'}">${m.monthName.substring(0, 3)}</div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="flex-between flex-col-mobile mt-md" style="font-size:var(--font-sm)">
          <span>Yıllık Toplam Net: <strong style="color:var(--accent-primary)">${formatCurrency(yearly.totalNet)}</strong></span>
          <span>Yıllık Efektif Oran: <strong style="color:var(--accent-warning)">%${yearly.effectiveRate}</strong></span>
        </div>
      </div>

      <!-- Year Summary -->
      <div class="card fade-in mt-md">
        <h3 class="card-title">📋 Yıllık Özet</h3>
        <div class="stats-grid">
          <div class="card stat-card">
            <p class="card-title">Toplam Brüt</p>
            <p class="card-value">${formatCurrency(yearly.totalGross)}</p>
          </div>
          <div class="card stat-card">
            <p class="card-title">Toplam Net</p>
            <p class="card-value positive">${formatCurrency(yearly.totalNet)}</p>
          </div>
          <div class="card stat-card">
            <p class="card-title">Toplam Vergi</p>
            <p class="card-value negative">${formatCurrency(yearly.totalIncomeTax)}</p>
          </div>
          <div class="card stat-card">
            <p class="card-title">Ort. Aylık Net</p>
            <p class="card-value">${formatCurrency(yearly.avgMonthlyNet)}</p>
          </div>
        </div>
      </div>

      <!-- Overtime Simulator -->
      <div class="card fade-in mt-md" style="border-left:4px solid var(--accent-info)">
        <h3 class="card-title">⏰ Ek Mesai Simülatörü</h3>
        <div class="inline-form mb-md">
          <div class="field" style="flex:1;min-width:120px">
            <label>Saat</label>
            <div class="flex gap-sm" style="align-items:center">
              <input type="range" id="otHours" min="1" max="40" value="10" style="flex:1">
              <span id="otHoursLabel" style="font-weight:700;min-width:24px">10</span>
            </div>
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
            <div class="stats-grid mt-sm">
              <div class="card stat-card"><p class="card-title">Brüt Kazanç</p><p class="card-value">${formatCurrency(marginal.grossEarned)}</p></div>
              <div class="card stat-card"><p class="card-title">Net Kalan</p><p class="card-value positive">${formatCurrency(marginal.realNetBenefit)}</p></div>
              <div class="card stat-card"><p class="card-title">Vergiye Giden</p><p class="card-value negative">${formatCurrency(marginal.taxTaken)}</p></div>
              <div class="card stat-card"><p class="card-title">Net Saatlik</p><p class="card-value" style="color:${wColors[worthiness.color]}">${formatCurrency(hourly.netHourly)}/sa</p></div>
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
