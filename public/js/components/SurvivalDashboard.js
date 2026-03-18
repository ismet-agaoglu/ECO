// ═══════════════════════════════════════════════════════════════════
// SurvivalDashboard — Hayatta Kalma Paneli (Faz 0 UI)
// Combines S1–S12: survival status, debt growth, break-even,
// solvability, consolidation simulator
// ═══════════════════════════════════════════════════════════════════

import { api } from '../services/ApiService.js';
import { formatCurrency } from '../utils/formatters.js';

export class SurvivalDashboard {
  constructor(container, helpers) {
    this.container = container;
    this.helpers = helpers;
    this.mode = 'overview'; // overview | consolidation | crisis
    this.crisisMode = false;
  }

  async render() {
    this.container.innerHTML = '<div class="loading">Yükleniyor...</div>';
    try {
      const [status, sustainability] = await Promise.all([
        api.getSurvivalStatus(),
        api.getSustainability()
      ]);
      this.data = status;
      this.sustainability = sustainability;
      this.container.innerHTML = this.renderPage();
      this.bindEvents();
    } catch (err) {
      this.container.innerHTML = `<div class="empty-state"><p>Veri yüklenirken hata: ${err.message}</p></div>`;
    }
  }

  renderPage() {
    const { survival, debtGrowth, breakEven, solvability } = this.data;
    const statusColors = { sustainable: 'var(--accent-primary)', fragile: 'var(--accent-warning)', unsustainable: 'var(--accent-danger)' };
    const statusColor = statusColors[survival.status] || 'var(--text-muted)';

    return `
      <div class="section-header">
        <h2 class="section-title">Hayatta Kalma Paneli</h2>
        <div style="display:flex;gap:var(--space-xs);flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" id="btnConsolidation">Konsolidasyon</button>
          <button class="btn btn-sm ${this.crisisMode ? 'btn-danger' : 'btn-ghost'}" id="btnCrisis" style="${this.crisisMode ? 'background:var(--accent-danger);color:white' : ''}">
            Kriz ${this.crisisMode ? '(Açık)' : 'Modu'}
          </button>
        </div>
      </div>

      <!-- S1: Survival Status -->
      <div class="card fade-in" style="border-left:4px solid ${statusColor}">
        <div class="flex-between flex-col-mobile mb-md">
          <div>
            <h3 class="card-title">${survival.label}</h3>
            <p class="card-subtitle" style="font-size:var(--font-xs)">Gelir: ${formatCurrency(survival.income)} | Zorunlu Yük: ${formatCurrency(survival.mandatoryLoad)}</p>
          </div>
          <div style="text-align:right">
            <div class="card-value" style="color:${statusColor}">${formatCurrency(survival.freeCash)}</div>
            <div style="font-size:var(--font-xs);color:var(--text-muted)">Serbest Nakit</div>
          </div>
        </div>
        <div class="stat-mini-grid" style="display:grid;grid-template-columns:repeat(${survival.breakdown.length}, 1fr);gap:var(--space-sm)">
          ${survival.breakdown.map(b => `
            <div style="padding:var(--space-sm)">
              <div style="font-size:var(--font-xs);color:var(--text-muted)">${b.name}</div>
              <div style="font-weight:700;color:var(--accent-danger)">${formatCurrency(b.amount)}</div>
              <div style="font-size:var(--font-xxs);color:var(--text-muted)">%${b.percent}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- S9: Solvability -->
      <div class="card fade-in mt-md" style="border-left:4px solid ${this._solvabilityColor(solvability.verdict)}">
        <h3 style="font-weight:700">📋 ${solvability.label}</h3>
        <div style="margin:var(--space-sm) 0">
          ${solvability.actions.map(a => `
            <div style="padding:var(--space-xs) 0;font-size:var(--font-sm);color:var(--text-secondary)">→ ${a}</div>
          `).join('')}
        </div>
        ${solvability.requiredIncrease > 0 ? `
          <div class="card" style="background:rgba(255,71,87,0.1);margin-top:var(--space-sm)">
            <strong style="color:var(--accent-danger)">⚠️ En az ${formatCurrency(solvability.requiredIncrease)}/ay ek gelir gerekli</strong>
          </div>
        ` : ''}
      </div>

      <!-- S2: Debt Growth Test -->
      <div class="card fade-in mt-md">
        <h3 class="card-title">📊 Borç Büyüme Testi</h3>
        <div class="recent-list">
          ${debtGrowth.map(d => {
            const icon = d.status === 'shrinking' ? '📉' : d.status === 'growing' ? '📈' : '➡️';
            const color = d.status === 'shrinking' ? 'var(--accent-primary)' : d.status === 'growing' ? 'var(--accent-danger)' : 'var(--accent-warning)';
            return `
              <div class="recent-item">
                <div class="recent-info">
                  <div class="recent-desc">${icon} ${d.name}</div>
                  <div class="recent-date">${d.label} | Min: ${formatCurrency(d.minPayment)} | Faiz: ${formatCurrency(d.monthlyInterest)}</div>
                </div>
                <div class="recent-amount" style="color:${color}">${d.netChange > 0 ? '-' : '+'}${formatCurrency(Math.abs(d.netChange))}/ay</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- S3: Break-Even + S6 -->
      ${!breakEven.isSustainable ? `
        <div class="card fade-in mt-md" style="border-left:4px solid var(--accent-danger)">
          <h3 class="card-title">🎯 Break-Even Analizi</h3>
          <p style="color:var(--text-secondary);font-size:var(--font-sm)">${breakEven.message}</p>
          <div class="stats-grid mt-sm">
            <div class="card stat-card">
              <p class="card-title">Aylık Açık</p>
              <p class="card-value negative">${formatCurrency(breakEven.shortfall)}</p>
            </div>
            <div class="card stat-card">
              <p class="card-title">Max Kesilebilir</p>
              <p class="card-value" style="color:var(--accent-warning)">${formatCurrency(breakEven.maxCuttable)}</p>
            </div>
            ${breakEven.requiredIncrease ? `
              <div class="card stat-card">
                <p class="card-title">Gereken Ek Gelir</p>
                <p class="card-value negative">${formatCurrency(breakEven.requiredIncrease)}</p>
              </div>
            ` : ''}
          </div>
        </div>
      ` : `
        <div class="card fade-in mt-md" style="border-left:4px solid var(--accent-primary)">
          <h3 class="card-title">✅ Sistem Sürdürülebilir</h3>
          <p style="color:var(--text-secondary)">Zorunlu ödemeler sonrası ${formatCurrency(breakEven.surplusAfterMandatory)} kalan.</p>
        </div>
      `}

      <!-- S8: Sustainability -->
      <div class="card fade-in mt-md">
        <h3 class="card-title">🧠 Zaman Kazanma Stratejileri</h3>
        ${this.sustainability.timeBuying.map(s => `
          <div class="card mb-sm" style="background:var(--surface-2)">
            <div class="flex-between">
              <strong>${s.name}</strong>
              <span style="color:var(--accent-warning)">${s.estimatedMonths === Infinity ? '∞' : s.estimatedMonths + ' ay'}</span>
            </div>
            <p style="font-size:var(--font-xs);color:var(--text-secondary);margin:var(--space-xs) 0">${s.description}</p>
            ${s.breathingRoom != null ? `<p style="font-size:var(--font-xs)">Nefes payı: <strong style="color:${s.breathingRoom >= 0 ? 'var(--accent-primary)' : 'var(--accent-danger)'}">${formatCurrency(s.breathingRoom)}/ay</strong></p>` : ''}
            <p style="font-size:var(--font-xxs);color:var(--accent-warning)">⚠️ ${s.risk}</p>
          </div>
        `).join('')}
      </div>
    `;
  }

  bindEvents() {
    document.getElementById('btnConsolidation')?.addEventListener('click', () => this.showConsolidation());
    document.getElementById('btnCrisis')?.addEventListener('click', () => {
      this.crisisMode = !this.crisisMode;
      this.render();
      if (this.crisisMode) this.helpers?.onToast('Kriz modu açıldı — yüksek riskli likidite manevraları görünür', 'warning');
    });
  }

  async showConsolidation() {
    this.helpers?.openModal('🏦 Konsolidasyon Simülatörü', '<div class="text-center">Yükleniyor...</div>');
    try {
      const sim = await api.postConsolidationSim({ newInterestRate: 3, terms: [12, 24, 36], costs: 2000 });
      const html = `
        <div style="margin-bottom:var(--space-md)">
          <p><strong>Birleştirilen borç:</strong> ${formatCurrency(sim.consolidatedDebt)} (${sim.debtCount} borç)</p>
          <p><strong>Mevcut aylık ödeme:</strong> ${formatCurrency(sim.currentMonthlyPayment)}</p>
          <p><strong>Ağırlıklı mevcut faiz:</strong> %${sim.weightedCurrentRate}</p>
          <p><strong>Yeni faiz:</strong> %${sim.newRate} | <strong>Fark:</strong> %${sim.rateAdvantage}</p>
        </div>
        <div class="table-responsive"><table class="data-table">
          <thead>
            <tr>
              <th>Vade</th>
              <th style="text-align:right">Aylık</th>
              <th style="text-align:right">Toplam Faiz</th>
              <th style="text-align:right">Aylık Rahatlama</th>
              <th>Karar</th>
            </tr>
          </thead>
          <tbody>
            ${sim.scenarios.map(s => {
              const recColors = { STRONGLY_RECOMMENDED: 'var(--accent-primary)', SURVIVAL_MODE_OPTION: 'var(--accent-warning)', AGGRESSIVE_PAYOFF: 'var(--accent-info)', REJECT: 'var(--accent-danger)' };
              return `
                <tr>
                  <td>${s.term} ay</td>
                  <td class="text-right">${formatCurrency(s.monthlyPayment)}</td>
                  <td class="text-right amount-expense">${formatCurrency(s.totalInterest)}</td>
                  <td class="text-right" style="color:${s.monthlyRelief > 0 ? 'var(--accent-primary)' : 'var(--accent-danger)'}">
                    ${s.monthlyRelief > 0 ? '+' : ''}${formatCurrency(s.monthlyRelief)}
                  </td>
                  <td style="color:${recColors[s.recommendation]};font-weight:700;font-size:var(--font-xs)">${s.label}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table></div>
        <div class="mt-md" style="font-size:var(--font-xs);color:var(--text-muted)">
          ${sim.scenarios[0]?.warnings?.map(w => `<p style="color:${w.type === 'REJECT' ? 'var(--accent-danger)' : w.type === 'WARNING' ? 'var(--accent-warning)' : 'var(--text-muted)'}">⚠️ ${w.message}</p>`).join('') || ''}
        </div>
      `;
      document.getElementById('modalBody').innerHTML = html;
    } catch (err) {
      document.getElementById('modalBody').innerHTML = `<p style="color:var(--accent-danger)">Hata: ${err.message}</p>`;
    }
  }

  _solvabilityColor(verdict) {
    const colors = { optimizable: 'var(--accent-primary)', solvable_with_cuts: 'var(--accent-warning)', needs_extra_income: 'var(--accent-danger)', needs_restructuring: 'var(--accent-danger)' };
    return colors[verdict] || 'var(--text-muted)';
  }
}
