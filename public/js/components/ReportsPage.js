// ═══════════════════════════════════════════════════════════════════
// ReportsPage — Raporlar, Yıllık Karşılaştırma, Vergi, PDF (Faz 6)
// ═══════════════════════════════════════════════════════════════════

import { api } from '../services/ApiService.js';
import { formatCurrency, MONTH_NAMES } from '../utils/formatters.js';

export class ReportsPage {
  constructor(container, year, month, helpers) {
    this.container = container;
    this.year = year;
    this.month = month;
    this.helpers = helpers;
    this.activeTab = 'yearly';
  }

  async render() {
    this.container.innerHTML = '<div class="text-center mt-lg" style="color:var(--text-muted)">Raporlar yükleniyor...</div>';
    try {
      this.container.innerHTML = this.renderPage();
      this.bindEvents();
      this.loadTab('yearly');
    } catch (err) {
      this.container.innerHTML = `<div class="empty-state"><p>Hata: ${err.message}</p></div>`;
    }
  }

  renderPage() {
    return `
      <div class="section-header">
        <h2 class="section-title">📊 Raporlar</h2>
      </div>

      <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-md);flex-wrap:wrap">
        <button class="btn tab-btn active" data-tab="yearly" style="background:var(--accent-primary);color:white">📅 Yıllık Karşılaştırma</button>
        <button class="btn btn-ghost tab-btn" data-tab="tax">🧾 Vergi Özeti</button>
        <button class="btn btn-ghost tab-btn" data-tab="inflation">📈 Enflasyon</button>
        <button class="btn btn-ghost tab-btn" data-tab="pdf">📄 PDF İndir</button>
        <button class="btn btn-ghost tab-btn" data-tab="snapshots">📸 Snapshotlar</button>
        <button class="btn btn-ghost tab-btn" data-tab="actions">⚡ Aksiyonlar</button>
      </div>

      <div id="tabContent"></div>
    `;
  }

  async loadTab(tab) {
    const content = this.container.querySelector('#tabContent');
    content.innerHTML = '<div class="text-center" style="color:var(--text-muted);padding:var(--space-lg)">Yükleniyor...</div>';

    try {
      switch (tab) {
        case 'yearly': content.innerHTML = await this.renderYearly(); break;
        case 'tax': content.innerHTML = await this.renderTax(); break;
        case 'inflation': content.innerHTML = this.renderInflation(); this.bindInflation(); break;
        case 'pdf': content.innerHTML = this.renderPDF(); this.bindPDF(); break;
        case 'snapshots': content.innerHTML = await this.renderSnapshots(); this.bindSnapshots(); break;
        case 'actions': content.innerHTML = await this.renderActions(); break;
      }
    } catch (err) { content.innerHTML = `<p style="color:var(--accent-danger)">Hata: ${err.message}</p>`; }
  }

