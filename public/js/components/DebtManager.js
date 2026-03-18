// ═══════════════════════════════════════════════════════════════════
// DebtManager Component — Debt cards, interest simulation, payoff strategies
// ═══════════════════════════════════════════════════════════════════

import { api } from '../services/ApiService.js';
import { formatCurrency, formatPercentage } from '../utils/formatters.js';
import { DEBT_TYPE_LABELS } from '../utils/constants.js';

export class DebtManager {
  constructor(container, { onToast, openModal, closeModal }) {
    this.container = container;
    this.onToast = onToast;
    this.openModal = openModal;
    this.closeModal = closeModal;
  }

  async render() {
    this.container.innerHTML = '<div class="loading">Yükleniyor...</div>';

    try {
      const [debts, analysis] = await Promise.all([
        api.getDebts(),
        api.getDebtAnalysis(0)
      ]);

      this.container.innerHTML = `
        <div class="section-header">
          <h2 class="section-title">Borç Yönetimi</h2>
          <button class="btn btn-primary" id="addDebtBtn">+ Borç Ekle</button>
        </div>
        ${this.renderDebtCards(debts, analysis)}
        ${this.renderStrategyComparison(analysis)}
        ${this.renderSimulator(debts)}
      `;

      this.bindEvents(debts);
    } catch (err) {
      this.container.innerHTML = '<div class="empty-state"><p>Veri yüklenemedi</p></div>';
      console.error(err);
    }
  }

