// ═══════════════════════════════════════════════════════════════════
// InstallmentsPage — Installment tracking with progress
// ═══════════════════════════════════════════════════════════════════

import { api } from '../services/ApiService.js';
import { formatCurrency, MONTH_NAMES } from '../utils/formatters.js';

export class InstallmentsPage {
  constructor(container, { onToast, openModal, closeModal }) {
    this.container = container;
    this.onToast = onToast;
    this.openModal = openModal;
    this.closeModal = closeModal;
  }

  async render() {
    try {
      const [installments, categories, debts] = await Promise.all([
        api.getInstallments(),
        api.getCategories(),
        api.getDebts()
      ]);
      this.categories = categories;
      this.creditCards = debts.filter(d => d.type === 'credit_card');

      const active = installments.filter(i => i.isActive);
      const totalRemaining = active.reduce((s, i) => s + i.remainingAmount, 0);
      const totalMonthly = active.reduce((s, i) => s + i.monthlyAmount, 0);

      this.container.innerHTML = `
        <div class="section-header">
          <h2 class="section-title">Taksitler</h2>
          <button class="btn btn-primary" id="addInstBtn">+ Taksit Ekle</button>
        </div>

        <div class="stats-grid">
          <div class="card stat-card fade-in stagger-1">
            <div class="stat-icon">💳</div>
            <p class="card-title">Aktif Taksit</p>
            <p class="card-value">${active.length}</p>
          </div>
          <div class="card stat-card fade-in stagger-2">
            <div class="stat-icon">📅</div>
            <p class="card-title">Aylık Taksit Yükü</p>
            <p class="card-value negative">${formatCurrency(totalMonthly)}</p>
          </div>
          <div class="card stat-card fade-in stagger-3">
            <div class="stat-icon">💰</div>
            <p class="card-title">Kalan Toplam</p>
            <p class="card-value" style="color:var(--accent-warning)">${formatCurrency(totalRemaining)}</p>
          </div>
        </div>

        ${active.length === 0 ? `
          <div class="card mt-lg text-center" style="padding:var(--space-2xl)">
            <p style="font-size:2rem;margin-bottom:var(--space-md)">💳</p>
            <p style="color:var(--text-muted)">Henüz taksit eklenmedi</p>
          </div>
        ` : `
          <div class="mt-lg" style="display:grid;gap:var(--space-lg)">
            ${active.map((inst, idx) => {
              const progress = (inst.paidCount / inst.installmentCount) * 100;
              const cat = categories.find(c => c.id === inst.category);
              const linkedCard = inst.creditCardId ? this.creditCards.find(c => c.id === inst.creditCardId) : null;
              return `
                <div class="card fade-in stagger-${idx + 1}">
                  <div class="flex-between mb-md">
                    <div>
                      <h3 style="font-weight:700">${cat ? cat.icon : '💳'} ${inst.name}</h3>
                      <p style="font-size:var(--font-xs);color:var(--text-muted)">
                        ${inst.startMonth}/${inst.startYear} başlangıç
                        ${linkedCard ? ` · <span style="color:var(--accent-info)">💳 ${linkedCard.name}</span>` : ''}
                      </p>
                    </div>
                    <button class="action-btn delete delete-inst" data-id="${inst.id}" title="Sil">🗑️</button>
                  </div>
                  <div class="flex-between mb-sm">
                    <span>İlerleme: ${inst.paidCount} / ${inst.installmentCount} taksit</span>
                    <span style="font-weight:600">%${progress.toFixed(0)}</span>
                  </div>
                  <div class="progress-bar-container mb-md">
                    <div class="progress-bar" style="width:${progress}%;background:${progress >= 80 ? 'var(--accent-primary)' : 'var(--accent-warning)'}"></div>
                  </div>
                  <div class="flex-between">
                    <div>
                      <p style="font-size:var(--font-xs);color:var(--text-muted)">Aylık</p>
                      <p style="font-weight:600;color:var(--accent-danger)">${formatCurrency(inst.monthlyAmount)}</p>
                    </div>
                    <div style="text-align:center">
                      <p style="font-size:var(--font-xs);color:var(--text-muted)">Toplam</p>
                      <p style="font-weight:600">${formatCurrency(inst.totalAmount)}</p>
                    </div>
                    <div style="text-align:right">
                      <p style="font-size:var(--font-xs);color:var(--text-muted)">Kalan</p>
                      <p style="font-weight:600;color:var(--accent-warning)">${formatCurrency(inst.remainingAmount)}</p>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      `;

      document.getElementById('addInstBtn')?.addEventListener('click', () => this.showForm());
      this.container.querySelectorAll('.delete-inst').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (confirm('Taksiti ve ilişkili işlemleri silmek istiyor musunuz?')) {
            await api.deleteInstallment(btn.dataset.id);
            this.onToast('Taksit silindi', 'success');
            this.render();
          }
        });
      });
    } catch (err) {
      this.container.innerHTML = '<div class="empty-state"><p>Taksitler yüklenemedi</p></div>';
      console.error(err);
    }
  }

  showForm() {
    const catOpts = this.categories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
    const ccOpts = this.creditCards.map(c => `<option value="${c.id}">💳 ${c.name}</option>`).join('');
    const now = new Date();
    this.openModal('Taksit Ekle', `
      <form id="addInstForm">
        <div class="form-group">
          <label class="form-label">Taksit Adı</label>
          <input class="form-input" name="name" placeholder="Örn: iPhone 15 Pro" required>
        </div>
        <div class="form-group">
          <label class="form-label">Kredi Kartı</label>
          <select class="form-select" name="creditCardId">
            <option value="">— Kart seçin —</option>
            ${ccOpts}
          </select>
          <p style="font-size:var(--font-xs);color:var(--text-muted);margin-top:var(--space-xs)">
            Taksit bu kartın borcuna dahil edilir, ayrı borç olarak sayılmaz
          </p>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Toplam Tutar (₺)</label>
            <input class="form-input" type="number" name="totalAmount" step="0.01" min="0" required>
          </div>
          <div class="form-group">
            <label class="form-label">Taksit Sayısı</label>
            <input class="form-input" type="number" name="installmentCount" min="1" max="60" value="3" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Ödenen Taksit</label>
            <input class="form-input" type="number" name="paidCount" min="0" value="0">
          </div>
          <div class="form-group">
            <label class="form-label">Kategori</label>
            <select class="form-select" name="category">${catOpts}</select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Başlangıç Yılı</label>
            <input class="form-input" type="number" name="startYear" value="${now.getFullYear()}">
          </div>
          <div class="form-group">
            <label class="form-label">Başlangıç Ayı</label>
            <select class="form-select" name="startMonth">
              ${MONTH_NAMES.map((m, i) => `<option value="${i + 1}" ${i + 1 === now.getMonth() + 1 ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" id="cancelInstBtn">İptal</button>
          <button type="submit" class="btn btn-primary">Kaydet</button>
        </div>
      </form>
    `);

    document.getElementById('cancelInstBtn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('addInstForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await api.addInstallment({
          name: f.name.value, totalAmount: parseFloat(f.totalAmount.value),
          installmentCount: parseInt(f.installmentCount.value), paidCount: parseInt(f.paidCount.value),
          creditCardId: f.creditCardId.value || null,
          category: f.category.value, startYear: parseInt(f.startYear.value), startMonth: parseInt(f.startMonth.value)
        });
        this.onToast('Taksit eklendi!', 'success');
        this.closeModal();
        this.render();
      } catch (err) { this.onToast('Hata: ' + err.message, 'error'); }
    });
  }
}
