// ═══════════════════════════════════════════════════════════════════
// BehavioralPanel — Davranışsal Finans Paneli (Faz 4 UI, B10–B17)
// Harcama pattern, anomali, what changed, stres, maaş erime,
// risk skoru, günlük limit, Monte Carlo
// ═══════════════════════════════════════════════════════════════════

import { api } from '../services/ApiService.js';
import { formatCurrency, formatMonthYear, formatDateShort } from '../utils/formatters.js';

export class BehavioralPanel {
  constructor(container, year, month, helpers) {
    this.container = container;
    this.year = year;
    this.month = month;
    this.helpers = helpers;
  }

  async render() {
    this.container.innerHTML = '<div class="loading">Davranışsal analiz yükleniyor...</div>';
    try {
      this.data = await api.getBehavioralFull(this.year, this.month);
      this.container.innerHTML = this.renderPage();
      this.bindEvents();
    } catch (err) {
      this.container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p class="empty-state-text">Veri yüklenirken hata: ${err.message}</p></div>`;
    }
  }

  renderPage() {
    const { stress, riskScore, dailyLimit, salaryErosion, patterns, anomalies, whatChanged, monteCarlo } = this.data;
    return `
      <div class="section-header">
        <h2 class="section-title">Davranışsal Finans — ${formatMonthYear(this.year, this.month)}</h2>
      </div>

      <!-- Üst: Stres + Risk + Günlük Limit yan yana -->
      <div class="stats-grid">
        ${this.renderStressCard(stress)}
        ${this.renderRiskCard(riskScore)}
        ${this.renderDailyLimitCard(dailyLimit)}
      </div>

      ${this.renderSalaryErosion(salaryErosion)}
      ${this.renderWhatChanged(whatChanged)}
      ${this.renderPatterns(patterns)}
      ${this.renderAnomalies(anomalies)}
      ${this.renderMonteCarlo(monteCarlo)}
    `;
  }

  // ─── B13: Stres Kartı ──────────────────────────────────────
  renderStressCard(s) {
    const colors = { 'Düşük': 'var(--accent-primary)', 'Orta': 'var(--accent-warning)', 'Yüksek': '#ff6b35', 'Kritik': 'var(--accent-danger)' };
    const color = colors[s.label] || 'var(--text-muted)';
    const pct = Math.round(s.stressIndex * 10);

    return `
      <div class="card fade-in" style="border-top:4px solid ${color}">
        <h3 class="card-title mb-md">😰 Finansal Stres</h3>
        <div style="text-align:center;margin-bottom:var(--space-sm)">
          <div style="font-size:var(--font-xxl);font-weight:900;color:${color}">${s.stressIndex}</div>
          <div style="font-size:var(--font-xs);color:var(--text-muted)">/10 — ${s.label}</div>
        </div>
        <div style="background:var(--surface-2);border-radius:6px;height:8px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${color};border-radius:6px;transition:width 0.5s"></div>
        </div>
        <div style="margin-top:var(--space-sm)">
          ${Object.entries(s.components).slice(0, 3).map(([k, v]) => `
            <div style="display:flex;justify-content:space-between;font-size:var(--font-xxs);padding:2px 0;color:var(--text-secondary)">
              <span>${this._componentLabel(k)}</span>
              <span style="font-weight:600">${v.score}/10</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ─── B15: Risk Kartı ────────────────────────────────────────
  renderRiskCard(r) {
    const gradeColors = { 'A': 'var(--accent-primary)', 'B': '#4CAF50', 'C': 'var(--accent-warning)', 'D': '#ff6b35', 'F': 'var(--accent-danger)' };
    const color = gradeColors[r.grade] || 'var(--text-muted)';

    return `
      <div class="card fade-in" style="border-top:4px solid ${color}">
        <h3 class="card-title mb-md">📊 Risk Notu</h3>
        <div style="text-align:center;margin-bottom:var(--space-sm)">
          <div style="font-size:48px;font-weight:900;color:${color}">${r.grade}</div>
          <div style="font-size:var(--font-xs);color:var(--text-muted)">${r.totalScore}/100 — ${r.label}</div>
        </div>
        <div style="margin-top:var(--space-sm)">
          ${r.factors.slice(0, 3).map(f => {
            const fc = f.risk === 'yüksek' ? 'var(--accent-danger)' : f.risk === 'orta' ? 'var(--accent-warning)' : 'var(--accent-primary)';
            return `
              <div style="display:flex;justify-content:space-between;font-size:var(--font-xxs);padding:2px 0">
                <span style="color:var(--text-secondary)">${f.name}</span>
                <span style="color:${fc};font-weight:600">${f.value}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // ─── B16: Günlük Limit Kartı ────────────────────────────────
  renderDailyLimitCard(d) {
    const statusColors = { 'iyi': 'var(--accent-primary)', 'sınırda': 'var(--accent-warning)', 'aşıldı': 'var(--accent-danger)' };
    const color = statusColors[d.status] || 'var(--text-muted)';

    return `
      <div class="card fade-in" style="border-top:4px solid ${color}">
        <h3 class="card-title mb-md">💳 Günlük Limit</h3>
        <div style="text-align:center;margin-bottom:var(--space-sm)">
          <div style="font-size:var(--font-xxl);font-weight:900;color:${color}">${formatCurrency(d.dailyLimit)}</div>
          <div style="font-size:var(--font-xs);color:var(--text-muted)">Bugün harcanan: ${formatCurrency(d.todaySpent)}</div>
        </div>
        <div style="background:var(--surface-2);border-radius:6px;height:8px;overflow:hidden;margin-bottom:var(--space-sm)">
          <div style="width:${Math.min(100, d.dailyLimit > 0 ? Math.round(d.todaySpent / d.dailyLimit * 100) : 0)}%;height:100%;background:${color};border-radius:6px"></div>
        </div>
        <div style="font-size:var(--font-xxs);color:var(--text-secondary)">
          <div>Kalan bütçe: ${formatCurrency(d.remainingBudget)}</div>
          <div>Kalan gün: ${d.daysRemaining}</div>
          <div style="margin-top:4px;color:${color};font-weight:600">${d.message}</div>
        </div>
      </div>
    `;
  }

  // ─── B14: Maaş Erime ───────────────────────────────────────
  renderSalaryErosion(se) {
    if (se.message) {
      return `<div class="card fade-in mt-md"><h3 class="card-title">💸 Maaş Erime Analizi</h3><p style="color:var(--text-muted);margin-top:var(--space-sm)">${se.message}</p></div>`;
    }

    const barWidth = Math.min(100, se.erosionPercent);

    return `
      <div class="card fade-in mt-md">
        <h3 class="card-title mb-md">💸 Maaş Erime Analizi</h3>

        <!-- Erime barı -->
        <div style="margin-bottom:var(--space-md)">
          <div style="display:flex;justify-content:space-between;font-size:var(--font-xs);margin-bottom:4px">
            <span>Harcanan: %${se.erosionPercent}</span>
            <span>Kalan: ${formatCurrency(se.remaining)}</span>
          </div>
          <div style="background:var(--surface-2);border-radius:6px;height:24px;overflow:hidden;position:relative">
            ${se.phases.map((p, i) => {
              const colors = ['var(--accent-danger)', 'var(--accent-warning)', 'var(--accent-primary)'];
              const left = se.phases.slice(0, i).reduce((s, pp) => s + pp.percent, 0);
              return `<div style="position:absolute;left:${left}%;width:${p.percent}%;height:100%;background:${colors[i]}" title="${p.label}: ${formatCurrency(p.amount)}"></div>`;
            }).join('')}
          </div>
          <div style="display:flex;gap:var(--space-md);margin-top:var(--space-xs);font-size:var(--font-xxs)">
            ${se.phases.map((p, i) => {
              const colors = ['var(--accent-danger)', 'var(--accent-warning)', 'var(--accent-primary)'];
              return `<span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:${colors[i]}"></span>${p.label} %${p.percent}</span>`;
            }).join('')}
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${formatCurrency(se.income)}</div>
            <div class="stat-label">Maaş</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${formatCurrency(se.dailyBurn)}</div>
            <div class="stat-label">Günlük erime</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="font-size:var(--font-md);color:${se.zeroDayEstimate <= 30 ? 'var(--accent-danger)' : 'var(--accent-primary)'}">${se.zeroDayEstimate}. gün</div>
            <div class="stat-label">Tahmini bitiş</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${formatCurrency(se.afterFixed)}</div>
            <div class="stat-label">Sabit gider sonrası</div>
          </div>
        </div>
        <p class="card-subtitle mt-sm">${se.zeroDayLabel}</p>

        ${se.timeline.length > 0 ? `
          <details style="margin-top:var(--space-md)">
            <summary style="cursor:pointer;font-size:var(--font-sm);font-weight:600;color:var(--text-secondary)">Erime Zaman Çizelgesi (${se.timeline.length} işlem)</summary>
            <div style="max-height:200px;overflow-y:auto;margin-top:var(--space-sm)">
              ${se.timeline.map(t => `
                <div style="display:flex;justify-content:space-between;padding:var(--space-xs) 0;border-bottom:1px solid var(--border-color);font-size:var(--font-xs)">
                  <span>${t.day}. gün — ${t.description}</span>
                  <span style="display:flex;gap:var(--space-sm)">
                    <span style="color:var(--accent-danger)">-${formatCurrency(t.amount)}</span>
                    <span style="color:var(--text-muted)">(${formatCurrency(t.remaining)} kaldı, %${t.erosionPercent})</span>
                  </span>
                </div>
              `).join('')}
            </div>
          </details>
        ` : ''}
      </div>
    `;
  }

  // ─── B12: What Changed ──────────────────────────────────────
  renderWhatChanged(wc) {
    if (!wc.highlights || wc.highlights.length === 0) {
      return `<div class="card fade-in mt-md"><h3 class="card-title">🔄 Bu Ay Ne Değişti?</h3><p style="color:var(--text-muted);margin-top:var(--space-sm)">Karşılaştırma için önceki ay verisi yok</p></div>`;
    }

    return `
      <div class="card fade-in mt-md">
        <h3 class="card-title mb-md">🔄 Bu Ay Ne Değişti?</h3>

        <div style="display:flex;gap:var(--space-lg);margin-bottom:var(--space-md);flex-wrap:wrap">
          ${wc.highlights.map(h => `
            <div style="font-size:var(--font-sm);padding:var(--space-xs) var(--space-sm);background:var(--surface-2);border-radius:var(--radius-sm);border-left:3px solid var(--accent-warning)">
              ${h}
            </div>
          `).join('')}
        </div>

        <div class="stats-grid" style="margin-bottom:var(--space-md)">
          <div class="stat-card">
            <div class="stat-value" style="font-size:var(--font-sm)">${formatCurrency(wc.previous.income)}</div>
            <div class="stat-label">Önceki gelir</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="font-size:var(--font-sm)">${formatCurrency(wc.current.income)}</div>
            <div class="stat-label">Bu ay gelir</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="font-size:var(--font-sm)">${formatCurrency(wc.previous.expense)}</div>
            <div class="stat-label">Önceki gider</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="font-size:var(--font-sm)">${formatCurrency(wc.current.expense)}</div>
            <div class="stat-label">Bu ay gider</div>
          </div>
        </div>

        ${wc.changes.length > 0 ? `
          <h4 style="font-size:var(--font-sm);color:var(--text-secondary);margin-bottom:var(--space-sm)">Kategori Değişimleri</h4>
          ${wc.changes.slice(0, 8).map(c => {
            const color = c.delta > 0 ? 'var(--accent-danger)' : c.delta < 0 ? 'var(--accent-primary)' : 'var(--text-muted)';
            const icon = c.delta > 0 ? '🔺' : c.delta < 0 ? '🔻' : '➖';
            return `
              <div style="display:flex;justify-content:space-between;padding:var(--space-xs) 0;border-bottom:1px solid var(--border-color);font-size:var(--font-sm)">
                <span>${icon} ${c.category}</span>
                <span style="color:${color};font-weight:600">${c.delta >= 0 ? '+' : ''}${formatCurrency(c.delta)}</span>
              </div>
            `;
          }).join('')}
        ` : ''}
      </div>
    `;
  }

  // ─── B10: Harcama Patternleri ───────────────────────────────
  renderPatterns(p) {
    if (p.message) {
      return `<div class="card fade-in mt-md"><h3 class="card-title">📅 Harcama Örüntüleri</h3><p style="color:var(--text-muted);margin-top:var(--space-sm)">${p.message}</p></div>`;
    }

    const maxDay = Math.max(...p.dayOfWeek.map(d => d.total), 1);
    const maxPeriod = Math.max(...p.periods.map(pd => pd.total), 1);

    return `
      <div class="card fade-in mt-md">
        <h3 class="card-title mb-md">📅 Harcama Örüntüleri</h3>
        <p class="card-subtitle mb-md">${p.insight}</p>

        <!-- Gün bazlı -->
        <h4 style="font-size:var(--font-sm);color:var(--text-secondary);margin-bottom:var(--space-sm)">Haftanın Günleri</h4>
        <div style="display:flex;gap:var(--space-xs);align-items:flex-end;height:120px;margin-bottom:var(--space-lg)">
          ${p.dayOfWeek.map(d => {
            const h = Math.max(4, Math.round(d.total / maxDay * 100));
            const isPeak = d.day === p.peakDay;
            return `
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
                <span style="font-size:var(--font-xxs);color:var(--text-muted)">${d.count}</span>
                <div style="width:100%;height:${h}px;background:${isPeak ? 'var(--accent-warning)' : 'var(--accent-primary)'};border-radius:4px 4px 0 0;transition:height 0.3s"></div>
                <span style="font-size:var(--font-xxs);font-weight:${isPeak ? '700' : '400'}">${d.day.substring(0, 3)}</span>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Dönem bazlı -->
        <h4 style="font-size:var(--font-sm);color:var(--text-secondary);margin-bottom:var(--space-sm)">Ay İçi Dönemler</h4>
        ${p.periods.map(pd => `
          <div style="display:flex;align-items:center;gap:var(--space-sm);padding:var(--space-xs) 0">
            <span style="flex:1;font-size:var(--font-sm)">${pd.label}</span>
            <div style="flex:2;background:var(--surface-2);border-radius:4px;height:10px;overflow:hidden">
              <div style="width:${Math.round(pd.total / maxPeriod * 100)}%;height:100%;background:var(--accent-primary);border-radius:4px"></div>
            </div>
            <span style="width:110px;text-align:right;font-size:var(--font-sm);font-weight:600">${formatCurrency(pd.total)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ─── B11: Anomaliler ────────────────────────────────────────
  renderAnomalies(a) {
    return `
      <div class="card fade-in mt-md" ${a.totalAnomalies > 0 ? 'style="border-left:4px solid var(--accent-warning)"' : ''}>
        <h3 class="card-title mb-md">🔍 Anomali Tespiti</h3>
        <p class="card-subtitle mb-sm">${a.message}</p>
        ${a.anomalies.length > 0 ? `
          <div class="table-responsive"><table class="data-table">
            <thead>
              <tr style="border-bottom:1px solid var(--border-color)">
                <th style="text-align:left;padding:var(--space-xs)">Tarih</th>
                <th style="text-align:left;padding:var(--space-xs)">Kategori</th>
                <th style="text-align:right;padding:var(--space-xs)">Tutar</th>
                <th style="text-align:right;padding:var(--space-xs)">Ort.</th>
                <th style="text-align:right;padding:var(--space-xs)">Sapma</th>
                <th style="text-align:center;padding:var(--space-xs)">Seviye</th>
              </tr>
            </thead>
            <tbody>
              ${a.anomalies.map(an => {
                const sevColors = { kritik: 'var(--accent-danger)', yüksek: '#ff6b35', orta: 'var(--accent-warning)' };
                return `
                  <tr style="border-bottom:1px solid var(--border-color)">
                    <td style="padding:var(--space-xs)">${an.date ? formatDateShort(an.date) : '—'}</td>
                    <td style="padding:var(--space-xs)">${an.category}</td>
                    <td style="text-align:right;padding:var(--space-xs);font-weight:600">${formatCurrency(an.amount)}</td>
                    <td style="text-align:right;padding:var(--space-xs);color:var(--text-muted)">${formatCurrency(an.categoryAvg)}</td>
                    <td style="text-align:right;padding:var(--space-xs);color:var(--accent-danger)">+%${an.deviationPercent}</td>
                    <td style="text-align:center;padding:var(--space-xs)">
                      <span style="font-size:var(--font-xxs);padding:2px 8px;border-radius:10px;background:${sevColors[an.severity]};color:white">${an.severity}</span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table></div>
        ` : ''}
      </div>
    `;
  }

  // ─── B17: Monte Carlo ───────────────────────────────────────
  renderMonteCarlo(mc) {
    if (mc.message) {
      return `<div class="card fade-in mt-md"><h3 class="card-title">🎲 Monte Carlo Stres Testi</h3><p style="color:var(--text-muted);margin-top:var(--space-sm)">${mc.message}</p></div>`;
    }

    const riskColors = { 'Düşük': 'var(--accent-primary)', 'Orta': 'var(--accent-warning)', 'Yüksek': '#ff6b35', 'Kritik': 'var(--accent-danger)' };
    const riskColor = riskColors[mc.riskLabel] || 'var(--text-muted)';

    return `
      <div class="card fade-in mt-md">
        <h3 class="card-title mb-md">🎲 Monte Carlo Stres Testi</h3>
        <p style="font-size:var(--font-xs);color:var(--text-muted);margin-bottom:var(--space-md)">${mc.simulations} simülasyon, ${mc.months} aylık projeksiyon</p>

        <div class="stats-grid" style="margin-bottom:var(--space-md)">
          <div class="stat-card" style="border-left:3px solid var(--accent-danger)">
            <div class="stat-value" style="font-size:var(--font-md);color:var(--accent-danger)">${formatCurrency(mc.percentiles.pessimistic.finalCash)}</div>
            <div class="stat-label">${mc.percentiles.pessimistic.label}</div>
          </div>
          <div class="stat-card" style="border-left:3px solid var(--accent-warning)">
            <div class="stat-value">${formatCurrency(mc.percentiles.median.finalCash)}</div>
            <div class="stat-label">${mc.percentiles.median.label}</div>
          </div>
          <div class="stat-card" style="border-left:3px solid var(--accent-primary)">
            <div class="stat-value" style="font-size:var(--font-md);color:var(--accent-primary)">${formatCurrency(mc.percentiles.optimistic.finalCash)}</div>
            <div class="stat-label">${mc.percentiles.optimistic.label}</div>
          </div>
        </div>

        <div style="display:flex;gap:var(--space-lg);flex-wrap:wrap">
          <div style="flex:1;min-width:200px;padding:var(--space-md);background:var(--surface-2);border-radius:var(--radius-sm);text-align:center">
            <div style="font-size:var(--font-xxl);font-weight:900;color:${riskColor}">%${mc.bankruptcyRisk}</div>
            <div style="font-size:var(--font-xs);color:var(--text-muted)">İflas Riski — ${mc.riskLabel}</div>
          </div>
          <div style="flex:1;min-width:200px;padding:var(--space-md);background:var(--surface-2);border-radius:var(--radius-sm);text-align:center">
            <div style="font-size:var(--font-xxl);font-weight:900;color:var(--accent-primary)">%${mc.debtFreeProbability}</div>
            <div style="font-size:var(--font-xs);color:var(--text-muted)">Borçsuz Kalma Olasılığı</div>
          </div>
        </div>

        <p style="font-size:var(--font-sm);color:var(--text-secondary);margin-top:var(--space-md)">${mc.message}</p>

        <div style="margin-top:var(--space-md)">
          <button class="btn btn-ghost" id="btnRerunMC">🔄 Yeniden Simüle Et</button>
        </div>
      </div>
    `;
  }

  // ─── Events ─────────────────────────────────────────────────
  bindEvents() {
    const btnMC = this.container.querySelector('#btnRerunMC');
    if (btnMC) {
      btnMC.addEventListener('click', async () => {
        btnMC.disabled = true;
        btnMC.textContent = 'Simüle ediliyor...';
        try {
          const mc = await api.getMonteCarlo(6);
          const mcContainer = btnMC.closest('.card');
          mcContainer.outerHTML = this.renderMonteCarlo(mc);
          this.bindEvents(); // rebind
        } catch (err) {
          this.helpers.onToast('Monte Carlo hatası: ' + err.message, 'error');
          btnMC.disabled = false;
          btnMC.textContent = '🔄 Yeniden Simüle Et';
        }
      });
    }
  }

  // ─── Helpers ────────────────────────────────────────────────
  _componentLabel(key) {
    const labels = {
      dti: 'Borç/Gelir',
      debtBurden: 'Borç Yükü',
      expenseRatio: 'Harcama Oranı',
      debtGrowth: 'Borç Büyümesi',
      fixedCosts: 'Sabit Giderler'
    };
    return labels[key] || key;
  }
}
