// ═══════════════════════════════════════════════════════════════════
// GoalsPage — Birikim Hedefleri (Faz 6)
// ═══════════════════════════════════════════════════════════════════

import { api } from '../services/ApiService.js';
import { formatCurrency } from '../utils/formatters.js';

export class GoalsPage {
  constructor(container, helpers) {
    this.container = container;
    this.helpers = helpers;
  }

  async render() {
    this.container.innerHTML = '<div class="loading">Hedefler yükleniyor...</div>';
    try {
      this.goals = await api.getGoals();
      this.container.innerHTML = this.renderPage();
      this.bindEvents();
    } catch (err) {
      this.container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🎯</div><p class="empty-state-text">Hedefler yüklenemedi: ${err.message}</p></div>`;
    }
  }

  renderPage() {
    return `
      <div class="section-header">
        <h2 class="section-title">Birikim Hedefleri</h2>
        <button class="btn btn-primary" id="btnAddGoal">+ Yeni Hedef</button>
      </div>

      ${this.goals.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">🎯</div>
          <p class="empty-state-text">Henüz hedef eklenmemiş</p>
          <p class="card-subtitle">İlk birikim hedefini oluşturmak için yukarıdaki butona tıkla</p>
        </div>
      ` : `
        <div class="goal-grid">
          ${this.goals.map(g => this.renderGoalCard(g)).join('')}
        </div>
      `}

      <div class="card fade-in mt-lg">
        <div class="card-header">
          <h3 class="card-title">Ters Hesaplama</h3>
        </div>
        <p class="card-subtitle mb-md">Hedef tutar ve süre gir, aylık ne kadar biriktirmen gerektiğini hesapla.</p>
        <div class="inline-form">
          <div class="field">
            <label>Hedef Tutar (₺)</label>
            <input type="number" id="rcTarget" value="100000" min="0" step="10000">
          </div>
          <div class="field">
            <label>Süre (ay)</label>
            <input type="number" id="rcMonths" value="12" min="1" max="120">
          </div>
          <button class="btn btn-primary" id="btnReverseCalc">Hesapla</button>
        </div>
        <div id="reverseResult" class="mt-md"></div>
      </div>
    `;
  }

  renderGoalCard(g) {
    const percent = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount || 0) / g.targetAmount * 100)) : 0;
    const remaining = Math.max(0, g.targetAmount - (g.currentAmount || 0));
    const colorClass = percent >= 100 ? 'badge-success' : percent >= 50 ? 'badge-warning' : 'badge-danger';
    const barColor = percent >= 100 ? 'var(--accent-primary)' : percent >= 50 ? 'var(--accent-warning)' : 'var(--accent-danger)';

