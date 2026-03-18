// ═══════════════════════════════════════════════════════════════════
// NotesPage — Informal obligations, verbal commitments, hand-to-hand
// ═══════════════════════════════════════════════════════════════════

import { api } from '../services/ApiService.js';
import { formatCurrency } from '../utils/formatters.js';

export class NotesPage {
  constructor(container, { onToast, openModal, closeModal }) {
    this.container = container;
    this.onToast = onToast;
    this.openModal = openModal;
    this.closeModal = closeModal;
  }

  async render() {
    try {
      const [notes, categories] = await Promise.all([api.getNotes(), api.getCategories()]);
      this.categories = categories;

      const active = notes.filter(n => !n.convertedToRecord);
      const converted = notes.filter(n => n.convertedToRecord);
      const totalObl = active.filter(n => n.isObligation).reduce((s, n) => s + n.amount, 0);

      this.container.innerHTML = `
        <div class="section-header">
          <h2 class="section-title">Notlar & Yükümlülükler</h2>
          <button class="btn btn-primary" id="addNoteBtn">+ Not Ekle</button>
        </div>

        <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
          <div class="card stat-card fade-in"><div class="stat-icon">📝</div><p class="card-title">Aktif Notlar</p><p class="card-value">${active.length}</p></div>
          <div class="card stat-card fade-in"><div class="stat-icon">⚠️</div><p class="card-title">Yükümlülükler</p><p class="card-value" style="color:var(--accent-warning)">${formatCurrency(totalObl)}</p></div>
          <div class="card stat-card fade-in"><div class="stat-icon">✅</div><p class="card-title">Dönüştürülen</p><p class="card-value">${converted.length}</p></div>
        </div>

        ${active.length === 0 ? `
          <div class="card mt-lg text-center" style="padding:var(--space-2xl)">
            <p style="font-size:2rem;margin-bottom:var(--space-md)">📝</p>
            <p style="color:var(--text-muted)">Gayri resmi yükümlülüklerinizi, sözel anlaşmalarınızı ve notlarınızı buraya ekleyin</p>
          </div>
        ` : `
          <div class="mt-lg" style="display:grid;gap:var(--space-md)">
            ${active.map(note => {
              const cat = categories.find(c => c.id === note.category);
              const freqLabels = { once: 'Tek Seferlik', monthly: 'Aylık', custom: 'Özel' };
              return `
                <div class="card fade-in" style="${note.isObligation ? 'border-left:3px solid var(--accent-warning)' : ''}">
                  <div class="flex-between mb-sm">
                    <h3 style="font-weight:700">${note.isObligation ? '⚠️' : '📝'} ${note.title}</h3>
                    <div style="display:flex;gap:var(--space-sm)">
                      ${note.amount > 0 ? `<button class="btn btn-outline btn-sm convert-note" data-id="${note.id}" data-freq="${note.frequency}">🔄 Kayda Dönüştür</button>` : ''}
                      <button class="action-btn delete delete-note" data-id="${note.id}">🗑️</button>
                    </div>
                  </div>
                  ${note.content ? `<p style="font-size:var(--font-sm);color:var(--text-secondary);margin-bottom:var(--space-sm)">${note.content}</p>` : ''}
                  <div class="flex gap-lg" style="font-size:var(--font-xs);color:var(--text-muted)">
                    ${note.amount > 0 ? `<span>💰 ${formatCurrency(note.amount)}</span>` : ''}
                    <span>📅 ${freqLabels[note.frequency] || note.frequency}</span>
                    ${cat ? `<span>${cat.icon} ${cat.name}</span>` : ''}
                    <span style="color:var(--text-muted)">${new Date(note.createdAt).toLocaleDateString('tr-TR')}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}

        ${converted.length > 0 ? `
          <div class="card mt-lg fade-in" style="opacity:0.7">
            <h3 class="card-title">Dönüştürülmüş Notlar</h3>
            ${converted.map(n => `<p style="font-size:var(--font-sm);color:var(--text-muted)">✅ ${n.title} — ${formatCurrency(n.amount)}</p>`).join('')}
          </div>
        ` : ''}
      `;

      this.bindEvents();
    } catch (err) {
      this.container.innerHTML = '<div class="empty-state"><p>Notlar yüklenemedi</p></div>';
      console.error(err);
    }
  }

  bindEvents() {
    document.getElementById('addNoteBtn')?.addEventListener('click', () => this.showForm());
    this.container.querySelectorAll('.delete-note').forEach(btn => {
      btn.addEventListener('click', async () => {
        await api.deleteNote(btn.dataset.id);
        this.onToast('Not silindi', 'success');
        this.render();
      });
    });
    this.container.querySelectorAll('.convert-note').forEach(btn => {
      btn.addEventListener('click', async () => {
        const freq = btn.dataset.freq;
        const data = freq === 'monthly' ? { durationMonths: 12 } : {};
        await api.convertNote(btn.dataset.id, data);
        this.onToast(freq === 'monthly' ? 'Tekrarlayan gider olarak eklendi' : 'İşlem olarak eklendi', 'success');
        this.render();
      });
    });
  }

  showForm() {
    const catOpts = this.categories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
    this.openModal('Not/Yükümlülük Ekle', `
      <form id="addNoteForm">
        <div class="form-group">
          <label class="form-label">Başlık</label>
          <input class="form-input" name="title" placeholder="Örn: Komşuya borç, Elden taksit" required>
        </div>
        <div class="form-group">
          <label class="form-label">Açıklama</label>
          <textarea class="form-input" name="content" rows="3" placeholder="Detaylar..."></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tutar (₺)</label>
            <input class="form-input" type="number" name="amount" step="0.01" min="0" value="0">
          </div>
          <div class="form-group">
            <label class="form-label">Sıklık</label>
            <select class="form-select" name="frequency">
              <option value="once">Tek Seferlik</option>
              <option value="monthly">Aylık</option>
              <option value="custom">Özel</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Kategori</label>
            <select class="form-select" name="category">${catOpts}</select>
          </div>
          <div class="form-group">
            <label class="form-label" style="display:flex;align-items:center;gap:var(--space-sm)">
              <input type="checkbox" name="isObligation"> Bu bir yükümlülük
            </label>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" id="cancelNoteBtn">İptal</button>
          <button type="submit" class="btn btn-primary">Kaydet</button>
        </div>
      </form>
    `);

    document.getElementById('cancelNoteBtn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('addNoteForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await api.addNote({
          title: f.title.value, content: f.content.value,
          amount: parseFloat(f.amount.value), frequency: f.frequency.value,
          category: f.category.value, isObligation: f.isObligation.checked
        });
        this.onToast('Not eklendi!', 'success');
        this.closeModal();
        this.render();
      } catch (err) { this.onToast('Hata: ' + err.message, 'error'); }
    });
  }
}