  renderDebtCards(debts, analysis) {
    if (debts.length === 0) {
      return `
        <div class="empty-state card">
          <div class="empty-state-icon">🎉</div>
          <p class="empty-state-text">Hiç borç kaydı yok — harika!</p>
        </div>
      `;
    }

    return `
      <div class="debt-grid">
        ${debts.map(debt => {
          const debtAnalysis = analysis.debts.find(d => d.debtId === debt.id) || {};
          const monthlyInterest = debtAnalysis.monthlyInterest || 0;
          return `
            <div class="card debt-card fade-in">
              <div class="flex-between mb-md">
                <h3 style="font-weight:700">${debt.name}</h3>
                <span class="debt-type-badge">${DEBT_TYPE_LABELS[debt.type] || debt.type}</span>
              </div>
              <div class="debt-balance">${formatCurrency(debt.currentBalance)}</div>
              <div class="debt-meta">
                <div class="debt-meta-item">
                  <span class="debt-meta-label">Faiz Oranı</span>
                  <span class="debt-meta-value">${formatPercentage(debt.interestRate)}</span>
                </div>
                <div class="debt-meta-item">
                  <span class="debt-meta-label">Aylık Faiz</span>
                  <span class="debt-meta-value" style="color:var(--accent-danger)">${formatCurrency(monthlyInterest)}</span>
                </div>
                <div class="debt-meta-item">
                  <span class="debt-meta-label">Min. Ödeme</span>
                  <span class="debt-meta-value">${formatCurrency(debt.minPayment)}</span>
                </div>
                <div class="debt-meta-item">
                  <span class="debt-meta-label">Min. ile Kapanış</span>
                  <span class="debt-meta-value">${
                    debtAnalysis.minPaymentMonths === Infinity || !debtAnalysis.minPaymentMonths
                      ? '∞'
                      : debtAnalysis.minPaymentMonths + ' ay'
                  }</span>
                </div>
              </div>
              <div class="flex gap-sm mt-md">
                <button class="btn btn-outline btn-sm delete-debt" data-id="${debt.id}" style="flex:1">🗑️ Sil</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderStrategyComparison(analysis) {
    if (!analysis.debts || analysis.debts.length === 0) return '';

    const { snowball, avalanche } = analysis;
    const bestStrategy = avalanche.totalInterest <= snowball.totalInterest ? 'avalanche' : 'snowball';

    return `
      <div class="section-header mt-lg">
        <h2 class="section-title">Ödeme Stratejileri</h2>
      </div>
      <div class="strategy-comparison">
        <div class="card strategy-card ${bestStrategy === 'snowball' ? 'recommended' : ''} fade-in">
          ${bestStrategy === 'snowball' ? '<span class="strategy-badge">🏆 Önerilen</span>' : ''}
          <h3 style="font-weight:700;margin-bottom:var(--space-md)">❄️ Snowball</h3>
          <p style="font-size:var(--font-sm);color:var(--text-muted);margin-bottom:var(--space-lg)">
            Önce en küçük borcu kapatır, motivasyonu artırır
          </p>
          <div class="debt-meta" style="border-top:none;padding-top:0">
            <div class="debt-meta-item">
              <span class="debt-meta-label">Toplam Süre</span>
              <span class="debt-meta-value">${snowball.totalMonths} ay</span>
            </div>
            <div class="debt-meta-item">
              <span class="debt-meta-label">Toplam Faiz</span>
              <span class="debt-meta-value" style="color:var(--accent-danger)">${formatCurrency(snowball.totalInterest)}</span>
            </div>
          </div>
        </div>
        <div class="card strategy-card ${bestStrategy === 'avalanche' ? 'recommended' : ''} fade-in">
          ${bestStrategy === 'avalanche' ? '<span class="strategy-badge">🏆 Önerilen</span>' : ''}
          <h3 style="font-weight:700;margin-bottom:var(--space-md)">🏔️ Avalanche</h3>
          <p style="font-size:var(--font-sm);color:var(--text-muted);margin-bottom:var(--space-lg)">
            Önce en yüksek faizli borcu kapatır, toplam faizi azaltır
          </p>
          <div class="debt-meta" style="border-top:none;padding-top:0">
            <div class="debt-meta-item">
              <span class="debt-meta-label">Toplam Süre</span>
              <span class="debt-meta-value">${avalanche.totalMonths} ay</span>
            </div>
            <div class="debt-meta-item">
              <span class="debt-meta-label">Toplam Faiz</span>
              <span class="debt-meta-value" style="color:var(--accent-danger)">${formatCurrency(avalanche.totalInterest)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderSimulator(debts) {
    if (debts.length === 0) return '';

    return `
      <div class="card simulator-card mt-lg fade-in">
        <h3 class="card-title" style="margin-bottom:var(--space-lg)">💡 Faiz Simülasyonu</h3>
        <p style="font-size:var(--font-sm);color:var(--text-muted);margin-bottom:var(--space-lg)">
          Ek ödeme yaparsanız ne kadar faiz tasarruf edersiniz?
        </p>
        <div class="simulator-input-group">
          <div class="form-group">
            <label class="form-label">Aylık Ek Ödeme (₺)</label>
            <input class="form-input" type="number" id="extraPaymentInput" value="1000" step="100" min="0">
          </div>
          <button class="btn btn-primary" id="simulateBtn">Hesapla</button>
        </div>
        <div id="simulatorResults"></div>
      </div>
    `;
  }

  bindEvents(debts) {
    document.getElementById('addDebtBtn')?.addEventListener('click', () => this.showAddForm());

    this.container.querySelectorAll('.delete-debt').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Bu borcu silmek istediğinize emin misiniz?')) {
          await api.deleteDebt(btn.dataset.id);
          this.onToast('Borç silindi', 'success');
          this.render();
        }
      });
    });

    document.getElementById('simulateBtn')?.addEventListener('click', async () => {
      const extra = parseFloat(document.getElementById('extraPaymentInput').value) || 0;
      try {
        const analysis = await api.getDebtAnalysis(extra);
        const resultsEl = document.getElementById('simulatorResults');

        resultsEl.innerHTML = `
          <div class="simulator-results">
            ${analysis.debts.map(d => `
              <div class="sim-result">
                <div style="font-size:var(--font-sm);color:var(--text-muted);margin-bottom:var(--space-sm)">${d.name}</div>
                <div class="sim-result-value" style="color:var(--accent-primary)">
                  ${d.extraPaymentMonths ? d.extraPaymentMonths + ' ay' : '—'}
                </div>
                <div class="sim-result-label">Kapanış Süresi</div>
                ${d.interestSaved ? `<div style="margin-top:var(--space-sm);font-size:var(--font-sm);color:var(--accent-primary)">💰 ${formatCurrency(d.interestSaved)} faiz tasarrufu</div>` : ''}
              </div>
            `).join('')}
          </div>
        `;
      } catch (err) {
        this.onToast('Hesaplama hatası', 'error');
      }
    });
  }

  showAddForm() {
    this.openModal('Yeni Borç Ekle', `
      <form id="addDebtForm">
        <div class="form-group">
          <label class="form-label">Borç Adı</label>
          <input class="form-input" type="text" name="name" placeholder="Örn: Yapı Kredi Kartı" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tür</label>
            <select class="form-select" name="type">
              <option value="credit_card">Kredi Kartı</option>
              <option value="overdraft">Ek Hesap</option>
              <option value="loan">Kredi</option>
              <option value="installment">Taksit</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Faiz Oranı (Yıllık %)</label>
            <input class="form-input" type="number" name="interestRate" step="0.01" value="0" min="0">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Mevcut Bakiye (₺)</label>
            <input class="form-input" type="number" name="currentBalance" step="0.01" min="0" required>
          </div>
          <div class="form-group">
            <label class="form-label">Min. Ödeme (₺)</label>
            <input class="form-input" type="number" name="minPayment" step="0.01" min="0" value="0">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Başlangıç Bakiye (₺)</label>
          <input class="form-input" type="number" name="principalAmount" step="0.01" min="0" value="0">
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" id="cancelDebtBtn">İptal</button>
          <button type="submit" class="btn btn-primary">Kaydet</button>
        </div>
      </form>
    `);

    document.getElementById('cancelDebtBtn')?.addEventListener('click', () => this.closeModal());

    document.getElementById('addDebtForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const data = {
        name: form.name.value,
        type: form.type.value,
        interestRate: parseFloat(form.interestRate.value),
        currentBalance: parseFloat(form.currentBalance.value),
        minPayment: parseFloat(form.minPayment.value),
        principalAmount: parseFloat(form.principalAmount.value)
      };

      try {
        await api.addDebt(data);
        this.onToast('Borç eklendi!', 'success');
        this.closeModal();
        this.render();
      } catch (err) {
        this.onToast('Hata: ' + err.message, 'error');
      }
    });
  }
}
