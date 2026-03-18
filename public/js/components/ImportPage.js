// ═══════════════════════════════════════════════════════════════════
// ImportPage — Veri İçe Aktarma & NLP (Faz 5)
// Doğal dil giriş, toplu import, review queue
// ═══════════════════════════════════════════════════════════════════

import { api } from '../services/ApiService.js';
import { formatCurrency, formatDateShort } from '../utils/formatters.js';

export class ImportPage {
  constructor(container, helpers) {
    this.container = container;
    this.helpers = helpers;
    this.pendingItems = [];
  }

  async render() {
    this.container.innerHTML = this.renderPage();
    this.bindEvents();
  }

  renderPage() {
    return `
      <div class="section-header">
        <h2 class="section-title">📥 Veri İçe Aktarma</h2>
      </div>

      <!-- NLP Giriş -->
      <div class="card fade-in">
        <h3 style="font-weight:700;margin-bottom:var(--space-md)">💬 Doğal Dil ile Giriş</h3>
        <p style="font-size:var(--font-sm);color:var(--text-secondary);margin-bottom:var(--space-md)">
          Harcamalarınızı doğal dille yazın. Her satır ayrı işlem olarak algılanır.
        </p>
        <textarea id="nlpInput" rows="5" placeholder="Örnek:&#10;dün Migros'ta 850 lira harcadım&#10;bugün taksi 120 TL&#10;3 ay telefon taksidi 1200 TL" style="width:100%;padding:var(--space-md);border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text-primary);font-size:var(--font-sm);resize:vertical;font-family:inherit"></textarea>
        <div style="display:flex;gap:var(--space-sm);margin-top:var(--space-md)">
          <button class="btn" id="btnParse" style="background:var(--accent-primary);color:white">🔍 Analiz Et</button>
          <button class="btn btn-ghost" id="btnClear">Temizle</button>
        </div>
      </div>

      <!-- Toplu JSON Import -->
      <div class="card fade-in mt-md">
        <h3 style="font-weight:700;margin-bottom:var(--space-md)">📋 Toplu Import</h3>
        <p style="font-size:var(--font-sm);color:var(--text-secondary);margin-bottom:var(--space-sm)">JSON formatında işlem listesi yapıştırın.</p>
        <textarea id="jsonInput" rows="4" placeholder='[{"date":"2026-03-15","amount":500,"type":"expense","category":"Market","description":"Haftalık alışveriş"}]' style="width:100%;padding:var(--space-md);border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text-primary);font-size:var(--font-xs);resize:vertical;font-family:monospace"></textarea>
        <button class="btn" id="btnImportJson" style="background:var(--accent-warning);color:white;margin-top:var(--space-sm)">📥 İşle</button>
      </div>

      <!-- Review Queue -->
      <div id="reviewQueue" class="mt-md"></div>
    `;
  }

  bindEvents() {
    // NLP Parse
    this.container.querySelector('#btnParse')?.addEventListener('click', async () => {
      const input = this.container.querySelector('#nlpInput').value.trim();
      if (!input) return;

      const lines = input.split('\n').filter(l => l.trim());
      try {
        const parsed = await api.postNLPParseBatch(lines);
        const items = parsed.map(p => ({
          date: p.date,
          amount: p.amount,
          type: p.type,
          description: p.description || p.originalText,
          merchant: p.merchant,
          category: null
        }));

        const result = await api.postImportProcess(items, 'nlp');
        this.pendingItems = result.items;
        this.renderReviewQueue(result);
      } catch (err) { this.helpers.onToast('Parse hatası: ' + err.message, 'error'); }
    });

    // JSON Import
    this.container.querySelector('#btnImportJson')?.addEventListener('click', async () => {
      const input = this.container.querySelector('#jsonInput').value.trim();
      try {
        const items = JSON.parse(input);
        const result = await api.postImportProcess(items, 'json_import');
        this.pendingItems = result.items;
        this.renderReviewQueue(result);
      } catch (err) { this.helpers.onToast('JSON hatası: ' + err.message, 'error'); }
    });

    // Clear
    this.container.querySelector('#btnClear')?.addEventListener('click', () => {
      this.container.querySelector('#nlpInput').value = '';
      this.container.querySelector('#reviewQueue').innerHTML = '';
      this.pendingItems = [];
    });
  }

