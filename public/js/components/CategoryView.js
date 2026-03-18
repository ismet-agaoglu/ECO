// ═══════════════════════════════════════════════════════════════════
// CategoryView Component — Category-based spending breakdown
// ═══════════════════════════════════════════════════════════════════

import { api } from '../services/ApiService.js';
import { formatCurrency, formatMonthYear } from '../utils/formatters.js';

export class CategoryView {
  constructor(container, year, month, { onToast, openModal, closeModal }) {
    this.container = container;
    this.year = year;
    this.month = month;
    this.onToast = onToast;
    this.openModal = openModal;
    this.closeModal = closeModal;
  }

  async render() {
    this.container.innerHTML = '<div class="text-center mt-lg" style="color:var(--text-muted)">Yükleniyor...</div>';

    try {
      const [categorySummary, allCategories] = await Promise.all([
        api.getCategorySummary(this.year, this.month),
        api.getCategories()
      ]);

      const totalExpense = categorySummary.reduce((s, c) => s + c.total, 0);

      this.container.innerHTML = `
        <div class="section-header">
          <h2 class="section-title">Kategori Harcamaları — ${formatMonthYear(this.year, this.month)}</h2>
          <button class="btn btn-outline" id="addCategoryBtn">+ Kategori</button>
        </div>

        ${categorySummary.length === 0 ? `
          <div class="card empty-state">
            <div class="empty-state-icon">📂</div>
            <p class="empty-state-text">Bu ay henüz harcama yok</p>
          </div>
        ` : `
          <div class="card mb-lg fade-in">
            <div class="card-header">
              <h3 class="card-title">Toplam Harcama</h3>
              <span style="font-size:var(--font-xl);font-weight:800;color:var(--accent-danger)">${formatCurrency(totalExpense)}</span>
            </div>
            <div class="bar-chart" style="height:250px;margin-top:var(--space-lg)">
              ${categorySummary.map(cat => {
                const heightPercent = totalExpense > 0 ? (cat.total / totalExpense) * 100 : 0;
                return `
                  <div class="bar-group">
                    <div style="font-size:var(--font-xs);color:var(--text-secondary);font-weight:600">${formatCurrency(cat.total)}</div>
                    <div class="bar" style="height:${Math.max(4, heightPercent)}%;background:${cat.color}"></div>
                    <div class="bar-label">${cat.icon}<br>${cat.name}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="section-header">
            <h3 class="section-title">Detaylı Dağılım</h3>
          </div>
          ${categorySummary.map(cat => {
            const percent = totalExpense > 0 ? ((cat.total / totalExpense) * 100).toFixed(1) : 0;
            return `
              <div class="card mb-md fade-in" style="border-left: 3px solid ${cat.color}">
                <div class="flex-between">
                  <div class="flex gap-md" style="align-items:center">
                    <span style="font-size:1.5rem">${cat.icon}</span>
                    <div>
                      <h4 style="font-weight:600">${cat.name}</h4>
                      <span style="font-size:var(--font-sm);color:var(--text-muted)">${cat.count} işlem • %${percent}</span>
                    </div>
                  </div>
                  <span style="font-size:var(--font-lg);font-weight:700;color:var(--accent-danger)">${formatCurrency(cat.total)}</span>
                </div>
                <div class="progress-bar-container mt-sm">
                  <div class="progress-bar" style="width:${percent}%;background:${cat.color}"></div>
                </div>
              </div>
            `;
          }).join('')}
        `}

        <div class="card mt-lg fade-in">
          <h3 class="card-title" style="margin-bottom:var(--space-lg)">Tüm Kategoriler</h3>
          <div style="display:flex;flex-wrap:wrap;gap:var(--space-sm)">
            ${allCategories.map(cat => `
              <span class="category-badge" style="border:1px solid ${cat.color}30;padding:var(--space-sm) var(--space-md)">
                ${cat.icon} ${cat.name}
              </span>
            `).join('')}
          </div>
        </div>
      `;

      document.getElementById('addCategoryBtn')?.addEventListener('click', () => this.showAddCategoryForm());
    } catch (err) {
      this.container.innerHTML = '<div class="empty-state"><p>Veri yüklenemedi</p></div>';
      console.error(err);
    }
  }

  showAddCategoryForm() {
    const emojis = ['🛒','🏠','💡','🚗','🎬','🏥','📚','👗','🍽️','💳','💰','📈','📦','✈️','🎮','🏋️','🐾','💻','📱','🎁'];

    this.openModal('Yeni Kategori Ekle', `
      <form id="addCategoryForm">
        <div class="form-group">
          <label class="form-label">Kategori Adı</label>
          <input class="form-input" type="text" name="name" placeholder="Örn: Spor" required>
        </div>
        <div class="form-group">
          <label class="form-label">İkon</label>
          <div style="display:flex;flex-wrap:wrap;gap:var(--space-sm)" id="emojiPicker">
            ${emojis.map((e, i) => `
              <button type="button" class="btn btn-outline btn-icon emoji-pick ${i === 0 ? 'active' : ''}" 
                data-emoji="${e}" style="${i === 0 ? 'border-color:var(--accent-primary)' : ''}">${e}</button>
            `).join('')}
          </div>
          <input type="hidden" name="icon" value="${emojis[0]}">
        </div>
        <div class="form-group">
          <label class="form-label">Renk</label>
          <input class="form-input" type="color" name="color" value="#00e5a0" style="height:44px;cursor:pointer">
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" id="cancelCatBtn">İptal</button>
          <button type="submit" class="btn btn-primary">Kaydet</button>
        </div>
      </form>
    `);

    // Emoji picker
    document.getElementById('emojiPicker')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.emoji-pick');
      if (!btn) return;
      document.querySelectorAll('.emoji-pick').forEach(b => {
        b.classList.remove('active');
        b.style.borderColor = '';
      });
      btn.classList.add('active');
      btn.style.borderColor = 'var(--accent-primary)';
      document.querySelector('[name="icon"]').value = btn.dataset.emoji;
    });

    document.getElementById('cancelCatBtn')?.addEventListener('click', () => this.closeModal());

    document.getElementById('addCategoryForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      try {
        await api.addCategory({
          name: form.name.value,
          icon: form.icon.value,
          color: form.color.value
        });
        this.onToast('Kategori eklendi!', 'success');
        this.closeModal();
        this.render();
      } catch (err) {
        this.onToast('Hata: ' + err.message, 'error');
      }
    });
  }
}
