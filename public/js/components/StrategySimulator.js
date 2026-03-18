// ═══════════════════════════════════════════════════════════════════
// StrategySimulator — 5-mode debt payoff comparison
// ═══════════════════════════════════════════════════════════════════

import { api } from '../services/ApiService.js';
import { formatCurrency } from '../utils/formatters.js';

export class StrategySimulator {
  constructor(container) {
    this.container = container;
    this.strategiesData = null;
  }

  async render() {
    this.container.innerHTML = '<div class="loading">Stratejiler hesaplanıyor...</div>';
    try {
      const debts = await api.getDebts();
      if (debts.length === 0) {
        this.container.innerHTML = `
          <div class="section-header"><h2 class="section-title">Strateji Simülatörü</h2></div>
          <div class="card text-center" style="padding:var(--space-2xl)">
            <p style="font-size:2rem;margin-bottom:var(--space-md)">🎉</p>
            <p style="color:var(--text-muted)">Borcunuz yok! Strateji simülatörü borç eklendiğinde aktif olur.</p>
          </div>`;
        return;
      }

      this.container.innerHTML = `
        <div class="section-header"><h2 class="section-title">Strateji Simülatörü</h2></div>
        <div class="card mb-lg fade-in">
          <h3 class="card-title" style="margin-bottom:var(--space-lg)">💰 Ekstra Ödeme Simülasyonu</h3>
          <div class="inline-form mb-md">
            <div class="field" style="flex:2;min-width:150px">
              <label>Aylık Ekstra Ödeme (₺)</label>
              <input class="form-input" type="range" id="extraSlider" min="0" max="20000" step="500" value="2000">
            </div>
            <div class="field" style="flex:1;min-width:80px">
              <p id="extraLabel" style="font-size:var(--font-xl);font-weight:700;color:var(--accent-primary);text-align:center">₺2.000</p>
            </div>
          </div>
        </div>
        <div id="strategyResults">Yükleniyor...</div>
        <div id="modal-container"></div>
      `;

      this.loadStrategies(2000);

      const slider = document.getElementById('extraSlider');
      const label = document.getElementById('extraLabel');
      slider?.addEventListener('input', () => {
        const val = parseInt(slider.value);
        label.textContent = formatCurrency(val);
        clearTimeout(this._debounce);
        this._debounce = setTimeout(() => this.loadStrategies(val), 300);
      });
    } catch (err) {
      this.container.innerHTML = '<div class="empty-state"><p>Simülatör yüklenemedi</p></div>';
      console.error(err);
    }
  }

  async loadStrategies(extra) {
    const el = document.getElementById('strategyResults');
    if (!el) return;

    try {
      const data = await api.getStrategies(extra);
      this.strategiesData = data;
      if (!data.strategies || data.strategies.length === 0) {
        el.innerHTML = '<p style="color:var(--text-muted)">Yeterli veri yok</p>';
        return;
      }

      const icons = { avalanche: '🏔️', snowball: '⛄', minimum: '🐢', aggressive: '🚀', balanced: '⚖️' };
      const descriptions = {
        avalanche: 'En yüksek faizli borca öncelik verir. Minimum ödemeleri yaptıktan sonra kalan bütçeyi en yüksek faizli borca yönlendirir. Toplam faiz maliyetini minimize eder.',
        snowball: 'En küçük bakiyeli borcu önce kapatır. Psikolojik motivasyon sağlar. Kapanan borcun ödemesi bir sonrakine aktarılır.',
        minimum: 'Sadece minimum ödemeleri yapar. Ek ödeme yapılmaz. Kapanan borcun ödemesi aktarılmaz.',
        aggressive: `Aylık fazlanızın tamamını (${data.avgMonthlySurplus > 0 ? formatCurrency(data.avgMonthlySurplus) : '₺0'}) borç ödemesine yönlendirir.`,
        balanced: `Aylık fazlanızın %60'ını borç ödemesine, %40'ını tasarrufa ayırır.`
      };

      // Find the best converged strategy
      const converged = data.strategies.filter(s => s.converged);
      const best = converged.length > 0
        ? converged.sort((a, b) => a.totalInterest - b.totalInterest)[0]
        : null;

      // Max interest for bar chart (only from converged)
      const maxInterest = converged.length > 0
        ? Math.max(...converged.map(s => s.totalInterest), 1)
        : 1;

      el.innerHTML = `
        ${data.avgMonthlySurplus > 0 ? `
          <div class="card mb-lg fade-in" style="border-left:3px solid var(--accent-primary)">
            <p style="font-size:var(--font-sm)">Ortalama aylık fazlanız: <strong>${formatCurrency(data.avgMonthlySurplus)}</strong> — Bu tutar ekstra ödeme kapasitenizdir.</p>
          </div>
        ` : data.avgMonthlySurplus < 0 ? `
          <div class="card mb-lg fade-in" style="border-left:3px solid var(--accent-danger)">
            <p style="font-size:var(--font-sm)">Aylık ortalamanız: <strong style="color:var(--accent-danger)">${formatCurrency(data.avgMonthlySurplus)}</strong> — Giderleriniz gelirinizi aşıyor. Agresif/Dengeli stratejiler ekstra ödeme yapamaz.</p>
          </div>
        ` : ''}

        <div style="display:grid;gap:var(--space-lg)">
          ${data.strategies.map(s => this._renderStrategyCard(s, icons, descriptions, best, maxInterest)).join('')}
        </div>

        ${this._renderComparisonTable(data.strategies, icons, best)}

        ${data.avgMonthlySurplus > 0 ? `
          <div class="card mt-lg fade-in" style="border-left:3px solid var(--accent-primary)">
            <p style="font-size:var(--font-sm)">Aylık fazlanız <strong>${formatCurrency(data.avgMonthlySurplus)}</strong>. Tamamını borca yönlendirirseniz "Agresif" strateji uygulanır.</p>
          </div>
        ` : ''}
      `;

      this.bindBreakdownButtons();
    } catch (err) {
      el.innerHTML = '<p style="color:var(--accent-danger)">Hesaplama hatası</p>';
      console.error(err);
    }
  }

