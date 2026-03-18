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
    this.container.innerHTML = '<div class="text-center mt-lg" style="color:var(--text-muted)">Yükleniyor...</div>';
    try {
      this.goals = await api.getGoals();
      this.container.innerHTML = this.renderPage();
      this.bindEvents();
    } catch (err) {
      this.container.innerHTML = `<div class="empty-state"><p>Hata: ${err.message}</p></div>`;
    }
  }

  renderPage() {
    return `
      <div class="section-header" style="display:flex;justify-content:space-between;align-items:center">
        <h2 class="section-title">🎯 Birikim Hedefleri</h2>
        <button class="btn" id="btnAddGoal" style="background:var(--accent-primary);color:white">+ Yeni Hedef</button>
      </div>

      ${this.goals.length === 0 ? `
        <div class="empty-state"><p>Henüz hedef eklenmemiş. İlk hedefini oluştur!</p></div>
      ` : `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:var(--space-md)">
          ${this.goals.map(g => this.renderGoalCard(g)).join('')}
        </div>
      `}

      <div class="card fade-in mt-lg">
        <h3 style="font-weight:700;margin-bottom:var(--space-md)">🧮 Ters Hesaplama</h3>
        <p style="font-size:var(--font-sm);color:var(--text-secondary);margin-bottom:var(--space-md)">Hedef tutar ve süre gir, aylık ne kadar biriktirmen gerektiğini hesapla.</p>
        <div style="display:flex;gap:var(--space-md);flex-wrap:wrap;align-items:flex-end">
          <div><label style="font-size:var(--font-xs);color:var(--text-muted);display:block;margin-bottom:4px">Hedef Tutar (₺)</label>
            <input type="number" id="rcTarget" value="100000" min="0" step="10000" style="padding:var(--space-sm);border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text-primary);width:150px"></div>
          <div><label style="font-size:var(--font-xs);color:var(--text-muted);display:block;margin-bottom:4px">Süre (ay)</label>
            <input type="number" id="rcMonths" value="12" min="1" max="120" style="padding:var(--space-sm);border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text-primary);width:100px"></div>
          <button class="btn" id="btnReverseCalc" style="background:var(--accent-primary);color:white">Hesapla</button>
        </div>
        <div id="reverseResult" style="margin-top:var(--space-md)"></div>
      </div>
    `;
  }

  renderGoalCard(g) {
    const percent = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount || 0) / g.targetAmount * 100)) : 0;
    const remaining = Math.max(0, g.targetAmount - (g.currentAmount || 0));
    const color = percent >= 100 ? 'var(--accent-primary)' : percent >= 50 ? 'var(--accent-warning)' : 'var(--accent-danger)';

    return `
      <div class="card fade-in" style="border-top:4px solid ${color}">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div>
            <h3 style="font-weight:700;font-size:var(--font-md)">${g.icon || '🎯'} ${g.name}</h3>
            <p style="font-size:var(--font-xs);color:var(--text-muted)">${g.description || ''}</p>
          </div>
          <div style="display:flex;gap:var(--space-xs)">
            <button class="btn btn-ghost btn-sm goal-sim" data-id="${g.id}" title="Simüle et">📊</button>
            <button class="btn btn-ghost btn-sm goal-del" data-id="${g.id}" title="Sil" style="color:var(--accent-danger)">✕</button>
          </div>
        </div>
        <div style="margin:var(--space-md) 0">
          <div style="display:flex;justify-content:space-between;font-size:var(--font-xs);margin-bottom:4px">
            <span>${formatCurrency(g.currentAmount || 0)}</span>
            <span>${formatCurrency(g.targetAmount)}</span>
          </div>
          <div style="background:var(--surface-2);border-radius:6px;height:12px;overflow:hidden">
            <div style="width:${percent}%;height:100%;background:${color};border-radius:6px;transition:width 0.5s"></div>
          </div>
          <div style="text-align:center;font-size:var(--font-sm);font-weight:700;color:${color};margin-top:var(--space-xs)">%${percent}</div>
        </div>
        <div style="font-size:var(--font-xs);color:var(--text-secondary)">
          Kalan: ${formatCurrency(remaining)}
          ${g.targetDate ? ` | Hedef: ${g.targetDate}` : ''}
        </div>
        <div style="margin-top:var(--space-sm)">
          <input type="number" class="goal-add-input" data-id="${g.id}" placeholder="Ekle..." min="0" style="width:100px;padding:4px 8px;border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text-primary);font-size:var(--font-xs)">
          <button class="btn btn-ghost btn-sm goal-add-btn" data-id="${g.id}" style="font-size:var(--font-xs)">+ Ekle</button>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Yeni hedef
    this.container.querySelector('#btnAddGoal')?.addEventListener('click', () => {
      this.helpers.openModal('Yeni Hedef', `
        <div style="display:flex;flex-direction:column;gap:var(--space-md)">
          <input id="goalName" placeholder="Hedef adı" style="padding:var(--space-sm);border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text-primary)">
          <input id="goalTarget" type="number" placeholder="Hedef tutar" style="padding:var(--space-sm);border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text-primary)">
          <input id="goalDate" type="date" style="padding:var(--space-sm);border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text-primary)">
          <input id="goalIcon" placeholder="Emoji (opsiyonel)" value="🎯" style="padding:var(--space-sm);border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text-primary)">
          <button class="btn" id="btnSaveGoal" style="background:var(--accent-primary);color:white">Kaydet</button>
        </div>
      `);
      setTimeout(() => {
        document.getElementById('btnSaveGoal')?.addEventListener('click', async () => {
          const name = document.getElementById('goalName').value;
          const targetAmount = parseFloat(document.getElementById('goalTarget').value) || 0;
          const targetDate = document.getElementById('goalDate').value || null;
          const icon = document.getElementById('goalIcon').value || '🎯';
          if (!name || !targetAmount) return;
          await api.addGoal({ name, targetAmount, targetDate, icon });
          this.helpers.closeModal();
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
        if (amount <= 0) return;
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
            <div style="font-size:var(--font-sm)">
              <p style="margin-bottom:var(--space-md)">${sim.message}</p>
              <div class="stats-grid">
                <div class="stat-card"><div class="stat-value" style="font-size:var(--font-md)">%${sim.percent}</div><div class="stat-label">İlerleme</div></div>
                <div class="stat-card"><div class="stat-value" style="font-size:var(--font-md)">${sim.monthsNeeded} ay</div><div class="stat-label">Kalan süre</div></div>
                <div class="stat-card"><div class="stat-value" style="font-size:var(--font-md)">${formatCurrency(sim.monthlySavings)}</div><div class="stat-label">Aylık tasarruf</div></div>
              </div>
            </div>
          `);
        } catch (err) { this.helpers.onToast('Simülasyon hatası', 'error'); }
      });
    });

    // Sil
    this.container.querySelectorAll('.goal-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        await api.deleteGoal(btn.dataset.id);
        this.render();
      });
    });

    // Ters hesaplama
    this.container.querySelector('#btnReverseCalc')?.addEventListener('click', async () => {
      const targetAmount = parseFloat(this.container.querySelector('#rcTarget').value) || 100000;
      const targetMonths = parseInt(this.container.querySelector('#rcMonths').value) || 12;
      try {
        const result = await api.postGoalReverseCalc({ targetAmount, targetMonths });
        const color = result.feasible ? 'var(--accent-primary)' : 'var(--accent-danger)';
        this.container.querySelector('#reverseResult').innerHTML = `
          <div style="padding:var(--space-md);background:var(--surface-2);border-radius:var(--radius-sm);border-left:4px solid ${color}">
            <p style="font-size:var(--font-sm);font-weight:700;color:${color}">${result.feasible ? '✅ Mümkün' : '❌ Yetersiz bütçe'}</p>
            <p style="font-size:var(--font-sm);margin-top:var(--space-xs)">${result.message}</p>
          </div>
        `;
      } catch (err) { this.container.querySelector('#reverseResult').innerHTML = `<p style="color:var(--accent-danger)">Hata: ${err.message}</p>`; }
    });
  }
}