    return `
      <div class="card fade-in">
        <div class="card-header">
          <div>
            <h3 class="section-title">${g.icon || '🎯'} ${g.name}</h3>
            ${g.description ? `<p class="card-subtitle">${g.description}</p>` : ''}
          </div>
          <div class="action-pair">
            <button class="btn btn-ghost btn-sm goal-sim" data-id="${g.id}" title="Simüle et">📊</button>
            <button class="btn btn-ghost btn-sm btn-danger goal-del" data-id="${g.id}" title="Sil">✕</button>
          </div>
        </div>
        <div class="goal-progress">
          <div class="flex-between mb-sm" style="font-size:var(--font-xs)">
            <span>${formatCurrency(g.currentAmount || 0)}</span>
            <span>${formatCurrency(g.targetAmount)}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${percent}%;background:${barColor}"></div>
          </div>
          <div class="text-center mt-sm">
            <span class="badge ${colorClass}">%${percent}</span>
          </div>
        </div>
        <p class="card-subtitle">
          Kalan: ${formatCurrency(remaining)}
          ${g.targetDate ? ` · Hedef: ${g.targetDate}` : ''}
        </p>
        <div class="inline-form mt-sm">
          <div class="field">
            <input type="number" class="goal-add-input" data-id="${g.id}" placeholder="Tutar ekle..." min="0">
          </div>
          <button class="btn btn-sm btn-primary goal-add-btn" data-id="${g.id}">+ Ekle</button>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Yeni hedef
    this.container.querySelector('#btnAddGoal')?.addEventListener('click', () => {
      this.helpers.openModal('Yeni Hedef', `
        <div class="form-group">
          <label class="form-label">Hedef Adı</label>
          <input id="goalName" class="form-input" placeholder="Ör: Araba, Tatil, Acil Fon">
        </div>
        <div class="form-group">
          <label class="form-label">Hedef Tutar (₺)</label>
          <input id="goalTarget" type="number" class="form-input" placeholder="100000">
        </div>
        <div class="form-group">
          <label class="form-label">Hedef Tarih</label>
          <input id="goalDate" type="date" class="form-input">
        </div>
        <div class="form-group">
          <label class="form-label">Emoji</label>
          <input id="goalIcon" class="form-input" placeholder="🎯" value="🎯">
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" id="btnSaveGoal">Kaydet</button>
        </div>
      `);
      setTimeout(() => {
        document.getElementById('btnSaveGoal')?.addEventListener('click', async () => {
          const name = document.getElementById('goalName').value;
          const targetAmount = parseFloat(document.getElementById('goalTarget').value) || 0;
          const targetDate = document.getElementById('goalDate').value || null;
          const icon = document.getElementById('goalIcon').value || '🎯';
          if (!name || !targetAmount) {
            this.helpers.onToast('Ad ve hedef tutar gerekli', 'error');
            return;
          }
          await api.addGoal({ name, targetAmount, targetDate, icon });
          this.helpers.closeModal();
          this.helpers.onToast('Hedef oluşturuldu', 'success');
          this.render();
        });
      }, 100);
    });

    // Birikim ekle
    this.container.querySelectorAll('.goal-add-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const input = this.container.querySelector(`.goal-add-input[data-id="${id}"]`);
        const amount = parseFloat(input.value) || 0;
        if (amount <= 0) { this.helpers.onToast('Geçerli bir tutar girin', 'error'); return; }
        const goal = this.goals.find(g => g.id === id);
        if (!goal) return;
        await api.updateGoal(id, { currentAmount: (goal.currentAmount || 0) + amount });
        this.helpers.onToast(`${formatCurrency(amount)} eklendi`, 'success');
        this.render();
      });
    });

    // Simüle et
    this.container.querySelectorAll('.goal-sim').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          const sim = await api.simulateGoal(btn.dataset.id);
          this.helpers.openModal('Hedef Simülasyonu', `
            <p class="card-subtitle mb-md">${sim.message}</p>
            <div class="stats-grid">
              <div class="card stat-card">
                <p class="card-title">İlerleme</p>
                <p class="card-value">%${sim.percent}</p>
              </div>
              <div class="card stat-card">
                <p class="card-title">Kalan Süre</p>
                <p class="card-value">${sim.monthsNeeded} ay</p>
              </div>
              <div class="card stat-card">
                <p class="card-title">Aylık Tasarruf</p>
                <p class="card-value">${formatCurrency(sim.monthlySavings)}</p>
              </div>
            </div>
          `);
        } catch (err) { this.helpers.onToast('Simülasyon hatası', 'error'); }
      });
    });

    // Sil
    this.container.querySelectorAll('.goal-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Bu hedefi silmek istediğine emin misin?')) return;
        await api.deleteGoal(btn.dataset.id);
        this.helpers.onToast('Hedef silindi', 'info');
        this.render();
      });
    });

    // Ters hesaplama
    this.container.querySelector('#btnReverseCalc')?.addEventListener('click', async () => {
      const targetAmount = parseFloat(this.container.querySelector('#rcTarget').value) || 100000;
      const targetMonths = parseInt(this.container.querySelector('#rcMonths').value) || 12;
      try {
        const result = await api.postGoalReverseCalc({ targetAmount, targetMonths });
        const statusClass = result.feasible ? 'badge-success' : 'badge-danger';
        const statusText = result.feasible ? '✅ Ulaşılabilir' : '❌ Yetersiz bütçe';
        this.container.querySelector('#reverseResult').innerHTML = `
          <div class="card">
            <div class="card-header">
              <span class="badge ${statusClass}">${statusText}</span>
            </div>
            <p class="card-subtitle">${result.message}</p>
          </div>
        `;
      } catch (err) {
        this.container.querySelector('#reverseResult').innerHTML = `<div class="card"><p class="card-subtitle" style="color:var(--accent-danger)">Hata: ${err.message}</p></div>`;
      }
    });
  }
}
