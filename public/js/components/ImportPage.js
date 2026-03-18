// ═══════════════════════════════════════════════════════════════════
// ImportPage — Veri İçe Aktarma & NLP (Faz 5)
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
        <h2 class="section-title">Veri İçe Aktarma</h2>
      </div>

      <div class="card fade-in">
        <div class="card-header">
          <h3 class="card-title">Doğal Dil ile Giriş</h3>
        </div>
        <p class="card-subtitle mb-md">
          Harcamalarınızı doğal dille yazın. Her satır ayrı işlem olarak algılanır.
        </p>
        <div class="form-group">
          <textarea id="nlpInput" class="form-input" rows="5" style="resize:vertical;font-family:inherit" placeholder="Örnek:&#10;dün Migros'ta 850 lira harcadım&#10;bugün taksi 120 TL&#10;3 ay telefon taksidi 1200 TL"></textarea>
        </div>
        <div class="form-actions" style="justify-content:flex-start">
          <button class="btn btn-primary" id="btnParse">🔍 Analiz Et</button>
          <button class="btn btn-ghost" id="btnClear">Temizle</button>
        </div>
      </div>

      <div class="card fade-in mt-lg">
        <div class="card-header">
          <h3 class="card-title">Toplu JSON Import</h3>
        </div>
        <p class="card-subtitle mb-sm">JSON formatında işlem listesi yapıştırın.</p>
        <div class="form-group">
          <textarea id="jsonInput" class="form-input" rows="4" style="resize:vertical;font-family:monospace;font-size:var(--font-xs)" placeholder='[{"date":"2026-03-15","amount":500,"type":"expense","category":"Market","description":"Haftalık alışveriş"}]'></textarea>
        </div>
        <div class="form-actions" style="justify-content:flex-start">
          <button class="btn btn-primary" id="btnImportJson" style="background:var(--accent-warning)">📥 İşle</button>
        </div>
      </div>

      <div id="reviewQueue" class="mt-lg"></div>
    `;
  }

  bindEvents() {
    this.container.querySelector('#btnParse')?.addEventListener('click', async () => {
      const input = this.container.querySelector('#nlpInput').value.trim();
      if (!input) return;
      const lines = input.split('\n').filter(l => l.trim());
      try {
        const parsed = await api.postNLPParseBatch(lines);
        const items = parsed.map(p => ({
          date: p.date, amount: p.amount, type: p.type,
          description: p.description || p.originalText,
          merchant: p.merchant, category: null
        }));
        const result = await api.postImportProcess(items, 'nlp');
        this.pendingItems = result.items;
        this.renderReviewQueue(result);
      } catch (err) { this.helpers.onToast('Parse hatası: ' + err.message, 'error'); }
    });

    this.container.querySelector('#btnImportJson')?.addEventListener('click', async () => {
      const input = this.container.querySelector('#jsonInput').value.trim();
      try {
        const items = JSON.parse(input);
        const result = await api.postImportProcess(items, 'json_import');
        this.pendingItems = result.items;
        this.renderReviewQueue(result);
      } catch (err) { this.helpers.onToast('JSON hatası: ' + err.message, 'error'); }
    });

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
        <div class="card-header">
          <h3 class="card-title">İnceleme Kuyruğu</h3>
          <div class="flex gap-sm">
            <span class="badge badge-success">${stats.ready} hazır</span>
            <span class="badge badge-warning">${stats.reviewRequired} inceleme</span>
            <span class="badge badge-danger">${stats.rejected} reddedildi</span>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Durum</th>
                <th>Tarih</th>
                <th>Açıklama</th>
                <th>Kategori</th>
                <th class="text-right">Tutar</th>
                <th class="text-center">Güven</th>
                <th class="text-center">İşlem</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item, idx) => {
                const statusLabels = { ready: '✅ Hazır', review_required: '⚠️ İncele', rejected: '❌ Red' };
                const statusClass = { ready: 'badge-success', review_required: 'badge-warning', rejected: 'badge-danger' };
                const conf = Math.round((item._overallConfidence || 0) * 100);
                const confClass = conf >= 70 ? 'badge-success' : conf >= 40 ? 'badge-warning' : 'badge-danger';

                return `
                  <tr data-idx="${idx}">
                    <td><span class="badge ${statusClass[item._status] || 'badge-info'}">${statusLabels[item._status] || '?'}</span></td>
                    <td>${item.date || '—'}</td>
                    <td>${item.description || '—'}</td>
                    <td>${item.category || '<span class="card-subtitle">Belirsiz</span>'}</td>
                    <td class="text-right amount-expense">${formatCurrency(item.amount)}</td>
                    <td class="text-center"><span class="badge ${confClass}">%${conf}</span></td>
                    <td class="text-center">
                      <div class="action-pair">
                        <button class="btn btn-ghost btn-sm approve-btn" data-idx="${idx}" title="Onayla">✓</button>
                        <button class="btn btn-ghost btn-sm btn-danger reject-btn" data-idx="${idx}" title="Reddet">✕</button>
                      </div>
                    </td>
                  </tr>
                  ${item._errors?.length > 0 ? `<tr><td colspan="7" class="card-subtitle" style="color:var(--accent-danger);padding:2px var(--space-sm)">${item._errors.join(', ')}</td></tr>` : ''}
                  ${item._warnings?.length > 0 ? `<tr><td colspan="7" class="card-subtitle" style="color:var(--accent-warning);padding:2px var(--space-sm)">${item._warnings.join(', ')}</td></tr>` : ''}
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div class="form-actions mt-md" style="justify-content:flex-start">
          <button class="btn btn-primary" id="btnCommitAll">✅ Tümünü Kaydet (${stats.ready})</button>
          <button class="btn btn-ghost" id="btnApproveAll">Tümünü Onayla</button>
        </div>
      </div>
    `;

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

    queue.querySelector('#btnApproveAll')?.addEventListener('click', () => {
      this.pendingItems.forEach(item => {
        if (item._status !== 'rejected') item._status = 'approved';
      });
      this.helpers.onToast('Tümü onaylandı', 'success');
    });

    queue.querySelector('#btnCommitAll')?.addEventListener('click', async () => {
      const toCommit = this.pendingItems.filter(i => i._status === 'ready' || i._status === 'approved');
      if (toCommit.length === 0) { this.helpers.onToast('Kaydedilecek kayıt yok', 'error'); return; }
      try {
        const result = await api.postImportCommit(toCommit);
        this.helpers.onToast(`${result.committed} kayıt başarıyla eklendi`, 'success');
        this.pendingItems = [];
        queue.innerHTML = `
          <div class="card fade-in">
            <div class="empty-state">
              <div class="empty-state-icon">✅</div>
              <p class="empty-state-text">İçe aktarma tamamlandı!</p>
            </div>
          </div>
        `;
      } catch (err) { this.helpers.onToast('Kayıt hatası: ' + err.message, 'error'); }
    });
  }
}
