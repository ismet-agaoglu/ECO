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
    this.container.innerHTML = '<div class="text-center mt-lg" style="color:var(--text-muted)">Takvim yükleniyor...</div>';
    try {
      this.data = await api.getCalendar(this.year, this.month);
      this.container.innerHTML = this.renderPage();
      this.bindEvents();
    } catch (err) {
      this.container.innerHTML = `<div class="empty-state"><p>Hata: ${err.message}</p></div>`;
    }
  }

  renderPage() {
    const { calendar, daysInMonth, upcomingPayments } = this.data;
    const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    const firstDayOfWeek = new Date(this.year, this.month - 1, 1).getDay();

    // Toplam ay
    let monthIncome = 0, monthExpense = 0;
    Object.values(calendar).forEach(d => { monthIncome += d.income; monthExpense += d.expense; });

    return `
      <div class="section-header">
        <h2 class="section-title">📅 Gelir-Gider Takvimi — ${MONTH_NAMES[this.month - 1]} ${this.year}</h2>
      </div>

      <div class="stats-grid" style="margin-bottom:var(--space-md)">
        <div class="stat-card"><div class="stat-value" style="color:var(--accent-primary)">${formatCurrency(monthIncome)}</div><div class="stat-label">Toplam Gelir</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--accent-danger)">${formatCurrency(monthExpense)}</div><div class="stat-label">Toplam Gider</div></div>
        <div class="stat-card"><div class="stat-value" style="color:${monthIncome - monthExpense >= 0 ? 'var(--accent-primary)' : 'var(--accent-danger)'}">${formatCurrency(monthIncome - monthExpense)}</div><div class="stat-label">Net</div></div>
      </div>

      <div class="card fade-in">
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center">
          ${dayNames.map(d => `<div style="font-weight:700;font-size:var(--font-xs);padding:var(--space-sm);color:var(--text-muted)">${d}</div>`).join('')}
          ${Array(firstDayOfWeek).fill('<div></div>').join('')}
          ${Array.from({ length: daysInMonth }, (_, i) => {
            const day = calendar[i + 1];
            const hasData = day && day.hasData;
            const isToday = i + 1 === new Date().getDate() && this.month === new Date().getMonth() + 1 && this.year === new Date().getFullYear();
            const bgColor = !hasData ? '' : day.net > 0 ? 'rgba(76,175,80,0.15)' : day.net < 0 ? 'rgba(244,67,54,0.15)' : '';
            const border = isToday ? 'border:2px solid var(--accent-primary)' : '';

            return `
              <div class="calendar-day" data-day="${i + 1}" style="padding:var(--space-xs);border-radius:var(--radius-sm);cursor:${hasData ? 'pointer' : 'default'};background:${bgColor};${border};min-height:70px">
                <div style="font-size:var(--font-xs);font-weight:${isToday ? '700' : '400'};color:${isToday ? 'var(--accent-primary)' : 'var(--text-primary)'}">${i + 1}</div>
                ${hasData ? `
                  ${day.income > 0 ? `<div style="font-size:9px;color:var(--accent-primary)">+${this._shortCurrency(day.income)}</div>` : ''}
                  ${day.expense > 0 ? `<div style="font-size:9px;color:var(--accent-danger)">-${this._shortCurrency(day.expense)}</div>` : ''}
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      ${upcomingPayments.length > 0 ? `
        <div class="card fade-in mt-md">
          <h3 style="font-weight:700;margin-bottom:var(--space-md)">📋 Yaklaşan Ödemeler</h3>
          ${upcomingPayments.map(p => `
            <div style="display:flex;justify-content:space-between;padding:var(--space-xs) 0;border-bottom:1px solid var(--border-color);font-size:var(--font-sm)">
              <span>${p.name}</span>
              <span style="font-weight:600;color:var(--accent-danger)">${formatCurrency(p.amount)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div id="dayDetail" class="card fade-in mt-md" style="display:none"></div>
    `;
  }

  bindEvents() {
    this.container.querySelectorAll('.calendar-day').forEach(el => {
      el.addEventListener('click', () => {
        const day = parseInt(el.dataset.day);
        const dayData = this.data.calendar[day];
        if (!dayData || !dayData.hasData) return;

        const detail = this.container.querySelector('#dayDetail');
        detail.style.display = 'block';
        detail.innerHTML = `
          <h3 style="font-weight:700;margin-bottom:var(--space-sm)">${day} ${MONTH_NAMES[this.month - 1]} ${this.year}</h3>
          <div class="stats-grid" style="margin-bottom:var(--space-sm)">
            <div class="stat-card"><div class="stat-value" style="font-size:var(--font-md);color:var(--accent-primary)">${formatCurrency(dayData.income)}</div><div class="stat-label">Gelir</div></div>
            <div class="stat-card"><div class="stat-value" style="font-size:var(--font-md);color:var(--accent-danger)">${formatCurrency(dayData.expense)}</div><div class="stat-label">Gider</div></div>
          </div>
          ${dayData.transactions.map(t => `
            <div style="display:flex;justify-content:space-between;padding:var(--space-xs) 0;border-bottom:1px solid var(--border-color);font-size:var(--font-sm)">
              <span>${t.category} — ${t.description || ''}</span>
              <span style="color:${t.type === 'income' ? 'var(--accent-primary)' : 'var(--accent-danger)'};font-weight:600">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</span>
            </div>
          `).join('')}
        `;
      });
    });
  }

  _shortCurrency(n) { return n >= 1000 ? Math.round(n / 1000) + 'K' : Math.round(n) + '₺'; }
}
