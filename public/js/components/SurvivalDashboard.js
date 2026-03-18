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
    this.container.innerHTML = '<div class="text-center mt-lg" style="color:var(--text-muted)">Yükleniyor...</div>';
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
      <div class="section-title" style="display:flex;align-items:center;justify-content:space-between">
        <h2>⚡ Hayatta Kalma Paneli</h2>
        <div style="display:flex;gap:var(--space-sm)">
          <button class="btn btn-ghost" id="btnConsolidation">🏦 Konsolidasyon</button>
          <button class="btn ${this.crisisMode ? 'btn-danger' : 'btn-ghost'}" id="btnCrisis" style="${this.crisisMode ? 'background:var(--accent-danger);color:white' : ''}">
            🚨 Kriz Modu ${this.crisisMode ? '(Açık)' : ''}
          </button>
        </div>
      </div>

      <!-- S1: Survival Status -->
      <div class="card fade-in" style="border-left:4px solid ${statusColor}">
        <div class="flex-between" style="margin-bottom:var(--space-md)">
          <div>
            <h3 style="font-size:var(--font-lg);font-weight:800">${survival.label}</h3>
            <p style="color:var(--text-secondary);font-size:var(--font-xs)">Gelir: ${formatCurrency(survival.income)} | Zorunlu Yük: ${formatCurrency(survival.mandatoryLoad)}</p>
          </div>
          <div style="text-align:right">
            <div style="font-size:var(--font-xxl);font-weight:900;color:${statusColor}">${formatCurrency(survival.freeCash)}</div>
            <div style="font-size:var(--font-xs);color:var(--text-muted)">Serbest Nakit</div>
          </div>
        </div>
        <div class="stats-grid" style="margin:0">
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
          <div class="stats-grid mt-sm" style="margin-bottom:0">
            <div style="text-align:center;padding:var(--space-sm)">
              <div style="font-size:var(--font-xs);color:var(--text-muted)">Aylık Açık</div>
              <div style="font-size:var(--font-lg);font-weight:800;color:var(--accent-danger)">${formatCurrency(breakEven.shortfall)}</div>
            </div>
            <div style="text-align:center;padding:var(--space-sm)">
              <div style="font-size:var(--font-xs);color:var(--text-muted)">Max Kesilebilir</div>
              <div style="font-size:var(--font-lg);font-weight:800;color:var(--accent-warning)">${formatCurrency(breakEven.maxCuttable)}</div>
            </div>
            ${breakEven.requiredIncrease ? `
              <div style="text-align:center;padding:var(--space-sm)">
                <div style="font-size:var(--font-xs);color:var(--text-muted)">Gereken Ek Gelir</div>
                <div style="font-size:var(--font-lg);font-weight:800;color:var(--accent-danger)">${formatCurrency(breakEven.requiredIncrease)}</div>
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
      const sim = await api.postConsolidationSim({ newInterestRate: 36, terms: [12, 24, 36], costs: 2000 });
      const html = `
        <div style="margin-bottom:var(--space-md)">
          <p><strong>Birleştirilen borç:</strong> ${formatCurrency(sim.consolidatedDebt)} (${sim.debtCount} borç)</p>
          <p><strong>Mevcut aylık ödeme:</strong> ${formatCurrency(sim.currentMonthlyPayment)}</p>
          <p><strong>Ağırlıklı mevcut faiz:</strong> %${sim.weightedCurrentRate}</p>
          <p><strong>Yeni faiz:</strong> %${sim.newRate} | <strong>Fark:</strong> %${sim.rateAdvantage}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:var(--font-sm)">
          <thead>
            <tr style="border-bottom:1px solid var(--border)">
              <th style="text-align:left;padding:var(--space-xs)">Vade</th>
              <th style="text-align:right;padding:var(--space-xs)">Aylık</th>
              <th style="text-align:right;padding:var(--space-xs)">Toplam Faiz</th>
              <th style="text-align:right;padding:var(--space-xs)">Aylık Rahatlama</th>
              <th style="text-align:left;padding:var(--space-xs)">Karar</th>
            </tr>
          </thead>
          <tbody>
            ${sim.scenarios.map(s => {
              const recColors = { STRONGLY_RECOMMENDED: 'var(--accent-primary)', SURVIVAL_MODE_OPTION: 'var(--accent-warning)', AGGRESSIVE_PAYOFF: 'var(--accent-info)', REJECT: 'var(--accent-danger)' };
              return `
                <tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:var(--space-xs)">${s.term} ay</td>
                  <td style="text-align:right;padding:var(--space-xs)">${formatCurrency(s.monthlyPayment)}</td>
                  <td style="text-align:right;padding:var(--space-xs);color:var(--accent-danger)">${formatCurrency(s.totalInterest)}</td>
                  <td style="text-align:right;padding:var(--space-xs);color:${s.monthlyRelief > 0 ? 'var(--accent-primary)' : 'var(--accent-danger)'}">
                    ${s.monthlyRelief > 0 ? '+' : ''}${formatCurrency(s.monthlyRelief)}
                  </td>
                  <td style="padding:var(--space-xs);color:${recColors[s.recommendation]};font-weight:700;font-size:var(--font-xs)">${s.label}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
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
