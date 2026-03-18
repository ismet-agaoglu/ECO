// ═══════════════════════════════════════════════════════════════════
// AgentActivity — Agent import queue, audit log, approval flow
// ═══════════════════════════════════════════════════════════════════

import { api } from '../services/ApiService.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';

export class AgentActivity {
  constructor(container, { onToast }) {
    this.container = container;
    this.onToast = onToast;
  }

  async render() {
    try {
      const [pending, auditLog, categories] = await Promise.all([
        api.getPendingTransactions(),
        api.getAuditLog({ limit: 50 }),
        api.getCategories()
      ]);
      this.categories = categories;

      this.container.innerHTML = `
        <div class="section-header"><h2 class="section-title">Agent Aktivite</h2></div>

        ${this.renderPending(pending)}
        ${this.renderAuditLog(auditLog)}
        ${this.renderApiGuide()}
      `;

      this.bindEvents();
    } catch (err) {
      this.container.innerHTML = '<div class="empty-state"><p>Agent verileri yüklenemedi</p></div>';
      console.error(err);
    }
  }

  renderPending(pending) {
    return `
      <div class="card mb-lg fade-in">
        <h3 class="card-title" style="margin-bottom:var(--space-lg)">📥 Onay Bekleyen İşlemler (${pending.length})</h3>
        ${pending.length === 0 ? `
          <p style="color:var(--text-muted)">Onay bekleyen işlem yok. Agent veri gönderdiğinde burada görünecek.</p>
        ` : `
          <div class="table-responsive"><table class="data-table">
            <thead><tr><th>Tarih</th><th>Açıklama</th><th>Kategori</th><th style="text-align:right">Tutar</th><th>Güven</th><th></th></tr></thead>
            <tbody>
              ${pending.map(t => {
                const cat = this.categories.find(c => c.id === t.category);
                const conf = (t.confidence || 0) * 100;
                const confColor = conf >= 80 ? 'var(--accent-primary)' : conf >= 50 ? 'var(--accent-warning)' : 'var(--accent-danger)';
                return `
                  <tr>
                    <td>${formatDate(t.date)}</td>
                    <td>${t.description}</td>
                    <td>${cat ? cat.icon + ' ' + cat.name : t.category}</td>
                    <td class="text-right amount-${t.type}">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</td>
                    <td><span style="color:${confColor};font-weight:600">%${conf.toFixed(0)}</span></td>
                    <td style="white-space:nowrap">
                      <button class="action-btn approve-tx" data-id="${t.id}" title="Onayla">✅</button>
                      <button class="action-btn reject-tx" data-id="${t.id}" title="Reddet">❌</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table></div>
        `}
      </div>
    `;
  }

  renderAuditLog(logs) {
    const actionLabels = {
      create: '➕ Oluştur', delete: '🗑️ Sil', approve: '✅ Onayla',
      reject: '❌ Reddet', payment: '💰 Ödeme', convert: '🔄 Dönüştür'
    };
    const sourceLabels = { manual: '👤 Manuel', agent: '🤖 Agent', recurring: '🔄 Otomatik', installment: '💳 Taksit' };

    return `
      <div class="card mb-lg fade-in">
        <h3 class="card-title" style="margin-bottom:var(--space-lg)">📋 İşlem Geçmişi (Son 50)</h3>
        ${logs.length === 0 ? '<p style="color:var(--text-muted)">Henüz işlem kaydı yok</p>' : `
          <div class="table-responsive" style="max-height:400px;overflow-y:auto">
            <table class="data-table">
              <thead><tr><th>Zaman</th><th>İşlem</th><th>Kaynak</th><th>Tür</th><th>Detay</th></tr></thead>
              <tbody>
                ${logs.map(l => `
                  <tr>
                    <td style="font-size:var(--font-xs)">${new Date(l.timestamp).toLocaleString('tr-TR')}</td>
                    <td>${actionLabels[l.action] || l.action}</td>
                    <td>${sourceLabels[l.source] || l.source}</td>
                    <td>${l.entity}</td>
                    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${l.details || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  }

  renderApiGuide() {
    return `
      <div class="card fade-in">
        <h3 class="card-title" style="margin-bottom:var(--space-lg)">🔗 Agent API Kılavuzu</h3>
        <p style="font-size:var(--font-sm);color:var(--text-muted);margin-bottom:var(--space-lg)">OpenClaw agent aşağıdaki endpoint'leri kullanabilir:</p>
        <div style="display:grid;gap:var(--space-md)">
          <div class="api-code-block" style="background:var(--bg-primary);padding:var(--space-md);border-radius:var(--radius-md);font-family:monospace;font-size:var(--font-xs);overflow-wrap:break-word;word-break:break-all">
            <strong style="color:var(--accent-primary)">POST</strong> /api/transactions<br>
            <span style="color:var(--text-muted)">{"source":"agent","confidence":0.85,"amount":500,"type":"expense","category":"cat-market","description":"Migros alışveriş"}</span>
          </div>
          <div class="api-code-block" style="background:var(--bg-primary);padding:var(--space-md);border-radius:var(--radius-md);font-family:monospace;font-size:var(--font-xs);overflow-wrap:break-word">
            <strong style="color:var(--accent-info)">GET</strong> /api/summary?year=2026&month=3
          </div>
          <div class="api-code-block" style="background:var(--bg-primary);padding:var(--space-md);border-radius:var(--radius-md);font-family:monospace;font-size:var(--font-xs)">
            <strong style="color:var(--accent-info)">GET</strong> /api/recommendations
          </div>
          <div class="api-code-block" style="background:var(--bg-primary);padding:var(--space-md);border-radius:var(--radius-md);font-family:monospace;font-size:var(--font-xs);overflow-wrap:break-word">
            <strong style="color:var(--accent-info)">GET</strong> /api/remaining-budget/2026/3
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    this.container.querySelectorAll('.approve-tx').forEach(btn => {
      btn.addEventListener('click', async () => {
        await api.approveTransaction(btn.dataset.id);
        this.onToast('İşlem onaylandı', 'success');
        this.render();
      });
    });
    this.container.querySelectorAll('.reject-tx').forEach(btn => {
      btn.addEventListener('click', async () => {
        await api.rejectTransaction(btn.dataset.id);
        this.onToast('İşlem reddedildi', 'success');
        this.render();
      });
    });
  }
}
