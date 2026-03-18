// ═══════════════════════════════════════════════════════════════════
// Settings Component — Budget, recurring expenses, data management
// ═══════════════════════════════════════════════════════════════════

import { api } from '../services/ApiService.js';
import { formatCurrency, MONTH_NAMES } from '../utils/formatters.js';

export class Settings {
  constructor(container, year, month, { onToast, openModal, closeModal }) {
    this.container = container;
    this.year = year;
    this.month = month;
    this.onToast = onToast;
    this.openModal = openModal;
    this.closeModal = closeModal;
  }

  async render() {
    try {
      const [budget, recurring, categories] = await Promise.all([
        api.getBudget(this.year, this.month),
        api.getRecurring(),
        api.getCategories()
      ]);

      this.categories = categories;

      this.container.innerHTML = `
        <div class="section-header">
          <h2 class="section-title">Ayarlar</h2>
        </div>

        ${this.renderBudgetSettings(budget)}
        ${this.renderRecurringExpenses(recurring)}
        ${this.renderDataManagement()}
      `;

      this.bindEvents(recurring);
    } catch (err) {
      this.container.innerHTML = '<div class="empty-state"><p>Ayarlar yüklenemedi</p></div>';
      console.error(err);
    }
  }

  renderBudgetSettings(budget) {
    return `
      <div class="settings-section">
        <h3>🎯 Aylık Bütçe — ${MONTH_NAMES[this.month - 1]} ${this.year}</h3>
        <div class="card">
          <form id="budgetForm">
            <div class="form-group">
              <label class="form-label">Aylık Harcama Limiti (₺)</label>
              <input class="form-input" type="number" name="totalLimit" 
                value="${budget.totalLimit || ''}" step="100" min="0" placeholder="Örn: 50000">
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Bütçeyi Kaydet</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  renderRecurringExpenses(recurring) {
    return `
      <div class="settings-section">
        <h3>🔄 Tekrarlayan Harcamalar</h3>
        <div class="card">
          ${recurring.length === 0 ? `
            <p style="color:var(--text-muted);margin-bottom:var(--space-lg)">Henüz tekrarlayan harcama eklenmedi</p>
          ` : `
            <table class="data-table mb-lg">
              <thead>
                <tr>
                  <th>Açıklama</th>
                  <th>Kategori</th>
                  <th>Tür</th>
                  <th style="text-align:right">Tutar</th>
                  <th>Süre</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${recurring.map(r => {
                  const cat = this.categories.find(c => c.id === r.category);
                  return `
                    <tr>
                      <td>${r.description}</td>
                      <td>${cat ? cat.icon + ' ' + cat.name : r.category}</td>
                      <td><span class="tag tag-${r.type}">${r.type === 'income' ? 'Gelir' : 'Gider'}</span></td>
                      <td class="text-right amount-${r.type}">${formatCurrency(r.amount)}</td>
                      <td>${r.durationMonths} ay</td>
                      <td>
                        <button class="action-btn delete delete-recurring" data-id="${r.id}" title="Sil">🗑️</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          `}
          <button class="btn btn-outline" id="addRecurringBtn">+ Tekrarlayan Harcama Ekle</button>
        </div>
      </div>
    `;
  }

  renderDataManagement() {
    return `
      <div class="settings-section">
        <h3>📦 Veri Yönetimi</h3>
        <div class="card">
          <p style="color:var(--text-muted);font-size:var(--font-sm);margin-bottom:var(--space-lg)">
            Verileriniz sunucu tarafında JSON dosyalarında saklanır. Yedekleme için <code>data/</code> klasörünü kopyalayabilirsiniz.
          </p>
          <div class="flex gap-md" style="flex-wrap:wrap">
            <button class="btn btn-outline" id="exportDataBtn">📥 Verileri Dışa Aktar</button>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents(recurring) {
    // Budget form
    document.getElementById('budgetForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const limit = parseFloat(e.target.totalLimit.value) || 0;
      try {
        await api.setBudget({ year: this.year, month: this.month, totalLimit: limit });
        this.onToast('Bütçe kaydedildi!', 'success');
      } catch (err) {
        this.onToast('Hata: ' + err.message, 'error');
      }
    });

    // Add recurring
    document.getElementById('addRecurringBtn')?.addEventListener('click', () => this.showRecurringForm());

    // Delete recurring
    this.container.querySelectorAll('.delete-recurring').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Bu tekrarlayan harcamayı ve ilişkili işlemleri silmek istiyor musunuz?')) {
          await api.deleteRecurring(btn.dataset.id);
          this.onToast('Tekrarlayan harcama silindi', 'success');
          this.render();
        }
      });
    });

    // Export
    document.getElementById('exportDataBtn')?.addEventListener('click', async () => {
      try {
        const [transactions, debts, categories, budgets, recs] = await Promise.all([
          api.getTransactions(),
          api.getDebts(),
          api.getCategories(),
          api.getBudget(this.year, this.month),
          api.getRecurring()
        ]);
        const data = { transactions, debts, categories, budgets, recurring: recs, exportDate: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `eco-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.onToast('Veriler dışa aktarıldı!', 'success');
      } catch (err) {
        this.onToast('Dışa aktarma hatası', 'error');
      }
    });
  }

  showRecurringForm() {
    const catOptions = this.categories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
    const now = new Date();

    this.openModal('Tekrarlayan Harcama Ekle', `
      <form id="addRecurringForm">
        <div class="form-group">
          <label class="form-label">Açıklama</label>
          <input class="form-input" type="text" name="description" placeholder="Örn: Ev Kirası" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tür</label>
            <select class="form-select" name="type">
              <option value="expense">Gider</option>
              <option value="income">Gelir</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Tutar (₺)</label>
            <input class="form-input" type="number" name="amount" step="0.01" min="0" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Kategori</label>
          <select class="form-select" name="category">${catOptions}</select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Başlangıç Yılı</label>
            <input class="form-input" type="number" name="startYear" value="${now.getFullYear()}" min="2020">
          </div>
          <div class="form-group">
            <label class="form-label">Başlangıç Ayı</label>
            <select class="form-select" name="startMonth">
              ${MONTH_NAMES.map((m, i) => `<option value="${i + 1}" ${(i + 1) === (now.getMonth() + 1) ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Süre (Ay)</label>
          <input class="form-input" type="number" name="durationMonths" value="12" min="1" max="120">
          <p style="font-size:var(--font-xs);color:var(--text-muted);margin-top:var(--space-xs)">
            Belirtilen ay sayısı kadar otomatik işlem oluşturulur
          </p>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" id="cancelRecBtn">İptal</button>
          <button type="submit" class="btn btn-primary">Kaydet</button>
        </div>
      </form>
    `);

    document.getElementById('cancelRecBtn')?.addEventListener('click', () => this.closeModal());

    document.getElementById('addRecurringForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const data = {
        description: form.description.value,
        type: form.type.value,
        amount: parseFloat(form.amount.value),
        category: form.category.value,
        startYear: parseInt(form.startYear.value),
        startMonth: parseInt(form.startMonth.value),
        durationMonths: parseInt(form.durationMonths.value)
      };

      try {
        await api.addRecurring(data);
        this.onToast('Tekrarlayan harcama eklendi!', 'success');
        this.closeModal();
        this.render();
      } catch (err) {
        this.onToast('Hata: ' + err.message, 'error');
      }
    });
  }
}
