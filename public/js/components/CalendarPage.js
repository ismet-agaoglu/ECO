// ═══════════════════════════════════════════════════════════════════
// CalendarPage — Gelir-Gider Takvimi (Faz 6)
// ═══════════════════════════════════════════════════════════════════

import { api } from '../services/ApiService.js';
import { formatCurrency, MONTH_NAMES } from '../utils/formatters.js';

export class CalendarPage {
  constructor(container, year, month, helpers) {
    this.container = container;
    this.year = year;
    this.month = month;
    this.helpers = helpers;
  }

  async render() {
    this.container.innerHTML = '<div class="loading">Takvim yükleniyor...</div>';
    try {
      this.data = await api.getCalendar(this.year, this.month);
      this.container.innerHTML = this.renderPage();
      this.bindEvents();
    } catch (err) {
      this.container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📅</div><p class="empty-state-text">Takvim yüklenemedi: ${err.message}</p></div>`;
    }
  }

  renderPage() {
    const { calendar, daysInMonth, upcomingPayments } = this.data;
    const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    const firstDayOfWeek = new Date(this.year, this.month - 1, 1).getDay();

    let monthIncome = 0, monthExpense = 0;
    Object.values(calendar).forEach(d => { monthIncome += d.income; monthExpense += d.expense; });
    const net = monthIncome - monthExpense;

    return `
      <div class="section-header">
        <h2 class="section-title">${MONTH_NAMES[this.month - 1]} ${this.year} Takvimi</h2>
      </div>

      <div class="stats-grid">
        <div class="card stat-card income fade-in stagger-1">
          <p class="card-title">Toplam Gelir</p>
          <p class="card-value positive">${formatCurrency(monthIncome)}</p>
        </div>
        <div class="card stat-card expense fade-in stagger-2">
          <p class="card-title">Toplam Gider</p>
          <p class="card-value negative">${formatCurrency(monthExpense)}</p>
        </div>
        <div class="card stat-card net fade-in stagger-3">
          <p class="card-title">Net</p>
          <p class="card-value ${net >= 0 ? 'positive' : 'negative'}">${formatCurrency(net)}</p>
        </div>
      </div>

      <div class="card fade-in">
        <div class="calendar-grid">
          ${dayNames.map(d => `<div class="day-header">${d}</div>`).join('')}
          ${Array(firstDayOfWeek).fill('<div></div>').join('')}
          ${Array.from({ length: daysInMonth }, (_, i) => {
            const day = calendar[i + 1];
            const hasData = day && day.hasData;
            const isToday = i + 1 === new Date().getDate() && this.month === new Date().getMonth() + 1 && this.year === new Date().getFullYear();
            const classes = ['day-cell', hasData ? 'has-data' : '', isToday ? 'today' : ''].filter(Boolean).join(' ');

            return `
              <div class="${classes}" data-day="${i + 1}">
                <div class="day-num">${i + 1}</div>
                ${hasData ? `
                  ${day.income > 0 ? `<div class="day-income">+${this._shortCurrency(day.income)}</div>` : ''}
                  ${day.expense > 0 ? `<div class="day-expense">-${this._shortCurrency(day.expense)}</div>` : ''}
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      ${upcomingPayments.length > 0 ? `
        <div class="card fade-in mt-lg">
          <div class="card-header">
            <h3 class="card-title">Yaklaşan Ödemeler</h3>
            <span class="badge badge-danger">${upcomingPayments.length} ödeme</span>
          </div>
          <div class="recent-list">
            ${upcomingPayments.map(p => `
              <div class="recent-item">
                <div class="recent-info">
                  <div class="recent-desc">${p.name}</div>
                </div>
                <div class="recent-amount amount-expense">-${formatCurrency(p.amount)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div id="dayDetail" class="card fade-in mt-lg" style="display:none"></div>
    `;
  }

  bindEvents() {
    this.container.querySelectorAll('.day-cell.has-data').forEach(el => {
      el.addEventListener('click', () => {
        const day = parseInt(el.dataset.day);
        const dayData = this.data.calendar[day];
        if (!dayData || !dayData.hasData) return;

        const detail = this.container.querySelector('#dayDetail');
        detail.style.display = 'block';
        detail.innerHTML = `
          <div class="card-header">
            <h3 class="card-title">${day} ${MONTH_NAMES[this.month - 1]} ${this.year}</h3>
          </div>
          <div class="stats-grid mb-md">
            <div class="card stat-card income">
              <p class="card-title">Gelir</p>
              <p class="card-value positive">${formatCurrency(dayData.income)}</p>
            </div>
            <div class="card stat-card expense">
              <p class="card-title">Gider</p>
              <p class="card-value negative">${formatCurrency(dayData.expense)}</p>
            </div>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead><tr>
                <th>Kategori</th>
                <th>Açıklama</th>
                <th class="text-right">Tutar</th>
              </tr></thead>
              <tbody>
                ${dayData.transactions.map(t => `
                  <tr>
                    <td>${t.category}</td>
                    <td>${t.description || '—'}</td>
                    <td class="text-right ${t.type === 'income' ? 'amount-income' : 'amount-expense'}">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
        detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }

  _shortCurrency(n) { return n >= 1000 ? Math.round(n / 1000) + 'K' : Math.round(n) + '₺'; }
}
