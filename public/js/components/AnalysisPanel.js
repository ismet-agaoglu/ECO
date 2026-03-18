// ═══════════════════════════════════════════════════════════════════
// AnalysisPanel — Akıllı Analiz Paneli (Faz 3 UI, B1–B9)
// Snapshot, net worth, likidite, forecast, sapma, tasarruf potansiyeli
// ═══════════════════════════════════════════════════════════════════

import { api } from '../services/ApiService.js';
import { formatCurrency, formatMonthYear, MONTH_NAMES } from '../utils/formatters.js';

export class AnalysisPanel {
  constructor(container, year, month, helpers) {
    this.container = container;
    this.year = year;
    this.month = month;
    this.helpers = helpers;
  }

  async render() {
    this.container.innerHTML = '<div class="loading">Akıllı analiz yükleniyor...</div>';
    try {
      this.data = await api.getAnalysisFull(this.year, this.month);
      this.container.innerHTML = this.renderPage();
      this.bindEvents();
    } catch (err) {
      this.container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p class="empty-state-text">Veri yüklenirken hata: ${err.message}</p></div>`;
    }
  }

  renderPage() {
    const { snapshot, netWorth, liquidityRisk, forecast, categoryForecast, deviation, endOfMonth, savingsPotential } = this.data;
    return `
      <div class="section-header">
        <h2 class="section-title">Akıllı Analiz — ${formatMonthYear(this.year, this.month)}</h2>
      </div>

      ${this.renderSnapshot(snapshot)}
      ${this.renderEndOfMonth(endOfMonth)}
      ${this.renderNetWorth(netWorth)}
      ${this.renderLiquidityRisk(liquidityRisk)}
      ${this.renderDeviation(deviation)}
      ${this.renderForecast(forecast)}
      ${this.renderCategoryForecast(categoryForecast)}
      ${this.renderSavingsPotential(savingsPotential)}
      ${this.renderOptimizationSection()}
    `;
  }

  // ─── B1: Aylık Snapshot ─────────────────────────────────────
  renderSnapshot(s) {
    const netColor = s.net >= 0 ? 'var(--accent-primary)' : 'var(--accent-danger)';
    const riskColors = { 'Düşük': 'var(--accent-primary)', 'Orta': 'var(--accent-warning)', 'Yüksek': '#ff6b35', 'Kritik': 'var(--accent-danger)' };
    const riskColor = riskColors[s.riskLabel] || 'var(--text-muted)';

    return `
      <div class="card fade-in">
        <h3 class="card-title mb-md">📊 Aylık Özet</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value" style="color:var(--accent-primary)">${formatCurrency(s.income)}</div>
            <div class="stat-label">Gelir</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color:var(--accent-danger)">${formatCurrency(s.expense)}</div>
            <div class="stat-label">Gider</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color:${netColor}">${formatCurrency(s.net)}</div>
            <div class="stat-label">Net</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color:${riskColor}">${s.riskScore}/10</div>
            <div class="stat-label">Risk: ${s.riskLabel}</div>
          </div>
        </div>
        ${s.categoryBreakdown.length > 0 ? `
          <div style="margin-top:var(--space-md)">
            <h4 style="font-size:var(--font-sm);color:var(--text-secondary);margin-bottom:var(--space-sm)">Kategori Dağılımı</h4>
            ${s.categoryBreakdown.slice(0, 8).map(c => `
              <div style="display:flex;align-items:center;gap:var(--space-sm);padding:var(--space-xs) 0">
                <span style="flex:1;font-size:var(--font-sm)">${c.category}</span>
                <div style="flex:2;background:var(--surface-2);border-radius:4px;height:8px;overflow:hidden">
                  <div style="width:${Math.min(c.percent, 100)}%;height:100%;background:var(--accent-primary);border-radius:4px"></div>
                </div>
                <span style="width:100px;text-align:right;font-size:var(--font-sm);font-weight:600">${formatCurrency(c.amount)}</span>
                <span style="width:40px;text-align:right;font-size:var(--font-xs);color:var(--text-muted)">%${c.percent}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  // ─── B8: Dönem Sonu Tahmin ──────────────────────────────────
  renderEndOfMonth(e) {
    const projColor = e.projectedNet >= 0 ? 'var(--accent-primary)' : 'var(--accent-danger)';
    const progress = e.daysRemaining + e.daysPassed > 0
      ? Math.round(e.daysPassed / (e.daysPassed + e.daysRemaining) * 100) : 0;

    return `
      <div class="card fade-in mt-md" style="border-left:4px solid var(--accent-warning)">
        <h3 class="card-title mb-md">⏳ Ay Sonu Tahmini</h3>
        <div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:var(--space-md)">
          <div style="flex:1;background:var(--surface-2);border-radius:6px;height:10px;overflow:hidden">
            <div style="width:${progress}%;height:100%;background:var(--accent-primary);border-radius:6px;transition:width 0.5s"></div>
          </div>
          <span style="font-size:var(--font-xs);color:var(--text-muted)">${e.daysPassed} / ${e.daysPassed + e.daysRemaining} gün</span>
        </div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${formatCurrency(e.spentSoFar)}</div>
            <div class="stat-label">Şu ana kadar harcanan</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${formatCurrency(e.dailyAvgSpend)}</div>
            <div class="stat-label">Günlük ortalama</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${formatCurrency(e.projectedExpense)}</div>
            <div class="stat-label">Tahmini ay sonu gider</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="font-size:var(--font-md);color:${projColor}">${formatCurrency(e.projectedNet)}</div>
            <div class="stat-label">Tahmini net</div>
          </div>
        </div>
        <p class="card-subtitle mt-sm">${e.message}</p>
      </div>
    `;
  }

  // ─── B2: Net Değer ──────────────────────────────────────────
  renderNetWorth(nw) {
    const nwColor = nw.status === 'positive' ? 'var(--accent-primary)' : nw.status === 'negative' ? 'var(--accent-danger)' : 'var(--text-muted)';

    return `
      <div class="card fade-in mt-md">
        <h3 class="card-title mb-md">💰 Net Değer</h3>
        <div style="display:flex;align-items:center;justify-content:center;margin-bottom:var(--space-md)">
          <div style="text-align:center">
            <div style="font-size:var(--font-xxl);font-weight:900;color:${nwColor}">${formatCurrency(nw.netWorth)}</div>
            <div style="font-size:var(--font-xs);color:var(--text-muted)">${nw.label}</div>
          </div>
        </div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value" style="color:var(--accent-primary);font-size:var(--font-md)">${formatCurrency(nw.assets.total)}</div>
            <div class="stat-label">Toplam Varlık</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color:var(--accent-danger);font-size:var(--font-md)">${formatCurrency(nw.liabilities)}</div>
            <div class="stat-label">Toplam Borç</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${nw.debtToAssetRatio === Infinity ? '∞' : nw.debtToAssetRatio}</div>
            <div class="stat-label">Borç/Varlık Oranı</div>
          </div>
        </div>
        ${nw.assets.cash || nw.assets.bank || nw.assets.gold ? `
          <div style="margin-top:var(--space-md);display:flex;gap:var(--space-md);flex-wrap:wrap">
            ${nw.assets.cash ? `<span style="font-size:var(--font-sm);color:var(--text-secondary)">Nakit: ${formatCurrency(nw.assets.cash)}</span>` : ''}
            ${nw.assets.bank ? `<span style="font-size:var(--font-sm);color:var(--text-secondary)">Banka: ${formatCurrency(nw.assets.bank)}</span>` : ''}
            ${nw.assets.gold ? `<span style="font-size:var(--font-sm);color:var(--text-secondary)">Altın: ${formatCurrency(nw.assets.gold)}</span>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  // ─── B3: Likidite Risk ──────────────────────────────────────
  renderLiquidityRisk(lr) {
    const statusColor = lr.canSurvive ? 'var(--accent-primary)' : 'var(--accent-danger)';
    const icon = lr.canSurvive ? '✅' : '⚠️';

    return `
      <div class="card fade-in mt-md" style="border-left:4px solid ${statusColor}">
        <h3 class="card-title mb-md">🛡️ Likidite Risk Analizi</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${formatCurrency(lr.monthlyNeed)}</div>
            <div class="stat-label">Aylık ihtiyaç</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${formatCurrency(lr.available)}</div>
            <div class="stat-label">Mevcut likidite</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="font-size:var(--font-md);color:${statusColor}">${lr.survivalMonths} ay</div>
            <div class="stat-label">Dayanma süresi</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="font-size:var(--font-md);color:${lr.gap >= 0 ? 'var(--accent-primary)' : 'var(--accent-danger)'}">${formatCurrency(lr.gap)}</div>
            <div class="stat-label">${lr.gap >= 0 ? 'Fazla' : 'Açık'}</div>
          </div>
        </div>
        <p class="card-subtitle mt-sm">${icon} ${lr.message}</p>
      </div>
    `;
  }

  // ─── B7: Sapma Analizi ──────────────────────────────────────
  renderDeviation(d) {
    if (!d.deviations || d.deviations.length === 0) {
      return `<div class="card fade-in mt-md"><h3 class="card-title">📉 Sapma Analizi</h3><p style="color:var(--text-muted);margin-top:var(--space-sm)">Karşılaştırma için önceki ay verisi yok</p></div>`;
    }

    const netDeltaColor = d.netDelta >= 0 ? 'var(--accent-primary)' : 'var(--accent-danger)';

    return `
      <div class="card fade-in mt-md">
        <h3 class="card-title mb-md">📉 Önceki Aya Göre Sapma</h3>
        <div class="stats-grid" style="margin-bottom:var(--space-md)">
          <div class="stat-card">
            <div class="stat-value" style="font-size:var(--font-md);color:${d.incomeDelta >= 0 ? 'var(--accent-primary)' : 'var(--accent-danger)'}">
              ${d.incomeDelta >= 0 ? '+' : ''}${formatCurrency(d.incomeDelta)}
            </div>
            <div class="stat-label">Gelir değişimi</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="font-size:var(--font-md);color:${d.expenseDelta <= 0 ? 'var(--accent-primary)' : 'var(--accent-danger)'}">
              ${d.expenseDelta >= 0 ? '+' : ''}${formatCurrency(d.expenseDelta)}
            </div>
            <div class="stat-label">Gider değişimi</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="font-size:var(--font-md);color:${netDeltaColor}">
              ${d.netDelta >= 0 ? '+' : ''}${formatCurrency(d.netDelta)}
            </div>
            <div class="stat-label">Net değişim</div>
          </div>
        </div>
        <div class="table-responsive"><table class="data-table">
          <thead>
            <tr style="border-bottom:1px solid var(--border-color)">
              <th style="text-align:left;padding:var(--space-xs)">Kategori</th>
              <th style="text-align:right;padding:var(--space-xs)">Önceki</th>
              <th style="text-align:right;padding:var(--space-xs)">Şimdi</th>
              <th style="text-align:right;padding:var(--space-xs)">Fark</th>
              <th style="text-align:center;padding:var(--space-xs)">Trend</th>
            </tr>
          </thead>
          <tbody>
            ${d.deviations.slice(0, 10).map(dev => {
              const deltaColor = dev.delta > 0 ? 'var(--accent-danger)' : dev.delta < 0 ? 'var(--accent-primary)' : 'var(--text-muted)';
              const trendIcon = dev.trend === 'artış' ? '🔺' : dev.trend === 'azalış' ? '🔻' : '➖';
              return `
                <tr style="border-bottom:1px solid var(--border-color)">
                  <td style="padding:var(--space-xs)">${dev.category}</td>
                  <td style="text-align:right;padding:var(--space-xs)">${formatCurrency(dev.previous)}</td>
                  <td style="text-align:right;padding:var(--space-xs)">${formatCurrency(dev.current)}</td>
                  <td style="text-align:right;padding:var(--space-xs);color:${deltaColor};font-weight:600">
                    ${dev.delta >= 0 ? '+' : ''}${formatCurrency(dev.delta)}
                    ${dev.deltaPercent !== null ? `<span style="font-size:var(--font-xxs)">(%${dev.deltaPercent})</span>` : ''}
                  </td>
                  <td style="text-align:center;padding:var(--space-xs)">${trendIcon}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table></div>
      </div>
    `;
  }

  // ─── B5: Forecast ───────────────────────────────────────────
  renderForecast(f) {
    if (f.message) {
      return `<div class="card fade-in mt-md"><h3 class="card-title">🔮 Gelecek Tahmini</h3><p style="color:var(--text-muted);margin-top:var(--space-sm)">${f.message}</p></div>`;
    }

    return `
      <div class="card fade-in mt-md">
        <h3 class="card-title mb-md">🔮 Gelecek Tahmini (${f.basedOnMonths} aylık veriye dayalı)</h3>
        <div style="display:flex;gap:var(--space-md);margin-bottom:var(--space-md);flex-wrap:wrap">
          <span style="font-size:var(--font-sm);padding:var(--space-xs) var(--space-sm);background:var(--surface-2);border-radius:4px">
            Gider trendi: <strong>${f.expenseTrend}</strong>
          </span>
          <span style="font-size:var(--font-sm);padding:var(--space-xs) var(--space-sm);background:var(--surface-2);border-radius:4px">
            Gelir trendi: <strong>${f.incomeTrend}</strong>
          </span>
        </div>
        <div class="stats-grid">
          ${f.predictions.map((p, i) => {
            const netColor = p.predictedNet >= 0 ? 'var(--accent-primary)' : 'var(--accent-danger)';
            return `
              <div class="stat-card" style="position:relative">
                <div style="font-size:var(--font-xs);color:var(--text-muted);margin-bottom:var(--space-xs)">+${p.monthOffset}. ay</div>
                <div style="font-size:var(--font-sm)">Gelir: ${formatCurrency(p.predictedIncome)}</div>
                <div style="font-size:var(--font-sm)">Gider: ${formatCurrency(p.predictedExpense)}</div>
                <div style="font-size:var(--font-md);font-weight:700;color:${netColor};margin-top:var(--space-xs)">${formatCurrency(p.predictedNet)}</div>
                <div style="font-size:var(--font-xxs);color:var(--text-muted)">Güven: %${p.confidence}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // ─── B6: Kategori Gider Tahmini ─────────────────────────────
  renderCategoryForecast(cats) {
    if (!cats || cats.length === 0) {
      return `<div class="card fade-in mt-md"><h3 class="card-title">📂 Kategori Tahminleri</h3><p style="color:var(--text-muted);margin-top:var(--space-sm)">Yeterli veri yok</p></div>`;
    }

    const maxAvg = Math.max(...cats.map(c => c.avgMonthly), 1);

    return `
      <div class="card fade-in mt-md">
        <h3 class="card-title mb-md">📂 Kategori Bazlı Gider Tahmini</h3>
        ${cats.slice(0, 10).map(c => `
          <div style="display:flex;align-items:center;gap:var(--space-sm);padding:var(--space-xs) 0">
            <span style="flex:1;font-size:var(--font-sm)">${c.category}</span>
            <div style="flex:2;background:var(--surface-2);border-radius:4px;height:8px;overflow:hidden">
              <div style="width:${Math.round(c.avgMonthly / maxAvg * 100)}%;height:100%;background:var(--accent-primary);border-radius:4px"></div>
            </div>
            <span style="width:120px;text-align:right;font-size:var(--font-sm);font-weight:600">${formatCurrency(c.avgMonthly)}</span>
            <span style="width:160px;text-align:right;font-size:var(--font-xxs);color:var(--text-muted)">${c.range}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ─── B9: Tasarruf Potansiyeli ───────────────────────────────
  renderSavingsPotential(sp) {
    if (!sp.categories || sp.categories.length === 0) {
      return `<div class="card fade-in mt-md"><h3 class="card-title">💡 Tasarruf Potansiyeli</h3><p style="color:var(--text-muted);margin-top:var(--space-sm)">Yeterli veri yok</p></div>`;
    }

    const typeColors = {
      'Dokunulmaz': 'var(--accent-danger)',
      'Optimize Edilebilir': 'var(--accent-warning)',
      'Kesilebilir': 'var(--accent-primary)'
    };

    return `
      <div class="card fade-in mt-md" style="border-left:4px solid var(--accent-primary)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-md)">
          <h3 class="card-title">💡 Tasarruf Potansiyeli</h3>
          <div style="text-align:right">
            <div style="font-size:var(--font-lg);font-weight:900;color:var(--accent-primary)">${formatCurrency(sp.totalSaveable)}/ay</div>
            <div style="font-size:var(--font-xs);color:var(--text-muted)">Harcamanın %${sp.saveablePercent}'i</div>
          </div>
        </div>
        <p class="card-subtitle mb-md">${sp.message}</p>
        <div class="table-responsive"><table class="data-table">
          <thead>
            <tr style="border-bottom:1px solid var(--border-color)">
              <th style="text-align:left;padding:var(--space-xs)">Kategori</th>
              <th style="text-align:right;padding:var(--space-xs)">Aylık Ort.</th>
              <th style="text-align:center;padding:var(--space-xs)">Tür</th>
              <th style="text-align:right;padding:var(--space-xs)">Tasarruf</th>
            </tr>
          </thead>
          <tbody>
            ${sp.categories.map(c => `
              <tr style="border-bottom:1px solid var(--border-color)">
                <td style="padding:var(--space-xs)">${c.category}</td>
                <td style="text-align:right;padding:var(--space-xs)">${formatCurrency(c.avgMonthly)}</td>
                <td style="text-align:center;padding:var(--space-xs)">
                  <span style="font-size:var(--font-xxs);padding:2px 8px;border-radius:10px;background:${typeColors[c.typeLabel] || 'var(--surface-2)'};color:white">${c.typeLabel}</span>
                </td>
                <td style="text-align:right;padding:var(--space-xs);font-weight:600;color:${c.saveable > 0 ? 'var(--accent-primary)' : 'var(--text-muted)'}">
                  ${c.saveable > 0 ? formatCurrency(c.saveable) : '—'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table></div>
      </div>
    `;
  }

  // ─── B4: Constraint Optimization Section ────────────────────
  renderOptimizationSection() {
    return `
      <div class="card fade-in mt-md">
        <h3 class="card-title mb-md">⚙️ Borç Ödeme Optimizasyonu</h3>
        <p class="card-subtitle mb-md">
          Aylık ayırabileceğiniz maksimum tutarı girin, en yüksek faizli borçlara öncelik verilir (çığ yöntemi).
        </p>
        <div class="inline-form">
          <div class="field">
            <label>Maks. Aylık Ödeme</label>
            <input type="number" id="optMaxPayment" value="30000" min="0" step="1000">
          </div>
          <div class="field">
            <label>Min. Yaşam Gideri</label>
            <input type="number" id="optMinLiving" value="20000" min="0" step="1000">
          </div>
          <button class="btn btn-primary" id="btnOptimize">Hesapla</button>
        </div>
        <div id="optimizationResult" style="margin-top:var(--space-md)"></div>
      </div>
    `;
  }

  renderOptimizationResult(result) {
    if (!result.allocation || result.allocation.length === 0) {
      return '<p style="color:var(--text-muted)">Borç bulunamadı.</p>';
    }

    return `
      <div style="margin-top:var(--space-sm)">
        <div style="display:flex;gap:var(--space-lg);margin-bottom:var(--space-md)">
          <span style="font-size:var(--font-sm)">Toplam dağıtılan: <strong>${formatCurrency(result.totalAllocated)}</strong></span>
          <span style="font-size:var(--font-sm)">Kalan: <strong>${formatCurrency(result.remaining)}</strong></span>
        </div>
        <div class="table-responsive"><table class="data-table">
          <thead>
            <tr style="border-bottom:1px solid var(--border-color)">
              <th style="text-align:left;padding:var(--space-xs)">Borç</th>
              <th style="text-align:right;padding:var(--space-xs)">Bakiye</th>
              <th style="text-align:right;padding:var(--space-xs)">Faiz</th>
              <th style="text-align:right;padding:var(--space-xs)">Min. Ödeme</th>
              <th style="text-align:right;padding:var(--space-xs)">Önerilen</th>
              <th style="text-align:right;padding:var(--space-xs)">Ekstra</th>
            </tr>
          </thead>
          <tbody>
            ${result.allocation.map(a => `
              <tr style="border-bottom:1px solid var(--border-color)">
                <td style="padding:var(--space-xs)">${a.name}</td>
                <td style="text-align:right;padding:var(--space-xs)">${formatCurrency(a.balance)}</td>
                <td style="text-align:right;padding:var(--space-xs)">%${a.rate}</td>
                <td style="text-align:right;padding:var(--space-xs)">${formatCurrency(a.minPayment)}</td>
                <td style="text-align:right;padding:var(--space-xs);font-weight:700;color:var(--accent-primary)">${formatCurrency(a.allocated)}</td>
                <td style="text-align:right;padding:var(--space-xs);color:${a.extra > 0 ? 'var(--accent-primary)' : 'var(--text-muted)'}">
                  ${a.extra > 0 ? '+' + formatCurrency(a.extra) : '—'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table></div>
      </div>
    `;
  }

  // ─── Events ─────────────────────────────────────────────────
  bindEvents() {
    const btnOptimize = this.container.querySelector('#btnOptimize');
    if (btnOptimize) {
      btnOptimize.addEventListener('click', async () => {
        const maxPayment = parseFloat(this.container.querySelector('#optMaxPayment').value) || 30000;
        const minLiving = parseFloat(this.container.querySelector('#optMinLiving').value) || 20000;
        const resultDiv = this.container.querySelector('#optimizationResult');
        try {
          resultDiv.innerHTML = '<p style="color:var(--text-muted)">Hesaplanıyor...</p>';
          const result = await api.postConstraintOptimization({ maxMonthlyPayment: maxPayment, minLivingExpense: minLiving });
          resultDiv.innerHTML = this.renderOptimizationResult(result);
        } catch (err) {
          resultDiv.innerHTML = `<p style="color:var(--accent-danger)">Hata: ${err.message}</p>`;
        }
      });
    }
  }
}