  _renderStrategyCard(s, icons, descriptions, best, maxInterest) {
    const isBest = best && s.name === best.name;
    const ok = s.converged;
    const desc = descriptions[s.name] || '';
    const displayMonths = ok ? `${s.totalMonths} ay` : '∞';
    const displayInterest = ok ? formatCurrency(s.totalInterest) : 'Kapanmıyor';
    const barW = ok ? (s.totalInterest / maxInterest) * 100 : 100;
    const barColor = !ok ? 'var(--accent-danger)' : isBest ? 'var(--accent-primary)' : 'var(--accent-warning, #FF9800)';

    // Milestone summary
    let milestoneHtml = '';
    if (ok && s.milestones && s.milestones.length > 0) {
      milestoneHtml = `<div style="margin-top:var(--space-sm)">
        ${s.milestones.map(m => `
          <span style="display:inline-block;font-size:var(--font-xs);color:var(--accent-primary);margin-right:var(--space-md)">
            ✓ ${m.debt} → ${m.month}. ay
          </span>
        `).join('')}
      </div>`;
    }

    return `
      <div class="card fade-in" style="position:relative;${isBest ? 'border:1px solid var(--accent-primary);box-shadow:0 0 20px rgba(0,255,170,0.1)' : ''}">
        ${isBest ? '<div style="position:absolute;top:-10px;right:16px;background:var(--accent-primary);color:var(--bg-primary);padding:2px 12px;border-radius:10px;font-size:var(--font-xs);font-weight:700">EN AZ FAİZ</div>' : ''}

        <div class="flex-between mb-sm">
          <h3 style="font-weight:700">${icons[s.name] || '📊'} ${s.label}</h3>
          <span style="font-size:var(--font-lg);font-weight:700;color:${!ok ? 'var(--accent-danger)' : 'var(--text-primary)'}">${displayMonths}</span>
        </div>

        ${desc ? `<p style="font-size:var(--font-xs);color:var(--text-muted);margin-bottom:var(--space-md);line-height:1.5">${desc}</p>` : ''}

        <div style="display:grid;grid-template-columns:1fr 1fr ${ok ? '1fr' : ''};gap:var(--space-md);margin-bottom:var(--space-md)">
          <div>
            <div style="font-size:var(--font-xs);color:var(--text-muted)">Toplam Faiz</div>
            <div style="font-weight:600;color:var(--accent-danger)">${displayInterest}</div>
          </div>
          <div>
            <div style="font-size:var(--font-xs);color:var(--text-muted)">Aylık Bütçe</div>
            <div style="font-weight:600">${s.totalBudget > 0 ? formatCurrency(s.totalBudget) : '-'}</div>
          </div>
          ${ok ? `<div>
            <div style="font-size:var(--font-xs);color:var(--text-muted)">Toplam Ödeme</div>
            <div style="font-weight:600">${formatCurrency(s.totalPaid || 0)}</div>
          </div>` : ''}
        </div>

        <div class="progress-bar-container mb-sm">
          <div class="progress-bar" style="width:${Math.min(100, barW)}%;background:${barColor}"></div>
        </div>

        ${!ok ? `
          <p style="font-size:var(--font-xs);color:var(--accent-danger);font-weight:600;margin-bottom:var(--space-sm)">⚠️ Aylık ödeme faizi karşılamıyor — borç büyümeye devam eder.</p>
        ` : ''}

        ${ok && s.interestSaved && s.interestSaved > 0 ? `
          <p style="font-size:var(--font-xs);color:var(--accent-primary)">💰 Minimuma kıyasla ${formatCurrency(s.interestSaved)} faiz tasarrufu</p>
        ` : ''}

        ${milestoneHtml}

        <button class="breakdown-btn" data-strategy="${s.name}" style="width:100%;margin-top:var(--space-md);padding:var(--space-sm) var(--space-md);background:var(--surface-3);border:1px solid var(--surface-2);border-radius:6px;color:var(--accent-primary);cursor:pointer;font-size:var(--font-xs);font-weight:600;transition:all 0.2s">📊 Nasıl Hesaplandı?</button>
      </div>
    `;
  }

