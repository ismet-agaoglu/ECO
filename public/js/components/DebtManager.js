// ═══════════════════════════════════════════════════════════════════
// DebtManager Component — Credit product cards, interest simulation, payoff strategies
// ═══════════════════════════════════════════════════════════════════

import { api } from '../services/ApiService.js';
import { formatCurrency, formatPercentage } from '../utils/formatters.js';
import { DEBT_TYPE_LABELS } from '../utils/constants.js';

/**
 * Borcun bakiyesini frontend tarafında belirler (geriye uyumluluk dahil).
 */
function getBalance(debt) {
  if (debt.type === 'credit_card' || debt.type === 'overdraft') {
    return debt.usedAmount !== undefined ? debt.usedAmount : (debt.currentBalance || 0);
  }
  return debt.currentBalance !== undefined ? debt.currentBalance : (debt.usedAmount || 0);
}

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
      const [debts, analysis, accounts] = await Promise.all([
        api.getDebts(),
        api.getDebtAnalysis(0),
        api.getAccounts()
      ]);

      this.debts = debts;
      this.accounts = accounts;

      const totalAccountBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
      const totalDebt = debts.reduce((s, d) => s + getBalance(d), 0);
      const netWorth = totalAccountBalance - totalDebt;

      this.container.innerHTML = `
        <div class="section-header">
          <h2 class="section-title">Finansal Urunler</h2>
          <div class="flex gap-sm">
            <button class="btn btn-outline" id="addAccountBtn">+ Hesap Ekle</button>
            <button class="btn btn-outline" id="addChargeBtn">+ Borc Ekle</button>
            <button class="btn btn-primary" id="addDebtBtn">+ Urun Ekle</button>
          </div>
        </div>

        <div class="stats-grid mb-lg">
          <div class="card stat-card fade-in">
            <p class="card-title">Toplam Hesap Bakiyesi</p>
            <p class="card-value positive">${formatCurrency(totalAccountBalance)}</p>
          </div>
          <div class="card stat-card fade-in">
            <p class="card-title">Toplam Borc</p>
            <p class="card-value negative">${formatCurrency(totalDebt)}</p>
          </div>
          <div class="card stat-card fade-in">
            <p class="card-title">Net Varlik (Hesaplar - Borclar)</p>
            <p class="card-value" style="color:${netWorth >= 0 ? 'var(--accent-primary)' : 'var(--accent-danger)'}">${formatCurrency(netWorth)}</p>
          </div>
        </div>

        ${this.renderAccountCards(accounts)}
        ${this.renderDebtCards(debts, analysis)}
        ${this.renderStrategyComparison(analysis)}
        ${this.renderSimulator(debts)}
      `;

      this.bindEvents(debts);
      this.bindAccountEvents(accounts);
    } catch (err) {
      this.container.innerHTML = '<div class="empty-state"><p>Veri yüklenemedi</p></div>';
      console.error(err);
    }
  }

  renderAccountCards(accounts) {
    if (accounts.length === 0) {
      return `
        <div class="section-header mt-lg">
          <h3 class="section-title">Banka Hesaplari</h3>
        </div>
        <div class="empty-state card mb-lg">
          <div class="empty-state-icon">🏦</div>
          <p class="empty-state-text">Henuz banka hesabi eklenmedi</p>
        </div>
      `;
    }

    return `
      <div class="section-header mt-lg">
        <h3 class="section-title">Banka Hesaplari</h3>
      </div>
      <div class="debt-grid mb-lg">
        ${accounts.map(acc => `
          <div class="card debt-card fade-in">
            <div class="flex-between mb-md">
              <h3 style="font-weight:700">${acc.icon || '🏦'} ${acc.name}</h3>
              <span class="debt-type-badge">${acc.type === 'savings' ? 'Birikim' : 'Vadesiz'}</span>
            </div>
            <div class="debt-meta">
              <div class="debt-meta-item">
                <span class="debt-meta-label">Banka</span>
                <span class="debt-meta-value">${acc.bankName || '-'}</span>
              </div>
              <div class="debt-meta-item">
                <span class="debt-meta-label">Bakiye</span>
                <span class="debt-meta-value" style="color:var(--accent-primary)">${formatCurrency(acc.balance || 0)}</span>
              </div>
            </div>
            <div class="flex gap-sm mt-md">
              <button class="btn btn-primary btn-sm deposit-account" data-id="${acc.id}" data-action="deposit" style="flex:1">+ Para Ekle</button>
              <button class="btn btn-outline btn-sm deposit-account" data-id="${acc.id}" data-action="withdraw" style="flex:1">- Para Cek</button>
            </div>
            <div class="flex gap-sm mt-sm">
              <button class="btn btn-outline btn-sm edit-account" data-id="${acc.id}" style="flex:1">Duzenle</button>
              <button class="btn btn-outline btn-sm delete-account" data-id="${acc.id}" style="flex:1">Sil</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  bindAccountEvents(accounts) {
    document.getElementById('addAccountBtn')?.addEventListener('click', () => this.showAddAccountForm());

    this.container.querySelectorAll('.deposit-account').forEach(btn => {
      btn.addEventListener('click', () => {
        const acc = accounts.find(a => a.id === btn.dataset.id);
        const action = btn.dataset.action;
        if (acc) this.showDepositForm(acc, action);
      });
    });

    this.container.querySelectorAll('.edit-account').forEach(btn => {
      btn.addEventListener('click', () => {
        const acc = accounts.find(a => a.id === btn.dataset.id);
        if (acc) this.showEditAccountForm(acc);
      });
    });

    this.container.querySelectorAll('.delete-account').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Bu hesabi silmek istediginize emin misiniz?')) {
          await api.deleteAccount(btn.dataset.id);
          this.onToast('Hesap silindi', 'success');
          this.render();
        }
      });
    });
  }

  showAddAccountForm() {
    const today = new Date().toISOString().split('T')[0];
    this.openModal('Banka Hesabi Ekle', `
      <form id="addAccountForm">
        <div class="form-group">
          <label class="form-label">Hesap Adi</label>
          <input class="form-input" type="text" name="name" placeholder="Orn: Garanti Vadesiz" required>
        </div>
        <div class="form-group">
          <label class="form-label">Banka Adi</label>
          <input class="form-input" type="text" name="bankName" placeholder="Orn: Garanti BBVA">
        </div>
        <div class="form-group">
          <label class="form-label">Baslangic Bakiye (TL)</label>
          <input class="form-input" type="number" name="balance" step="1" min="0" value="0">
        </div>
        <div class="form-group">
          <label class="form-label">Hesap Turu</label>
          <select class="form-select" name="type">
            <option value="checking">Vadesiz Hesap</option>
            <option value="savings">Birikim Hesabi</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Ikon</label>
          <select class="form-select" name="icon">
            <option value="🏦">🏦 Banka</option>
            <option value="💰">💰 Para</option>
            <option value="🏧">🏧 ATM</option>
            <option value="💵">💵 Nakit</option>
            <option value="🪙">🪙 Birikim</option>
          </select>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" id="cancelAccountBtn">Iptal</button>
          <button type="submit" class="btn btn-primary">Kaydet</button>
        </div>
      </form>
    `);

    document.getElementById('cancelAccountBtn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('addAccountForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const data = {
        name: form.name.value,
        bankName: form.bankName.value,
        balance: parseFloat(form.balance.value) || 0,
        type: form.type.value,
        icon: form.icon.value
      };
      try {
        await api.addAccount(data);
        this.onToast('Hesap eklendi!', 'success');
        this.closeModal();
        this.render();
      } catch (err) {
        this.onToast('Hata: ' + err.message, 'error');
      }
    });
  }

  showDepositForm(account, action) {
    const isDeposit = action === 'deposit';
    const title = isDeposit ? `${account.name} — Para Ekle` : `${account.name} — Para Cek`;
    const today = new Date().toISOString().split('T')[0];

    this.openModal(title, `
      <form id="depositForm">
        <div class="form-group">
          <label class="form-label">Tutar (TL)</label>
          <input class="form-input" type="number" name="amount" step="1" min="1" required>
        </div>
        <div class="form-group">
          <label class="form-label">Aciklama</label>
          <input class="form-input" type="text" name="description" placeholder="Orn: Maas yatirma">
        </div>
        <div class="form-group">
          <label class="form-label">Tarih</label>
          <input class="form-input" type="date" name="date" value="${today}">
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" id="cancelDepositBtn">Iptal</button>
          <button type="submit" class="btn btn-primary">${isDeposit ? 'Para Ekle' : 'Para Cek'}</button>
        </div>
      </form>
    `);

    document.getElementById('cancelDepositBtn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('depositForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const amount = parseFloat(form.amount.value) || 0;
      const data = {
        amount: isDeposit ? amount : -amount,
        description: form.description.value || '',
        date: form.date.value
      };
      try {
        await api.depositAccount(account.id, data);
        this.onToast(`${formatCurrency(amount)} ${isDeposit ? 'eklendi' : 'cekildi'}`, 'success');
        this.closeModal();
        this.render();
      } catch (err) {
        this.onToast('Hata: ' + err.message, 'error');
      }
    });
  }

  showEditAccountForm(account) {
    this.openModal('Hesap Duzenle', `
      <form id="editAccountForm">
        <div class="form-group">
          <label class="form-label">Hesap Adi</label>
          <input class="form-input" type="text" name="name" value="${account.name}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Banka Adi</label>
          <input class="form-input" type="text" name="bankName" value="${account.bankName || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Bakiye (TL)</label>
          <input class="form-input" type="number" name="balance" value="${account.balance || 0}" step="1">
        </div>
        <div class="form-group">
          <label class="form-label">Hesap Turu</label>
          <select class="form-select" name="type">
            <option value="checking" ${account.type === 'checking' ? 'selected' : ''}>Vadesiz Hesap</option>
            <option value="savings" ${account.type === 'savings' ? 'selected' : ''}>Birikim Hesabi</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Ikon</label>
          <select class="form-select" name="icon">
            <option value="🏦" ${account.icon === '🏦' ? 'selected' : ''}>🏦 Banka</option>
            <option value="💰" ${account.icon === '💰' ? 'selected' : ''}>💰 Para</option>
            <option value="🏧" ${account.icon === '🏧' ? 'selected' : ''}>🏧 ATM</option>
            <option value="💵" ${account.icon === '💵' ? 'selected' : ''}>💵 Nakit</option>
            <option value="🪙" ${account.icon === '🪙' ? 'selected' : ''}>🪙 Birikim</option>
          </select>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" id="cancelEditAccBtn">Iptal</button>
          <button type="submit" class="btn btn-primary">Kaydet</button>
        </div>
      </form>
    `);

    document.getElementById('cancelEditAccBtn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('editAccountForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const data = {
        name: form.name.value,
        bankName: form.bankName.value,
        balance: parseFloat(form.balance.value) || 0,
        type: form.type.value,
        icon: form.icon.value
      };
      try {
        await api.updateAccount(account.id, data);
        this.onToast('Hesap guncellendi!', 'success');
        this.closeModal();
        this.render();
      } catch (err) {
        this.onToast('Hata: ' + err.message, 'error');
      }
    });
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
          return this.renderDebtCard(debt, debtAnalysis);
        }).join('')}
      </div>
    `;
  }

  renderDebtCard(debt, debtAnalysis) {
    const balance = getBalance(debt);
    const monthlyInterest = debtAnalysis.monthlyInterest || 0;
    const minPayment = debt.effectiveMinPayment || debtAnalysis.minPayment || 0;

    const formatPayoffMonths = (m) => {
      if (!m || m <= 0 || m === Infinity)
        return `<span style="color:var(--accent-danger)" title="${debtAnalysis.error || 'Hesaplanamıyor'}">Kapanmaz</span>`;
      if (m <= 12) return m + ' ay';
      return Math.floor(m / 12) + ' yıl ' + (m % 12) + ' ay';
    };

    let typeSpecificMeta = '';

    switch (debt.type) {
      case 'credit_card':
        typeSpecificMeta = `
          <div class="debt-meta">
            <div class="debt-meta-item">
              <span class="debt-meta-label">Limit</span>
              <span class="debt-meta-value">${formatCurrency(debt.limit || 0)}</span>
            </div>
            <div class="debt-meta-item">
              <span class="debt-meta-label">Kullanilan</span>
              <span class="debt-meta-value" style="color:var(--accent-danger)">${formatCurrency(balance)}</span>
            </div>
            <div class="debt-meta-item">
              <span class="debt-meta-label">Kalan Limit</span>
              <span class="debt-meta-value" style="color:var(--accent-primary)">${formatCurrency(debt.availableLimit || 0)}</span>
            </div>
            <div class="debt-meta-item">
              <span class="debt-meta-label">Taksit Blokesi</span>
              <span class="debt-meta-value">${formatCurrency(debt.blockedByInstallments || 0)}</span>
            </div>
            <div class="debt-meta-item">
              <span class="debt-meta-label">Ekstre Tutari</span>
              <span class="debt-meta-value" style="color:var(--accent-warning)">${formatCurrency(debt.statementBalance || balance)}</span>
            </div>
            <div class="debt-meta-item">
              <span class="debt-meta-label">Asgari Odeme</span>
              <span class="debt-meta-value">${formatCurrency(minPayment)}</span>
            </div>
            <div class="debt-meta-item">
              <span class="debt-meta-label">Ekstre Gunu</span>
              <span class="debt-meta-value">Ayin ${debt.statementDay || '—'}'i</span>
            </div>
            <div class="debt-meta-item">
              <span class="debt-meta-label">Son Odeme</span>
              <span class="debt-meta-value">Ayin ${debt.paymentDueDay || '—'}'i</span>
            </div>
            <div class="debt-meta-item">
              <span class="debt-meta-label">Aylik Faiz</span>
              <span class="debt-meta-value">${formatPercentage(debt.interestRate)}/ay</span>
            </div>
          </div>
        `;
        break;

      case 'overdraft':
        typeSpecificMeta = `
          <div class="debt-meta">
            <div class="debt-meta-item">
              <span class="debt-meta-label">Limit</span>
              <span class="debt-meta-value">${formatCurrency(debt.limit || 0)}</span>
            </div>
            <div class="debt-meta-item">
              <span class="debt-meta-label">Kullanilan</span>
              <span class="debt-meta-value" style="color:var(--accent-danger)">${formatCurrency(balance)}</span>
            </div>
            <div class="debt-meta-item">
              <span class="debt-meta-label">Kalan</span>
              <span class="debt-meta-value" style="color:var(--accent-primary)">${formatCurrency(debt.availableLimit || 0)}</span>
            </div>
            <div class="debt-meta-item">
              <span class="debt-meta-label">Aylik Faiz Tutari</span>
              <span class="debt-meta-value" style="color:var(--accent-danger)">${formatCurrency(debt.monthlyInterest || monthlyInterest)}</span>
            </div>
            <div class="debt-meta-item">
              <span class="debt-meta-label">TCMB Orani</span>
              <span class="debt-meta-value">${formatPercentage(debt.tcmbMonthlyRate || debt.interestRate)}/ay</span>
            </div>
            <div class="debt-meta-item">
              <span class="debt-meta-label">Min. Odeme</span>
              <span class="debt-meta-value">${formatCurrency(minPayment)}</span>
            </div>
          </div>
        `;
        break;

      case 'loan':
        typeSpecificMeta = `
          <div class="debt-meta">
            <div class="debt-meta-item">
              <span class="debt-meta-label">Kalan Borc</span>
              <span class="debt-meta-value" style="color:var(--accent-danger)">${formatCurrency(balance)}</span>
            </div>
            <div class="debt-meta-item">
              <span class="debt-meta-label">Aylik Taksit</span>
              <span class="debt-meta-value">${formatCurrency(debt.monthlyPayment || minPayment)}</span>
            </div>
            <div class="debt-meta-item">
              <span class="debt-meta-label">Kalan Ay</span>
              <span class="debt-meta-value">${debt.remainingMonths || '—'} ay</span>
            </div>
            <div class="debt-meta-item">
              <span class="debt-meta-label">Aylik Faiz</span>
              <span class="debt-meta-value">${formatPercentage(debt.interestRate)}/ay</span>
            </div>
            <div class="debt-meta-item">
              <span class="debt-meta-label">Aylik Faiz Tutari</span>
              <span class="debt-meta-value" style="color:var(--accent-danger)">${formatCurrency(monthlyInterest)}</span>
            </div>
            ${debt.dueDate ? `
            <div class="debt-meta-item">
              <span class="debt-meta-label">Odeme Gunu</span>
              <span class="debt-meta-value">Ayin ${debt.dueDate}'i</span>
            </div>` : ''}
          </div>
        `;
        break;

      default:
        typeSpecificMeta = `
          <div class="debt-meta">
            <div class="debt-meta-item">
              <span class="debt-meta-label">Bakiye</span>
              <span class="debt-meta-value" style="color:var(--accent-danger)">${formatCurrency(balance)}</span>
            </div>
            <div class="debt-meta-item">
              <span class="debt-meta-label">Aylik Faiz</span>
              <span class="debt-meta-value">${formatPercentage(debt.interestRate)}/ay</span>
            </div>
            <div class="debt-meta-item">
              <span class="debt-meta-label">Min. Odeme</span>
              <span class="debt-meta-value">${formatCurrency(minPayment)}</span>
            </div>
          </div>
        `;
    }

    const typeIcons = {
      credit_card: '💳',
      overdraft: '🏦',
      loan: '📋'
    };
    const icon = typeIcons[debt.type] || '💰';

    return `
      <div class="card debt-card fade-in">
        <div class="flex-between mb-md">
          <h3 style="font-weight:700">${icon} ${debt.name}</h3>
          <span class="debt-type-badge">${DEBT_TYPE_LABELS[debt.type] || debt.type}</span>
        </div>
        ${typeSpecificMeta}
        <div class="flex gap-sm mt-md">
          <button class="btn btn-outline btn-sm edit-debt" data-id="${debt.id}" style="flex:1">✏️ Düzenle</button>
          <button class="btn btn-outline btn-sm delete-debt" data-id="${debt.id}" style="flex:1">🗑️ Sil</button>
        </div>
      </div>
    `;
  }

  renderStrategyComparison(analysis) {
    if (!analysis.debts || analysis.debts.length === 0) return '';

    const { snowball, avalanche } = analysis;

    const snowballOk = snowball.totalMonths > 0;
    const avalancheOk = avalanche.totalMonths > 0;

    if (!snowballOk && !avalancheOk) {
      return `
        <div class="section-header mt-lg">
          <h2 class="section-title">Odeme Stratejileri</h2>
        </div>
        <div class="card fade-in" style="border-left:3px solid var(--accent-danger)">
          <h3 class="card-title" style="color:var(--accent-danger)">Mevcut odemelerle borclar kapanmiyor</h3>
          <p class="card-subtitle">Minimum odemeler aylik faizi karsilamiyor. Ek odeme yapilmazsa borc buyumeye devam eder. Asagidaki simulatorle farkli ek odeme tutarlarini deneyin.</p>
        </div>
      `;
    }

    const bestStrategy = (!avalancheOk || (snowballOk && snowball.totalInterest < avalanche.totalInterest)) ? 'snowball' : 'avalanche';

    const formatMonths = (m) => {
      if (m <= 0) return '<span style="color:var(--accent-danger)">Kapanmaz</span>';
      if (m <= 12) return m + ' ay';
      return Math.floor(m / 12) + ' yil ' + (m % 12) + ' ay';
    };

    return `
      <div class="section-header mt-lg">
        <h2 class="section-title">Odeme Stratejileri</h2>
      </div>
      <div class="strategy-comparison">
        <div class="card strategy-card ${bestStrategy === 'snowball' ? 'recommended' : ''} fade-in">
          ${bestStrategy === 'snowball' ? '<span class="strategy-badge">Onerilen</span>' : ''}
          <h3 style="font-weight:700;margin-bottom:var(--space-md)">Snowball</h3>
          <p style="font-size:var(--font-sm);color:var(--text-muted);margin-bottom:var(--space-lg)">
            Once en kucuk borcu kapatir, motivasyonu artirir
          </p>
          <div class="debt-meta" style="border-top:none;padding-top:0">
            <div class="debt-meta-item">
              <span class="debt-meta-label">Toplam Sure</span>
              <span class="debt-meta-value">${formatMonths(snowball.totalMonths)}</span>
            </div>
            <div class="debt-meta-item">
              <span class="debt-meta-label">Toplam Faiz</span>
              <span class="debt-meta-value" style="color:var(--accent-danger)">${snowballOk ? formatCurrency(snowball.totalInterest) : '—'}</span>
            </div>
          </div>
        </div>
        <div class="card strategy-card ${bestStrategy === 'avalanche' ? 'recommended' : ''} fade-in">
          ${bestStrategy === 'avalanche' ? '<span class="strategy-badge">Onerilen</span>' : ''}
          <h3 style="font-weight:700;margin-bottom:var(--space-md)">Avalanche</h3>
          <p style="font-size:var(--font-sm);color:var(--text-muted);margin-bottom:var(--space-lg)">
            Once en yuksek faizli borcu kapatir, toplam faizi azaltir
          </p>
          <div class="debt-meta" style="border-top:none;padding-top:0">
            <div class="debt-meta-item">
              <span class="debt-meta-label">Toplam Sure</span>
              <span class="debt-meta-value">${formatMonths(avalanche.totalMonths)}</span>
            </div>
            <div class="debt-meta-item">
              <span class="debt-meta-label">Toplam Faiz</span>
              <span class="debt-meta-value" style="color:var(--accent-danger)">${avalancheOk ? formatCurrency(avalanche.totalInterest) : '—'}</span>
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
        <h3 class="card-title" style="margin-bottom:var(--space-lg)">Faiz Simulasyonu</h3>
        <p style="font-size:var(--font-sm);color:var(--text-muted);margin-bottom:var(--space-lg)">
          Ek odeme yaparsaniz ne kadar faiz tasarruf edersiniz?
        </p>
        <div class="simulator-input-group">
          <div class="form-group">
            <label class="form-label">Aylik Ek Odeme (TL)</label>
            <input class="form-input" type="number" id="extraPaymentInput" value="1000" step="100" min="0">
          </div>
          <button class="btn btn-primary" id="simulateBtn">Hesapla</button>
        </div>
        <div id="simulatorResults"></div>
      </div>
    `;
  }

  bindEvents(debts) {
    document.getElementById('addDebtBtn')?.addEventListener('click', () => this.showAddProductForm());
    document.getElementById('addChargeBtn')?.addEventListener('click', () => this.showAddChargeForm());

    this.container.querySelectorAll('.edit-debt').forEach(btn => {
      btn.addEventListener('click', () => {
        const debt = debts.find(d => d.id === btn.dataset.id);
        if (debt) this.showEditForm(debt);
      });
    });

    this.container.querySelectorAll('.delete-debt').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Bu ürünü silmek istediğinize emin misiniz?')) {
          await api.deleteDebt(btn.dataset.id);
          this.onToast('Ürün silindi', 'success');
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
                <div class="sim-result-label">Kapanis Suresi</div>
                ${d.interestSaved ? `<div style="margin-top:var(--space-sm);font-size:var(--font-sm);color:var(--accent-primary)">${formatCurrency(d.interestSaved)} faiz tasarrufu</div>` : ''}
              </div>
            `).join('')}
          </div>
        `;
      } catch (err) {
        this.onToast('Hesaplama hatasi', 'error');
      }
    });
  }

  showAddProductForm() {
    this.openModal('Kredili Ürün Ekle', `
      <form id="addDebtForm">
        <div class="form-group">
          <label class="form-label">Borc Adi</label>
          <input class="form-input" type="text" name="name" placeholder="Orn: Yapi Kredi Karti" required>
        </div>
        <div class="form-group">
          <label class="form-label">Tur</label>
          <select class="form-select" name="type" id="debtTypeSelect">
            <option value="credit_card">Kredi Karti</option>
            <option value="overdraft">Ek Hesap</option>
            <option value="loan">Tuketici Kredisi</option>
          </select>
        </div>

        <!-- Kredi Karti alanlari -->
        <div id="fields-credit_card" class="type-fields">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Kart Limiti (TL)</label>
              <input class="form-input" type="number" name="limit_cc" step="1" min="0" value="0">
            </div>
            <div class="form-group">
              <label class="form-label">Kullanilan Tutar (TL)</label>
              <input class="form-input" type="number" name="usedAmount_cc" step="1" min="0" value="0">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Aylik Faiz (%)</label>
              <input class="form-input" type="number" name="interestRate_cc" step="0.01" min="0" value="3.5">
            </div>
            <div class="form-group">
              <label class="form-label">Asgari Odeme Orani (%)</label>
              <input class="form-input" type="number" name="minPaymentRate" step="1" min="1" max="100" value="40">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Ekstre Kesim Gunu</label>
              <input class="form-input" type="number" name="statementDay" step="1" min="1" max="31" value="15">
            </div>
            <div class="form-group">
              <label class="form-label">Son Odeme Gunu</label>
              <input class="form-input" type="number" name="paymentDueDay" step="1" min="1" max="31" value="5">
            </div>
          </div>
        </div>

        <!-- Ek Hesap alanlari -->
        <div id="fields-overdraft" class="type-fields" style="display:none">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Ek Hesap Limiti (TL)</label>
              <input class="form-input" type="number" name="limit_od" step="1" min="0" value="0">
            </div>
            <div class="form-group">
              <label class="form-label">Kullanilan Tutar (TL)</label>
              <input class="form-input" type="number" name="usedAmount_od" step="1" min="0" value="0">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">TCMB Aylik Faiz (%)</label>
            <input class="form-input" type="number" name="interestRate_od" step="0.01" min="0" value="4.25">
          </div>
        </div>

        <!-- Tuketici Kredisi alanlari -->
        <div id="fields-loan" class="type-fields" style="display:none">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Cekilen Kredi (TL)</label>
              <input class="form-input" type="number" name="principalAmount" step="1" min="0" value="0">
            </div>
            <div class="form-group">
              <label class="form-label">Kalan Ana Para (TL)</label>
              <input class="form-input" type="number" name="currentBalance_loan" step="1" min="0" value="0">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Aylik Taksit (TL)</label>
              <input class="form-input" type="number" name="monthlyPayment" step="1" min="0" value="0">
            </div>
            <div class="form-group">
              <label class="form-label">Aylik Faiz (%)</label>
              <input class="form-input" type="number" name="interestRate_loan" step="0.01" min="0" value="2.5">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Kalan Ay</label>
              <input class="form-input" type="number" name="remainingMonths" step="1" min="0" value="0">
            </div>
            <div class="form-group">
              <label class="form-label">Odeme Gunu</label>
              <input class="form-input" type="number" name="dueDate" step="1" min="1" max="31" value="1">
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-outline" id="cancelDebtBtn">Iptal</button>
          <button type="submit" class="btn btn-primary">Kaydet</button>
        </div>
      </form>
    `);

    // Tur degistiginde ilgili alanlari goster/gizle
    const typeSelect = document.getElementById('debtTypeSelect');
    const showFieldsForType = (type) => {
      document.querySelectorAll('.type-fields').forEach(el => el.style.display = 'none');
      const target = document.getElementById(`fields-${type}`);
      if (target) target.style.display = '';
    };
    typeSelect?.addEventListener('change', () => showFieldsForType(typeSelect.value));

    document.getElementById('cancelDebtBtn')?.addEventListener('click', () => this.closeModal());

    document.getElementById('addDebtForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const type = form.type.value;

      let data = { name: form.name.value, type };

      switch (type) {
        case 'credit_card':
          data.limit = parseFloat(form.limit_cc.value) || 0;
          data.usedAmount = parseFloat(form.usedAmount_cc.value) || 0;
          data.interestRate = parseFloat(form.interestRate_cc.value) || 0;
          data.minPaymentRate = parseFloat(form.minPaymentRate.value) || 40;
          data.statementDay = parseInt(form.statementDay.value) || 15;
          data.paymentDueDay = parseInt(form.paymentDueDay.value) || 5;
          break;

        case 'overdraft':
          data.limit = parseFloat(form.limit_od.value) || 0;
          data.usedAmount = parseFloat(form.usedAmount_od.value) || 0;
          data.interestRate = parseFloat(form.interestRate_od.value) || 4.25;
          break;

        case 'loan':
          data.principalAmount = parseFloat(form.principalAmount.value) || 0;
          data.currentBalance = parseFloat(form.currentBalance_loan.value) || 0;
          data.monthlyPayment = parseFloat(form.monthlyPayment.value) || 0;
          data.interestRate = parseFloat(form.interestRate_loan.value) || 0;
          data.remainingMonths = parseInt(form.remainingMonths.value) || 0;
          data.dueDate = form.dueDate.value || null;
          break;
      }

      try {
        await api.addDebt(data);
        this.onToast('Ürün eklendi!', 'success');
        this.closeModal();
        this.render();
      } catch (err) {
        this.onToast('Hata: ' + err.message, 'error');
      }
    });
  }

  showAddChargeForm() {
    // Sadece kredi kartı ve ek hesap ürünlerine borç eklenebilir
    const eligible = this.debts.filter(d => d.type === 'credit_card' || d.type === 'overdraft');
    if (eligible.length === 0) {
      this.onToast('Önce bir kredili ürün ekleyin', 'warning');
      return;
    }

    const productOpts = eligible.map(d => {
      const label = d.type === 'credit_card' ? '💳' : '🏦';
      const bal = getBalance(d);
      return `<option value="${d.id}">${label} ${d.name} (Kullanılan: ${formatCurrency(bal)})</option>`;
    }).join('');

    const today = new Date().toISOString().split('T')[0];

    this.openModal('Borç Ekle', `
      <form id="addChargeForm">
        <div class="form-group">
          <label class="form-label">Ürün Seçin</label>
          <select class="form-select" name="productId" required>
            ${productOpts}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Tutar (₺)</label>
          <input class="form-input" type="number" name="amount" step="1" min="1" required>
        </div>
        <div class="form-group">
          <label class="form-label">Açıklama</label>
          <input class="form-input" type="text" name="description" placeholder="Örn: Elektronik alışveriş">
        </div>
        <div class="form-group">
          <label class="form-label">Tarih</label>
          <input class="form-input" type="date" name="date" value="${today}">
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" id="cancelChargeBtn">İptal</button>
          <button type="submit" class="btn btn-primary">Borç Ekle</button>
        </div>
      </form>
    `);

    document.getElementById('cancelChargeBtn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('addChargeForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const productId = form.productId.value;
      const amount = parseFloat(form.amount.value);
      const description = form.description.value || '';
      const date = form.date.value;

      try {
        // Ürünün usedAmount'ını güncelle
        const product = this.debts.find(d => d.id === productId);
        const currentUsed = getBalance(product);
        await api.updateDebt(productId, { usedAmount: currentUsed + amount });

        // İşlem olarak da kaydet (expense)
        await api.addTransaction({
          date, type: 'expense', amount,
          category: 'cat-diger',
          description: `${product.name}: ${description}`,
          source: 'manual'
        });

        this.onToast(`${formatCurrency(amount)} borç eklendi`, 'success');
        this.closeModal();
        this.render();
      } catch (err) {
        this.onToast('Hata: ' + err.message, 'error');
      }
    });
  }

  showEditForm(debt) {
    let fieldsHtml = '';

    if (debt.type === 'credit_card') {
      fieldsHtml = `
        <div class="form-group">
          <label class="form-label">Kart Adı</label>
          <input class="form-input" type="text" name="name" value="${debt.name}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Kart Limiti (₺)</label>
            <input class="form-input" type="number" name="limit" value="${debt.limit || 0}" step="1" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">Kullanılan Tutar (₺)</label>
            <input class="form-input" type="number" name="usedAmount" value="${getBalance(debt)}" step="1" min="0">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Aylık Faiz (%)</label>
            <input class="form-input" type="number" name="interestRate" value="${debt.interestRate || 0}" step="0.01" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">Asgari Ödeme Oranı (%)</label>
            <input class="form-input" type="number" name="minPaymentRate" value="${debt.minPaymentRate || 40}" step="1" min="1" max="100">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Ekstre Kesim Günü</label>
            <input class="form-input" type="number" name="statementDay" value="${debt.statementDay || 15}" step="1" min="1" max="31">
          </div>
          <div class="form-group">
            <label class="form-label">Son Ödeme Günü</label>
            <input class="form-input" type="number" name="paymentDueDay" value="${debt.paymentDueDay || 5}" step="1" min="1" max="31">
          </div>
        </div>
      `;
    } else if (debt.type === 'overdraft') {
      fieldsHtml = `
        <div class="form-group">
          <label class="form-label">Hesap Adı</label>
          <input class="form-input" type="text" name="name" value="${debt.name}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Ek Hesap Limiti (₺)</label>
            <input class="form-input" type="number" name="limit" value="${debt.limit || 0}" step="1" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">Kullanılan Tutar (₺)</label>
            <input class="form-input" type="number" name="usedAmount" value="${getBalance(debt)}" step="1" min="0">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">TCMB Aylık Faiz (%)</label>
          <input class="form-input" type="number" name="interestRate" value="${debt.interestRate || 4.25}" step="0.01" min="0">
        </div>
      `;
    } else if (debt.type === 'loan') {
      fieldsHtml = `
        <div class="form-group">
          <label class="form-label">Kredi Adı</label>
          <input class="form-input" type="text" name="name" value="${debt.name}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Çekilen Kredi (₺)</label>
            <input class="form-input" type="number" name="principalAmount" value="${debt.principalAmount || 0}" step="1" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">Kalan Ana Para (₺)</label>
            <input class="form-input" type="number" name="currentBalance" value="${debt.currentBalance || 0}" step="1" min="0">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Aylık Taksit (₺)</label>
            <input class="form-input" type="number" name="monthlyPayment" value="${debt.monthlyPayment || debt.minPayment || 0}" step="1" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">Aylık Faiz (%)</label>
            <input class="form-input" type="number" name="interestRate" value="${debt.interestRate || 0}" step="0.01" min="0">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Kalan Ay</label>
            <input class="form-input" type="number" name="remainingMonths" value="${debt.remainingMonths || 0}" step="1" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">Ödeme Günü</label>
            <input class="form-input" type="number" name="dueDate" value="${debt.dueDate || 1}" step="1" min="1" max="31">
          </div>
        </div>
      `;
    }

    const typeLabel = debt.type === 'credit_card' ? 'Kredi Kartı' : debt.type === 'overdraft' ? 'Ek Hesap' : 'Tüketici Kredisi';

    this.openModal(`${typeLabel} Düzenle`, `
      <form id="editDebtForm">
        ${fieldsHtml}
        <div class="form-actions">
          <button type="button" class="btn btn-outline" id="cancelEditBtn">İptal</button>
          <button type="submit" class="btn btn-primary">Kaydet</button>
        </div>
      </form>
    `);

    document.getElementById('cancelEditBtn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('editDebtForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const updates = {};

      // Tüm form alanlarını topla
      for (const el of form.elements) {
        if (el.name && el.name !== '' && el.type !== 'button' && el.type !== 'submit') {
          if (el.type === 'number') {
            updates[el.name] = parseFloat(el.value) || 0;
          } else {
            updates[el.name] = el.value;
          }
        }
      }

      try {
        await api.updateDebt(debt.id, updates);
        this.onToast('Ürün güncellendi!', 'success');
        this.closeModal();
        this.render();
      } catch (err) {
        this.onToast('Hata: ' + err.message, 'error');
      }
    });
  }
}