  async renderYearly() {
    const data = await api.getYearlyComparison(this.year - 1, this.year);
    const { year1, year2, categoryComparison, monthlyComparison } = data;

    return `
      <div class="card fade-in">
        <h3 style="font-weight:700;margin-bottom:var(--space-md)">${year1.year} vs ${year2.year}</h3>
        <div class="stats-grid" style="margin-bottom:var(--space-md)">
          <div class="stat-card">
            <div class="stat-label">${year1.year} Gelir</div>
            <div class="stat-value" style="font-size:var(--font-md)">${formatCurrency(year1.totalIncome)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">${year2.year} Gelir</div>
            <div class="stat-value" style="font-size:var(--font-md)">${formatCurrency(year2.totalIncome)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">${year1.year} Gider</div>
            <div class="stat-value" style="font-size:var(--font-md)">${formatCurrency(year1.totalExpense)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">${year2.year} Gider</div>
            <div class="stat-value" style="font-size:var(--font-md)">${formatCurrency(year2.totalExpense)}</div>
          </div>
        </div>

        ${categoryComparison.length > 0 ? `
          <h4 style="font-size:var(--font-sm);color:var(--text-secondary);margin:var(--space-md) 0 var(--space-sm)">Kategori Karşılaştırma</h4>
          <table style="width:100%;font-size:var(--font-sm);border-collapse:collapse">
            <thead><tr style="border-bottom:1px solid var(--border-color)">
              <th style="text-align:left;padding:var(--space-xs)">Kategori</th>
              <th style="text-align:right;padding:var(--space-xs)">${year1.year}</th>
              <th style="text-align:right;padding:var(--space-xs)">${year2.year}</th>
              <th style="text-align:right;padding:var(--space-xs)">Fark</th>
            </tr></thead>
            <tbody>
              ${categoryComparison.slice(0, 12).map(c => `
                <tr style="border-bottom:1px solid var(--border-color)">
                  <td style="padding:var(--space-xs)">${c.category}</td>
                  <td style="text-align:right;padding:var(--space-xs)">${formatCurrency(c.year1)}</td>
                  <td style="text-align:right;padding:var(--space-xs)">${formatCurrency(c.year2)}</td>
                  <td style="text-align:right;padding:var(--space-xs);color:${c.delta > 0 ? 'var(--accent-danger)' : 'var(--accent-primary)'};font-weight:600">
                    ${c.delta >= 0 ? '+' : ''}${formatCurrency(c.delta)}${c.deltaPercent !== null ? ` (%${c.deltaPercent})` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}
      </div>
    `;
  }

  async renderTax() {
    const data = await api.getTaxSummary(this.year);
    return `
      <div class="card fade-in">
        <h3 style="font-weight:700;margin-bottom:var(--space-md)">🧾 ${data.year} Vergi Hazırlık Özeti</h3>
        <div class="stats-grid" style="margin-bottom:var(--space-md)">
          <div class="stat-card"><div class="stat-value" style="font-size:var(--font-md)">${formatCurrency(data.totalIncome)}</div><div class="stat-label">Toplam Gelir</div></div>
          <div class="stat-card"><div class="stat-value" style="font-size:var(--font-md)">${formatCurrency(data.totalExpense)}</div><div class="stat-label">Toplam Gider</div></div>
          <div class="stat-card"><div class="stat-value" style="font-size:var(--font-md)">${formatCurrency(data.net)}</div><div class="stat-label">Net</div></div>
          <div class="stat-card"><div class="stat-value" style="font-size:var(--font-md)">${data.transactionCount}</div><div class="stat-label">İşlem Sayısı</div></div>
        </div>
        ${data.potentialDeductibles.length > 0 ? `
          <h4 style="font-size:var(--font-sm);color:var(--text-secondary);margin-bottom:var(--space-sm)">Potansiyel İndirimler</h4>
          ${data.potentialDeductibles.map(d => `
            <div style="display:flex;justify-content:space-between;padding:var(--space-xs) 0;font-size:var(--font-sm);border-bottom:1px solid var(--border-color)">
              <span>${d.category}</span><span style="font-weight:600">${formatCurrency(d.amount)}</span>
            </div>
          `).join('')}
          <div style="margin-top:var(--space-sm);font-size:var(--font-sm);font-weight:700">Toplam İndirim: ${formatCurrency(data.totalDeductible)}</div>
        ` : '<p style="color:var(--text-muted);font-size:var(--font-sm)">İndirim kapsamında harcama bulunamadı.</p>'}
      </div>
    `;
  }

  renderInflation() {
    return `
      <div class="card fade-in">
        <h3 style="font-weight:700;margin-bottom:var(--space-md)">📈 Enflasyon Hesaplayıcı</h3>
        <div style="display:flex;gap:var(--space-md);flex-wrap:wrap;align-items:flex-end">
          <div><label style="font-size:var(--font-xs);color:var(--text-muted);display:block;margin-bottom:4px">Tutar (₺)</label>
            <input type="number" id="infAmount" value="100000" style="padding:var(--space-sm);border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text-primary);width:150px"></div>
          <div><label style="font-size:var(--font-xs);color:var(--text-muted);display:block;margin-bottom:4px">Yıl</label>
            <input type="number" id="infYears" value="3" min="1" max="20" style="padding:var(--space-sm);border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text-primary);width:80px"></div>
          <div><label style="font-size:var(--font-xs);color:var(--text-muted);display:block;margin-bottom:4px">Yıllık Enf. (%)</label>
            <input type="number" id="infRate" value="25" min="1" max="200" style="padding:var(--space-sm);border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text-primary);width:80px"></div>
          <button class="btn" id="btnCalcInf" style="background:var(--accent-primary);color:white">Hesapla</button>
        </div>
        <div id="infResult" style="margin-top:var(--space-md)"></div>
      </div>
    `;
  }

  bindInflation() {
    this.container.querySelector('#btnCalcInf')?.addEventListener('click', async () => {
      const amount = parseFloat(this.container.querySelector('#infAmount').value) || 100000;
      const years = parseInt(this.container.querySelector('#infYears').value) || 3;
      const rate = parseFloat(this.container.querySelector('#infRate').value) || 25;
      try {
        const [fv, sal] = await Promise.all([
          api.postInflationFuture({ amount, years, rate }),
          api.postInflationSalary({ monthlySalary: amount, years })
        ]);
        this.container.querySelector('#infResult').innerHTML = `
          <div class="stats-grid" style="margin-bottom:var(--space-md)">
            <div class="stat-card"><div class="stat-value" style="font-size:var(--font-md)">${formatCurrency(fv.futureEquivalent)}</div><div class="stat-label">Gelecek eşdeğeri</div></div>
            <div class="stat-card"><div class="stat-value" style="font-size:var(--font-md);color:var(--accent-danger)">${formatCurrency(fv.purchasingPower)}</div><div class="stat-label">Satın alma gücü</div></div>
            <div class="stat-card"><div class="stat-value" style="font-size:var(--font-md);color:var(--accent-danger)">-%${fv.erosionPercent}</div><div class="stat-label">Değer kaybı</div></div>
          </div>
          <p style="font-size:var(--font-sm);color:var(--text-secondary)">${fv.message}</p>
        `;
      } catch (err) { this.container.querySelector('#infResult').innerHTML = `<p style="color:var(--accent-danger)">${err.message}</p>`; }
    });
  }

  renderPDF() {
    return `
      <div class="card fade-in">
        <h3 style="font-weight:700;margin-bottom:var(--space-md)">📄 PDF Rapor İndir</h3>
        <div style="display:flex;gap:var(--space-md);align-items:flex-end">
          <div><label style="font-size:var(--font-xs);color:var(--text-muted);display:block;margin-bottom:4px">Yıl</label>
            <input type="number" id="pdfYear" value="${this.year}" style="padding:var(--space-sm);border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text-primary);width:100px"></div>
          <div><label style="font-size:var(--font-xs);color:var(--text-muted);display:block;margin-bottom:4px">Ay</label>
            <select id="pdfMonth" style="padding:var(--space-sm);border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text-primary)">
              ${MONTH_NAMES.map((m, i) => `<option value="${i + 1}" ${i + 1 === this.month ? 'selected' : ''}>${m}</option>`).join('')}
            </select></div>
          <a class="btn" id="btnDownloadPdf" href="/api/reports/pdf?year=${this.year}&month=${this.month}" target="_blank" style="background:var(--accent-primary);color:white;text-decoration:none">📥 PDF İndir</a>
        </div>
      </div>
    `;
  }

  bindPDF() {
    const yearInput = this.container.querySelector('#pdfYear');
    const monthInput = this.container.querySelector('#pdfMonth');
    const btn = this.container.querySelector('#btnDownloadPdf');
    const update = () => { btn.href = `/api/reports/pdf?year=${yearInput.value}&month=${monthInput.value}`; };
    yearInput?.addEventListener('change', update);
    monthInput?.addEventListener('change', update);
  }

  async renderSnapshots() {
    const snapshots = await api.getSnapshots();
    return `
      <div class="card fade-in">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md)">
          <h3 style="font-weight:700">📸 Aylık Snapshotlar (${snapshots.length})</h3>
          <button class="btn" id="btnGenSnapshots" style="background:var(--accent-primary);color:white">🔄 Eksikleri Oluştur</button>
        </div>
        ${snapshots.length > 0 ? `
          <table style="width:100%;font-size:var(--font-sm);border-collapse:collapse">
            <thead><tr style="border-bottom:1px solid var(--border-color)">
              <th style="text-align:left;padding:var(--space-xs)">Dönem</th>
              <th style="text-align:right;padding:var(--space-xs)">Gelir</th>
              <th style="text-align:right;padding:var(--space-xs)">Gider</th>
              <th style="text-align:right;padding:var(--space-xs)">Net</th>
              <th style="text-align:right;padding:var(--space-xs)">Borç</th>
              <th style="text-align:center;padding:var(--space-xs)">Risk</th>
            </tr></thead>
            <tbody>
              ${snapshots.sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month)).map(s => `
                <tr style="border-bottom:1px solid var(--border-color)">
                  <td style="padding:var(--space-xs)">${MONTH_NAMES[s.month - 1]} ${s.year}</td>
                  <td style="text-align:right;padding:var(--space-xs)">${formatCurrency(s.income)}</td>
                  <td style="text-align:right;padding:var(--space-xs)">${formatCurrency(s.expense)}</td>
                  <td style="text-align:right;padding:var(--space-xs);color:${s.net >= 0 ? 'var(--accent-primary)' : 'var(--accent-danger)'}">${formatCurrency(s.net)}</td>
                  <td style="text-align:right;padding:var(--space-xs)">${formatCurrency(s.totalDebt)}</td>
                  <td style="text-align:center;padding:var(--space-xs)">${s.riskLabel}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p style="color:var(--text-muted)">Henüz snapshot yok. "Eksikleri Oluştur" butonuna tıklayın.</p>'}
      </div>
    `;
  }

  bindSnapshots() {
    this.container.querySelector('#btnGenSnapshots')?.addEventListener('click', async () => {
      try {
        const result = await api.postSnapshotsGenerate();
        this.helpers.onToast(`${result.new} yeni snapshot oluşturuldu (toplam: ${result.total})`, 'success');
        this.loadTab('snapshots');
      } catch (err) { this.helpers.onToast('Hata: ' + err.message, 'error'); }
    });
  }

  async renderActions() {
    const actions = await api.getActions();
    if (actions.length === 0) return '<div class="card fade-in"><p style="color:var(--text-muted)">Aksiyon önerisi yok.</p></div>';

    return `
      <div class="card fade-in">
        <h3 style="font-weight:700;margin-bottom:var(--space-md)">⚡ Önerilen Aksiyonlar</h3>
        ${actions.map(a => {
          const colors = { kritik: 'var(--accent-danger)', yüksek: '#ff6b35', orta: 'var(--accent-warning)' };
          const color = colors[a.priority] || 'var(--accent-primary)';
          return `
            <div style="padding:var(--space-md);border-left:4px solid ${color};background:var(--surface-2);border-radius:var(--radius-sm);margin-bottom:var(--space-sm)">
              <div style="display:flex;justify-content:space-between;align-items:start">
                <strong style="font-size:var(--font-sm)">${a.title}</strong>
                <span style="font-size:var(--font-xxs);padding:2px 8px;background:${color};color:white;border-radius:10px">${a.priority}</span>
              </div>
              <p style="font-size:var(--font-xs);color:var(--text-secondary);margin:var(--space-xs) 0">${a.description}</p>
              <details style="font-size:var(--font-xs)">
                <summary style="cursor:pointer;color:var(--text-muted)">Neden?</summary>
                <p style="margin-top:var(--space-xs);color:var(--text-secondary)">${a.reason}</p>
              </details>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  bindEvents() {
    this.container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.style.background = ''; b.style.color = ''; });
        btn.classList.add('active');
        btn.style.background = 'var(--accent-primary)';
        btn.style.color = 'white';
        this.loadTab(btn.dataset.tab);
      });
    });
  }
}