  renderReviewQueue(result) {
    const queue = this.container.querySelector('#reviewQueue');
    const { items, stats } = result;

    queue.innerHTML = `
      <div class="card fade-in">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md)">
          <h3 style="font-weight:700">📋 İnceleme Kuyruğu</h3>
          <div style="display:flex;gap:var(--space-sm)">
            <span style="font-size:var(--font-xs);padding:4px 8px;background:var(--accent-primary);color:white;border-radius:10px">${stats.ready} hazır</span>
            <span style="font-size:var(--font-xs);padding:4px 8px;background:var(--accent-warning);color:white;border-radius:10px">${stats.reviewRequired} inceleme</span>
            <span style="font-size:var(--font-xs);padding:4px 8px;background:var(--accent-danger);color:white;border-radius:10px">${stats.rejected} reddedildi</span>
          </div>
        </div>

        <table style="width:100%;font-size:var(--font-sm);border-collapse:collapse">
          <thead>
            <tr style="border-bottom:1px solid var(--border-color)">
              <th style="text-align:left;padding:var(--space-xs)">Durum</th>
              <th style="text-align:left;padding:var(--space-xs)">Tarih</th>
              <th style="text-align:left;padding:var(--space-xs)">Açıklama</th>
              <th style="text-align:left;padding:var(--space-xs)">Kategori</th>
              <th style="text-align:right;padding:var(--space-xs)">Tutar</th>
              <th style="text-align:center;padding:var(--space-xs)">Güven</th>
              <th style="text-align:center;padding:var(--space-xs)">İşlem</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, idx) => {
              const statusColors = { ready: 'var(--accent-primary)', review_required: 'var(--accent-warning)', rejected: 'var(--accent-danger)' };
              const statusLabels = { ready: '✅', review_required: '⚠️', rejected: '❌' };
              const conf = Math.round((item._overallConfidence || 0) * 100);

              return `
                <tr style="border-bottom:1px solid var(--border-color)" data-idx="${idx}">
                  <td style="padding:var(--space-xs)">${statusLabels[item._status] || '?'}</td>
                  <td style="padding:var(--space-xs)">${item.date || '—'}</td>
                  <td style="padding:var(--space-xs)">${item.description || '—'}</td>
                  <td style="padding:var(--space-xs)">${item.category || '<em style="color:var(--text-muted)">yok</em>'}</td>
                  <td style="text-align:right;padding:var(--space-xs);font-weight:600">${formatCurrency(item.amount)}</td>
                  <td style="text-align:center;padding:var(--space-xs)">
                    <span style="color:${conf >= 70 ? 'var(--accent-primary)' : conf >= 40 ? 'var(--accent-warning)' : 'var(--accent-danger)'}">%${conf}</span>
                  </td>
                  <td style="text-align:center;padding:var(--space-xs)">
                    <button class="btn btn-ghost btn-sm approve-btn" data-idx="${idx}" style="color:var(--accent-primary)">✓</button>
                    <button class="btn btn-ghost btn-sm reject-btn" data-idx="${idx}" style="color:var(--accent-danger)">✕</button>
                  </td>
                </tr>
                ${item._errors?.length > 0 ? `<tr><td colspan="7" style="padding:2px var(--space-xs);font-size:var(--font-xxs);color:var(--accent-danger)">${item._errors.join(', ')}</td></tr>` : ''}
                ${item._warnings?.length > 0 ? `<tr><td colspan="7" style="padding:2px var(--space-xs);font-size:var(--font-xxs);color:var(--accent-warning)">${item._warnings.join(', ')}</td></tr>` : ''}
              `;
            }).join('')}
          </tbody>
        </table>

        <div style="margin-top:var(--space-md);display:flex;gap:var(--space-sm)">
          <button class="btn" id="btnCommitAll" style="background:var(--accent-primary);color:white">✅ Tümünü Kaydet (${stats.ready})</button>
          <button class="btn btn-ghost" id="btnApproveAll">Tümünü Onayla</button>
        </div>
      </div>
    `;

    // Approve/Reject buttons
    queue.querySelectorAll('.approve-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        this.pendingItems[idx]._status = 'approved';
        btn.closest('tr').style.opacity = '0.5';
        btn.textContent = '✓✓';
      });
    });

    queue.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        this.pendingItems[idx]._status = 'rejected';
        btn.closest('tr').style.opacity = '0.3';
      });
    });

    // Tümünü onayla
    queue.querySelector('#btnApproveAll')?.addEventListener('click', () => {
      this.pendingItems.forEach(item => {
        if (item._status !== 'rejected') item._status = 'approved';
      });
      this.helpers.onToast('Tümü onaylandı', 'success');
    });

    // Kaydet
    queue.querySelector('#btnCommitAll')?.addEventListener('click', async () => {
      const toCommit = this.pendingItems.filter(i => i._status === 'ready' || i._status === 'approved');
      if (toCommit.length === 0) { this.helpers.onToast('Kaydedilecek kayıt yok', 'error'); return; }

      try {
        const result = await api.postImportCommit(toCommit);
        this.helpers.onToast(`${result.committed} kayıt eklendi`, 'success');
        this.pendingItems = [];
        queue.innerHTML = '<div class="card fade-in"><p style="color:var(--accent-primary);font-weight:700">✅ İçe aktarma tamamlandı!</p></div>';
      } catch (err) { this.helpers.onToast('Kayıt hatası: ' + err.message, 'error'); }
    });
  }
}
