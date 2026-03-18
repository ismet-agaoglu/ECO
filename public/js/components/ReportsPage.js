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
    this.container.innerHTML = '<div class="loading">Raporlar yükleniyor...</div>';
    try {
      this.container.innerHTML = this.renderPage();
      this.bindEvents();
      this.loadTab('yearly');
    } catch (err) {
      this.container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📊</div><p class="empty-state-text">Hata: ${err.message}</p></div>`;
    }
  }

  renderPage() {
    return `
      <div class="section-header">
        <h2 class="section-title">Raporlar</h2>
      </div>

      <div class="tab-bar">
        <button class="tab-btn active" data-tab="yearly">📅 Yıllık</button>
        <button class="tab-btn" data-tab="tax">🧾 Vergi</button>
        <button class="tab-btn" data-tab="inflation">📈 Enflasyon</button>
        <button class="tab-btn" data-tab="pdf">📄 PDF</button>
        <button class="tab-btn" data-tab="snapshots">📸 Snapshot</button>
        <button class="tab-btn" data-tab="actions">⚡ Aksiyonlar</button>
      </div>

      <div id="tabContent"></div>
    `;
  }

  async loadTab(tab) {
    const content = this.container.querySelector('#tabContent');
    content.innerHTML = '<div class="loading">Yükleniyor...</div>';
    try {
      switch (tab) {
        case 'yearly': content.innerHTML = await this.renderYearly(); break;
        case 'tax': content.innerHTML = await this.renderTax(); break;
        case 'inflation': content.innerHTML = this.renderInflation(); this.bindInflation(); break;
        case 'pdf': content.innerHTML = this.renderPDF(); this.bindPDF(); break;
        case 'snapshots': content.innerHTML = await this.renderSnapshots(); this.bindSnapshots(); break;
        case 'actions': content.innerHTML = await this.renderActions(); break;
      }
    } catch (err) {
      content.innerHTML = `<div class="empty-state"><p class="empty-state-text">Hata: ${err.message}</p></div>`;
    }
  }

  async renderYearly() {
    const data = await api.getYearlyComparison(this.year - 1, this.year);
    const { year1, year2, categoryComparison } = data;

    return `
      <div class="card fade-in">
        <div class="card-header">
          <h3 class="card-title">${year1.year} vs ${year2.year}</h3>
        </div>
        <div class="stats-grid mb-md">
          <div class="card stat-card income">
            <p class="card-title">${year1.year} Gelir</p>
            <p class="card-value positive">${formatCurrency(year1.totalIncome)}</p>
          </div>
          <div class="card stat-card income">
            <p class="card-title">${year2.year} Gelir</p>
            <p class="card-value positive">${formatCurrency(year2.totalIncome)}</p>
          </div>
          <div class="card stat-card expense">
            <p class="card-title">${year1.year} Gider</p>
            <p class="card-value negative">${formatCurrency(year1.totalExpense)}</p>
          </div>
          <div class="card stat-card expense">
            <p class="card-title">${year2.year} Gider</p>
            <p class="card-value negative">${formatCurrency(year2.totalExpense)}</p>
          </div>
        </div>

        ${categoryComparison.length > 0 ? `
          <h4 class="card-title mb-sm">Kategori Karşılaştırma</h4>
          <div class="table-responsive">
            <table class="data-table">
              <thead><tr>
                <th>Kategori</th>
                <th class="text-right">${year1.year}</th>
                <th class="text-right">${year2.year}</th>
                <th class="text-right">Fark</th>
              </tr></thead>
              <tbody>
                ${categoryComparison.slice(0, 12).map(c => `
                  <tr>
                    <td>${c.category}</td>
                    <td class="text-right">${formatCurrency(c.year1)}</td>
                    <td class="text-right">${formatCurrency(c.year2)}</td>
                    <td class="text-right ${c.delta > 0 ? 'amount-expense' : 'amount-income'}">
                      ${c.delta >= 0 ? '+' : ''}${formatCurrency(c.delta)}${c.deltaPercent !== null ? ` (%${c.deltaPercent})` : ''}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
      </div>
    `;
  }

  async renderTax() {
    const data = await api.getTaxSummary(this.year);
    return `
      <div class="card fade-in">
        <div class="card-header">
          <h3 class="card-title">${data.year} Vergi Hazırlık Özeti</h3>
        </div>
        <div class="stats-grid mb-md">
          <div class="card stat-card income">
            <p class="card-title">Toplam Gelir</p>
            <p class="card-value">${formatCurrency(data.totalIncome)}</p>
          </div>
          <div class="card stat-card expense">
            <p class="card-title">Toplam Gider</p>
            <p class="card-value">${formatCurrency(data.totalExpense)}</p>
          </div>
          <div class="card stat-card net">
            <p class="card-title">Net</p>
            <p class="card-value">${formatCurrency(data.net)}</p>
          </div>
          <div class="card stat-card">
            <p class="card-title">İşlem Sayısı</p>
            <p class="card-value">${data.transactionCount}</p>
          </div>
        </div>
        ${data.potentialDeductibles.length > 0 ? `
          <h4 class="card-title mb-sm">Potansiyel İndirimler</h4>
          <div class="recent-list">
            ${data.potentialDeductibles.map(d => `
              <div class="recent-item">
                <div class="recent-info"><div class="recent-desc">${d.category}</div></div>
                <div class="recent-amount">${formatCurrency(d.amount)}</div>
              </div>
            `).join('')}
          </div>
          <div class="card-header mt-sm">
            <span class="card-title">Toplam İndirim</span>
            <span class="card-value positive">${formatCurrency(data.totalDeductible)}</span>
          </div>
        ` : '<p class="card-subtitle">İndirim kapsamında harcama bulunamadı.</p>'}
      </div>
    `;
  }

  renderInflation() {
    return `
      <div class="card fade-in">
        <div class="card-header">
          <h3 class="card-title">Enflasyon Hesaplayıcı</h3>
        </div>
        <div class="inline-form mb-md">
          <div class="field">
            <label>Tutar (₺)</label>
            <input type="number" id="infAmount" value="100000">
          </div>
          <div class="field">
            <label>Yıl</label>
            <input type="number" id="infYears" value="3" min="1" max="20">
          </div>
          <div class="field">
            <label>Yıllık Enflasyon (%)</label>
            <input type="number" id="infRate" value="25" min="1" max="200">
          </div>
          <button class="btn btn-primary" id="btnCalcInf">Hesapla</button>
        </div>
        <div id="infResult"></div>
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
          <div class="stats-grid mb-md">
            <div class="card stat-card">
              <p class="card-title">Gelecek Eşdeğeri</p>
              <p class="card-value">${formatCurrency(fv.futureEquivalent)}</p>
            </div>
            <div class="card stat-card expense">
              <p class="card-title">Satın Alma Gücü</p>
              <p class="card-value negative">${formatCurrency(fv.purchasingPower)}</p>
            </div>
            <div class="card stat-card expense">
              <p class="card-title">Değer Kaybı</p>
              <p class="card-value negative">-%${fv.erosionPercent}</p>
            </div>
          </div>
          <p class="card-subtitle">${fv.message}</p>
        `;
      } catch (err) {
        this.container.querySelector('#infResult').innerHTML = `<p class="card-subtitle" style="color:var(--accent-danger)">${err.message}</p>`;
      }
    });
  }

  renderPDF() {
    return `
      <div class="card fade-in">
        <div class="card-header">
          <h3 class="card-title">PDF Rapor İndir</h3>
        </div>
        <div class="inline-form">
          <div class="field">
            <label>Yıl</label>
            <input type="number" id="pdfYear" value="${this.year}">
          </div>
          <div class="field">
            <label>Ay</label>
            <select id="pdfMonth" class="form-select">
              ${MONTH_NAMES.map((m, i) => `<option value="${i + 1}" ${i + 1 === this.month ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>
          <a class="btn btn-primary" id="btnDownloadPdf" href="/api/reports/pdf?year=${this.year}&month=${this.month}" target="_blank" style="text-decoration:none">📥 PDF İndir</a>
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
        <div class="card-header">
          <h3 class="card-title">Aylık Snapshotlar (${snapshots.length})</h3>
          <button class="btn btn-primary btn-sm" id="btnGenSnapshots">🔄 Eksikleri Oluştur</button>
        </div>
        ${snapshots.length > 0 ? `
          <div class="table-responsive">
            <table class="data-table">
              <thead><tr>
                <th>Dönem</th>
                <th class="text-right">Gelir</th>
                <th class="text-right">Gider</th>
                <th class="text-right">Net</th>
                <th class="text-right">Borç</th>
                <th class="text-center">Risk</th>
              </tr></thead>
              <tbody>
                ${snapshots.sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month)).map(s => `
                  <tr>
                    <td>${MONTH_NAMES[s.month - 1]} ${s.year}</td>
                    <td class="text-right">${formatCurrency(s.income)}</td>
                    <td class="text-right">${formatCurrency(s.expense)}</td>
                    <td class="text-right ${s.net >= 0 ? 'amount-income' : 'amount-expense'}">${formatCurrency(s.net)}</td>
                    <td class="text-right">${formatCurrency(s.totalDebt)}</td>
                    <td class="text-center"><span class="badge badge-warning">${s.riskLabel}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="empty-state">
            <p class="empty-state-text">Henüz snapshot yok. "Eksikleri Oluştur" butonuna tıklayın.</p>
          </div>
        `}
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
    if (actions.length === 0) {
      return `<div class="card fade-in"><div class="empty-state"><p class="empty-state-text">Aksiyon önerisi yok.</p></div></div>`;
    }

    const priorityClasses = { kritik: 'badge-danger', yüksek: 'badge-warning', orta: 'badge-info' };
    const priorityColors = { kritik: 'var(--accent-danger)', yüksek: 'var(--accent-warning)', orta: 'var(--accent-info)' };

    return `
      <div class="card fade-in">
        <div class="card-header">
          <h3 class="card-title">Önerilen Aksiyonlar</h3>
          <span class="badge badge-info">${actions.length} öneri</span>
        </div>
        ${actions.map(a => {
          const color = priorityColors[a.priority] || 'var(--accent-primary)';
          const badgeClass = priorityClasses[a.priority] || 'badge-success';
          return `
            <div class="card mb-sm" style="border-left:4px solid ${color}">
              <div class="card-header">
                <strong class="section-title">${a.title}</strong>
                <span class="badge ${badgeClass}">${a.priority}</span>
              </div>
              <p class="card-subtitle">${a.description}</p>
              <details class="mt-sm">
                <summary class="card-subtitle" style="cursor:pointer">Neden?</summary>
                <p class="card-subtitle mt-sm">${a.reason}</p>
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
        this.container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.loadTab(btn.dataset.tab);
      });
    });
  }
}
