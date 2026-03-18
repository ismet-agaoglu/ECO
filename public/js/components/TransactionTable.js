// ═══════════════════════════════════════════════════════════════════
// TransactionTable Component — Year > Month > Week > Day drill-down
// ═══════════════════════════════════════════════════════════════════

import { api } from '../services/ApiService.js';
import { formatCurrency, formatDateShort, formatMonthYear, MONTH_NAMES, getWeekOfMonth } from '../utils/formatters.js';

export class TransactionTable {
  constructor(container, year, month, { onToast, openModal, closeModal }) {
    this.container = container;
    this.year = year;
    this.month = month;
    this.onToast = onToast;
    this.openModal = openModal;
    this.closeModal = closeModal;
    this.view = 'months'; // 'months' | 'detail'
    this.selectedMonth = null;
    this.categories = [];
  }

  async render() {
    this.categories = await api.getCategories();

    if (this.view === 'detail' && this.selectedMonth) {
      await this.renderMonthDetail();
    } else {
      await this.renderMonthsOverview();
    }
  }

  async renderMonthsOverview() {
    const yearTransactions = await api.getTransactions({ year: this.year });
    const monthlyData = {};
    
    for (let m = 1; m <= 12; m++) {
      monthlyData[m] = { income: 0, expense: 0, count: 0 };
    }

    yearTransactions.forEach(t => {
      const m = new Date(t.date).getMonth() + 1;
      if (monthlyData[m]) {
        if (t.type === 'income') monthlyData[m].income += t.amount;
        else monthlyData[m].expense += t.amount;
        monthlyData[m].count++;
      }
    });

    this.container.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">${this.year} Yılı İşlemleri</h2>
        <button class="btn btn-primary" id="addTransactionBtn">+ İşlem Ekle</button>
      </div>
      <div class="month-grid">
        ${Object.entries(monthlyData).map(([m, data]) => {
          const net = data.income - data.expense;
          const netClass = net >= 0 ? 'amount-income' : 'amount-expense';
          const isCurrent = parseInt(m) === this.month;
          return `
            <div class="card month-card fade-in ${isCurrent ? 'stat-card net' : ''}" data-month="${m}">
              <div class="card-header">
                <span class="month-name">${MONTH_NAMES[m - 1]}</span>
                ${data.count > 0 ? `<span class="tag tag-${net >= 0 ? 'income' : 'expense'}">${data.count} işlem</span>` : ''}
              </div>
              <div class="month-summary">
                <div class="month-stat">
                  <span class="month-stat-label">Gelir</span>
                  <span class="month-stat-value amount-income">${formatCurrency(data.income)}</span>
                </div>
                <div class="month-stat">
                  <span class="month-stat-label">Gider</span>
                  <span class="month-stat-value amount-expense">${formatCurrency(data.expense)}</span>
                </div>
                <div class="month-stat">
                  <span class="month-stat-label">Net</span>
                  <span class="month-stat-value ${netClass}">${formatCurrency(net)}</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Events
    this.container.querySelectorAll('.month-card').forEach(card => {
      card.addEventListener('click', () => {
        this.selectedMonth = parseInt(card.dataset.month);
        this.view = 'detail';
        this.render();
      });
    });

    document.getElementById('addTransactionBtn')?.addEventListener('click', () => this.showAddForm());
  }

  async renderMonthDetail() {
    const tx = await api.getTransactions({ year: this.year, month: this.selectedMonth });

    // Group by week
    const weeks = {};
    tx.forEach(t => {
      const week = getWeekOfMonth(t.date);
      if (!weeks[week]) weeks[week] = [];
      weeks[week].push(t);
    });

    const totalIncome = tx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = tx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    this.container.innerHTML = `
      <button class="back-btn" id="backToMonths">← Aylara Dön</button>
      <div class="section-header">
        <h2 class="section-title">${formatMonthYear(this.year, this.selectedMonth)}</h2>
        <button class="btn btn-primary" id="addTransactionBtn2">+ İşlem Ekle</button>
      </div>
      <div class="stats-grid mb-lg">
        <div class="card stat-card income">
          <p class="card-title">Gelir</p>
          <p class="card-value positive">${formatCurrency(totalIncome)}</p>
        </div>
        <div class="card stat-card expense">
          <p class="card-title">Gider</p>
          <p class="card-value negative">${formatCurrency(totalExpense)}</p>
        </div>
        <div class="card stat-card net">
          <p class="card-title">Net</p>
          <p class="card-value ${(totalIncome - totalExpense) >= 0 ? 'positive' : 'negative'}">${formatCurrency(totalIncome - totalExpense)}</p>
        </div>
      </div>
      <div class="month-detail">
        ${Object.keys(weeks).length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <p class="empty-state-text">Bu ayda henüz işlem yok</p>
          </div>
        ` : Object.keys(weeks).sort((a, b) => a - b).map(week => {
          const weekTx = weeks[week];
          const weekTotal = weekTx.reduce((s, t) => s + (t.type === 'expense' ? -t.amount : t.amount), 0);
          return `
            <div class="week-group card" style="margin-bottom:var(--space-md)">
              <div class="week-header" data-week="${week}">
                <h4>${week}. Hafta</h4>
                <span class="week-total ${weekTotal >= 0 ? 'amount-income' : 'amount-expense'}">${formatCurrency(weekTotal)}</span>
              </div>
              <div class="week-content table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Tarih</th>
                      <th>Açıklama</th>
                      <th>Kategori</th>
                      <th>Tür</th>
                      <th style="text-align:right">Tutar</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${weekTx.sort((a, b) => new Date(a.date) - new Date(b.date)).map(t => {
                      const cat = this.categories.find(c => c.id === t.category);
                      return `
                        <tr>
                          <td>${formatDateShort(t.date)}</td>
                          <td>${t.description || '—'}</td>
                          <td><span class="category-badge">${cat ? cat.icon + ' ' + cat.name : t.category}</span></td>
                          <td><span class="tag tag-${t.type}">${t.type === 'income' ? 'Gelir' : 'Gider'}</span></td>
                          <td class="text-right amount-${t.type}">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</td>
                          <td>
                            <div class="row-actions">
                              <button class="action-btn delete" data-id="${t.id}" title="Sil">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Events
    document.getElementById('backToMonths')?.addEventListener('click', () => {
      this.view = 'months';
      this.selectedMonth = null;
      this.render();
    });

    document.getElementById('addTransactionBtn2')?.addEventListener('click', () => this.showAddForm());

    // Delete buttons
    this.container.querySelectorAll('.action-btn.delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Bu işlemi silmek istediğinize emin misiniz?')) {
          await api.deleteTransaction(btn.dataset.id);
          this.onToast('İşlem silindi', 'success');
          this.render();
        }
      });
    });
  }

  showAddForm() {
    const catOptions = this.categories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
    const today = new Date().toISOString().split('T')[0];

    this.openModal('Yeni İşlem Ekle', `
      <form id="addTransactionForm">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tür</label>
            <select class="form-select" name="type" id="txType">
              <option value="expense">Gider</option>
              <option value="income">Gelir</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Tarih</label>
            <input class="form-input" type="date" name="date" value="${today}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Tutar (₺)</label>
          <input class="form-input" type="number" name="amount" step="0.01" min="0" placeholder="0.00" required>
        </div>
        <div class="form-group">
          <label class="form-label">Kategori</label>
          <select class="form-select" name="category">${catOptions}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Açıklama</label>
          <input class="form-input" type="text" name="description" placeholder="İşlem açıklaması...">
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" id="cancelTxBtn">İptal</button>
          <button type="submit" class="btn btn-primary">Kaydet</button>
        </div>
      </form>
    `);

    document.getElementById('cancelTxBtn')?.addEventListener('click', () => this.closeModal());

    document.getElementById('addTransactionForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const data = {
        type: form.type.value,
        date: form.date.value,
        amount: parseFloat(form.amount.value),
        category: form.category.value,
        description: form.description.value
      };

      try {
        await api.addTransaction(data);
        this.onToast('İşlem eklendi!', 'success');
        this.closeModal();
        this.render();
      } catch (err) {
        this.onToast('Hata: ' + err.message, 'error');
      }
    });
  }
}