  _renderComparisonTable(strategies, icons, best) {
    return `
      <div class="card mt-lg fade-in">
        <h3 class="card-title">Karşılaştırma Tablosu</h3>
        <div class="table-responsive mt-md"><table class="data-table">
          <thead><tr>
            <th>Strateji</th>
            <th style="text-align:right">Süre</th>
            <th style="text-align:right">Toplam Faiz</th>
            <th style="text-align:right">Toplam Ödeme</th>
            <th style="text-align:right">Aylık Bütçe</th>
          </tr></thead>
          <tbody>
            ${strategies.map(s => {
              const isBest = best && s.name === best.name;
              const ok = s.converged;
              return `<tr ${isBest ? 'style="background:rgba(0,255,170,0.05)"' : ''}>
                <td>${icons[s.name] || ''} ${s.label}</td>
                <td class="text-right" style="color:${!ok ? 'var(--accent-danger)' : ''}">${ok ? s.totalMonths + ' ay' : '∞'}</td>
                <td class="text-right" style="color:var(--accent-danger)">${ok ? formatCurrency(s.totalInterest) : 'Kapanmıyor'}</td>
                <td class="text-right">${ok ? formatCurrency(s.totalPaid || 0) : '-'}</td>
                <td class="text-right">${s.totalBudget > 0 ? formatCurrency(s.totalBudget) : '-'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>
      </div>
    `;
  }

  bindBreakdownButtons() {
    document.querySelectorAll('.breakdown-btn').forEach(btn => {
      btn.addEventListener('mouseover', () => {
        btn.style.background = 'var(--surface-2)';
        btn.style.borderColor = 'var(--accent-primary)';
      });
      btn.addEventListener('mouseout', () => {
        btn.style.background = 'var(--surface-3)';
        btn.style.borderColor = 'var(--surface-2)';
      });
      btn.addEventListener('click', () => {
        this.showStrategyBreakdown(btn.dataset.strategy);
      });
    });
  }

  showStrategyBreakdown(strategyName) {
    if (!this.strategiesData) return;
    const strategy = this.strategiesData.strategies.find(s => s.name === strategyName);
    if (!strategy || !strategy.breakdown) return;

    const bd = strategy.breakdown;
    const icons = { avalanche: '🏔️', snowball: '⛄', minimum: '🐢', aggressive: '🚀', balanced: '⚖️' };

    // ── Borç listesi ──
    const debtsList = bd.debts.map(d => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--surface-3);border-radius:6px;margin-bottom:6px">
        <div>
          <div style="font-weight:600;font-size:var(--font-sm)">${d.name}</div>
          <div style="font-size:var(--font-xs);color:var(--text-muted)">${d.minPaymentDesc}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:600">${d.balance.toLocaleString('tr-TR')}₺</div>
          <div style="font-size:var(--font-xs);color:var(--accent-danger)">%${d.monthlyRate}/ay → ${d.monthlyInterest.toLocaleString('tr-TR')}₺/ay faiz</div>
        </div>
      </div>
    `).join('');

    // ── Hesaplama adımları ──
    const stepsHtml = this._buildCalculationSteps(strategy, bd);

    // ── Milestones ──
    let milestonesHtml = '';
    if (bd.milestones && bd.milestones.length > 0) {
      milestonesHtml = `
        <div style="margin-top:var(--space-md)">
          <div style="font-weight:600;margin-bottom:var(--space-sm)">📅 Borç Kapanış Takvimi:</div>
          ${bd.milestones.map(m => `
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:var(--font-sm)">
              <span>✓ ${m.debt}</span>
              <span style="color:var(--accent-primary);font-weight:600">${m.month}. ayda kapanır</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    // ── Aylık anlık görüntüler ──
    let snapshotsHtml = '';
    if (bd.monthlySnapshots && bd.monthlySnapshots.length > 0) {
      // Non-converging: limit to first 12 meaningful snapshots, then show "..." message
      let snaps = bd.monthlySnapshots;
      let truncated = false;
      if (!bd.converged && snaps.length > 12) {
        snaps = snaps.slice(0, 12);
        truncated = true;
      }
      snapshotsHtml = `
        <div style="margin-top:var(--space-md)">
          <div style="font-weight:600;margin-bottom:var(--space-sm)">📈 Borç Değişim Tablosu:</div>
          <div style="max-height:200px;overflow-y:auto">
            <table style="width:100%;font-size:var(--font-xs);border-collapse:collapse">
              <thead><tr style="color:var(--text-muted)">
                <th style="text-align:left;padding:4px 8px">Ay</th>
                <th style="text-align:right;padding:4px 8px">Kalan Borç</th>
                <th style="text-align:right;padding:4px 8px">O Ay Faiz</th>
              </tr></thead>
              <tbody>
                ${snaps.map(snap => `
                  <tr style="border-top:1px solid var(--surface-3)">
                    <td style="padding:4px 8px">${snap.month}. ay</td>
                    <td style="text-align:right;padding:4px 8px">${snap.remaining.toLocaleString('tr-TR')}₺</td>
                    <td style="text-align:right;padding:4px 8px;color:var(--accent-danger)">${snap.interest.toLocaleString('tr-TR')}₺</td>
                  </tr>
                `).join('')}
                ${truncated ? `<tr><td colspan="3" style="padding:8px;text-align:center;color:var(--text-muted);font-style:italic">… sonraki aylarda borç sabit kalıyor, faiz ödenmeye devam ediyor</td></tr>` : ''}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // ── Sonuç ──
    const resultColor = bd.converged ? 'var(--accent-primary)' : 'var(--accent-danger)';
    const resultText = bd.converged
      ? `${bd.totalMonths} ayda tüm borçlar kapanır. Toplam ${bd.totalInterest.toLocaleString('tr-TR')}₺ faiz, ${(bd.totalPaid || 0).toLocaleString('tr-TR')}₺ toplam ödeme yapılır.`
      : 'Bu stratejiyle aylık ödeme aylık faizi karşılayamıyor. Borç büyümeye devam eder. Ekstra ödeme eklemeyi veya farklı bir strateji denemeyi düşünün.';

    // ── Modal ──
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(4px)';
    modal.innerHTML = `
      <div style="background:var(--surface-1);border-radius:12px;max-width:650px;width:92%;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
        <div style="padding:var(--space-lg);border-bottom:1px solid var(--surface-3);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:var(--surface-1);z-index:1;border-radius:12px 12px 0 0">
          <h3 style="margin:0;font-size:var(--font-lg)">${icons[strategyName] || '📊'} ${bd.strategy} — Hesaplama Detayı</h3>
          <button class="modal-close-btn" style="background:none;border:none;font-size:24px;cursor:pointer;color:var(--text-muted);padding:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center">×</button>
        </div>

        <div style="padding:var(--space-lg)">
          <!-- Borçlar -->
          <div style="margin-bottom:var(--space-lg)">
            <div style="font-weight:600;margin-bottom:var(--space-sm)">💳 Borçlar (Toplam: ${bd.totalDebt.toLocaleString('tr-TR')}₺):</div>
            ${debtsList}
            <div style="font-size:var(--font-xs);color:var(--text-muted);margin-top:4px">
              Toplam aylık faiz: <strong style="color:var(--accent-danger)">${bd.totalMonthlyInterest.toLocaleString('tr-TR')}₺/ay</strong>
            </div>
          </div>

          <!-- Bütçe bilgisi -->
          <div style="margin-bottom:var(--space-lg);padding:var(--space-md);background:var(--surface-3);border-radius:8px">
            <div style="font-weight:600;margin-bottom:var(--space-sm)">💰 Ödeme Bütçesi:</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:var(--font-sm)">
              <div>Aylık Gelir Ort.:</div><div style="text-align:right;font-weight:600">${bd.avgIncome.toLocaleString('tr-TR')}₺</div>
              <div>Aylık Gider Ort.:</div><div style="text-align:right;font-weight:600">${bd.avgExpense.toLocaleString('tr-TR')}₺</div>
              <div>Aylık Fazla:</div><div style="text-align:right;font-weight:600;color:${bd.avgSurplus >= 0 ? 'var(--accent-primary)' : 'var(--accent-danger)'}">${bd.avgSurplus.toLocaleString('tr-TR')}₺</div>
              <div style="border-top:1px solid var(--surface-2);padding-top:6px">Ekstra Ödeme:</div>
              <div style="text-align:right;font-weight:600;border-top:1px solid var(--surface-2);padding-top:6px">${bd.extraPayment.toLocaleString('tr-TR')}₺</div>
              <div style="font-weight:700">Toplam Aylık Bütçe:</div>
              <div style="text-align:right;font-weight:700;color:var(--accent-primary)">${(bd.totalBudget || 0).toLocaleString('tr-TR')}₺</div>
            </div>
            <div style="font-size:var(--font-xs);color:var(--text-muted);margin-top:8px">
              Bütçe = İlk ay minimum ödemelerin toplamı + ekstra ödeme
            </div>
          </div>

          <!-- Hesaplama adımları -->
          <div style="margin-bottom:var(--space-lg)">
            <div style="font-weight:600;margin-bottom:var(--space-sm)">📐 Hesaplama Mantığı:</div>
            ${stepsHtml}
          </div>

          ${milestonesHtml}
          ${snapshotsHtml}

          <!-- Sonuç -->
          <div style="margin-top:var(--space-lg);padding:var(--space-md);border-left:3px solid ${resultColor};background:var(--surface-2);border-radius:0 8px 8px 0">
            <div style="font-weight:600;margin-bottom:4px">✅ Sonuç:</div>
            <div style="font-size:var(--font-sm)">${resultText}</div>
          </div>
        </div>
      </div>
    `;

    modal.querySelector('.modal-close-btn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.getElementById('modal-container')?.appendChild(modal) || document.body.appendChild(modal);
  }

  _buildCalculationSteps(strategy, bd) {
    const name = strategy.name;
    const orderDesc = name === 'snowball'
      ? 'En düşük bakiyeli borçtan başlayarak'
      : 'En yüksek faizli borçtan başlayarak';

    let steps = [];

    if (name === 'minimum') {
      steps = [
        { title: 'Minimum Ödeme', text: 'Her ay her borca sadece asgari minimum ödeme yapılır.' },
        { title: 'Faiz Eklenir', text: `Her ay kalan bakiye × aylık faiz oranı kadar faiz eklenir. İlk ay toplam faiz: ${bd.totalMonthlyInterest.toLocaleString('tr-TR')}₺.` },
        { title: 'Cascade Yok', text: 'Bir borç kapandığında serbest kalan ödeme diğer borca aktarılmaz. Sadece o borcun ödemesi durur.' },
        { title: 'Sonuç', text: bd.converged ? `Tüm borçlar ${bd.totalMonths} ayda kapanır.` : 'Bazı borçların (özellikle ek hesap) minimumu sadece faizi karşılar — borç hiç azalmaz.' }
      ];
    } else {
      steps = [
        { title: 'Bütçe Belirleme', text: `İlk ay minimum ödemelerin toplamı + ${bd.extraPayment.toLocaleString('tr-TR')}₺ ekstra = ${(bd.totalBudget || 0).toLocaleString('tr-TR')}₺ sabit aylık bütçe.` },
        { title: 'Faiz Eklenir', text: `Her ay her borcun bakiyesine aylık faiz eklenir. İlk ay toplam: ${bd.totalMonthlyInterest.toLocaleString('tr-TR')}₺.` },
        { title: 'Minimumlar Ödenir', text: 'Önce her borç kendi asgari ödemesini alır.' },
        { title: 'Kalan Bütçe → Öncelikli Borç', text: `${orderDesc} bütçenin kalanı o borca yönlendirilir. Borç kapanırsa kalan bir sonrakine aktarılır (cascade).` },
        { title: 'Snowball Etkisi', text: 'Bir borç kapandığında onun asgari ödemesi serbest kalır. Sabit bütçe değişmediği için serbest kalan tutar otomatik olarak sonraki borca gider.' }
      ];
    }

    return steps.map(s => `
      <div style="padding:8px 12px;margin-bottom:6px;background:var(--surface-3);border-radius:6px;font-size:var(--font-sm)">
        <span style="font-weight:600;color:var(--accent-primary)">${s.title}:</span>
        <span style="color:var(--text-muted)">${s.text}</span>
      </div>
    `).join('');
  }
}
