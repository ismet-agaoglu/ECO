// ═══════════════════════════════════════════════════════════════════
// Navigation Component
// ═══════════════════════════════════════════════════════════════════

import { NAV_ITEMS } from '../utils/constants.js';

const NAV_GROUPS = [
  { label: 'ANA',       items: ['dashboard'] },
  { label: 'FİNANS',    items: ['transactions', 'installments', 'debts', 'categories'] },
  { label: 'ANALİZ',    items: ['analytics', 'analysis', 'behavioral', 'simulator'] },
  { label: 'PLANLAMA',  items: ['savings', 'goals', 'calendar', 'reports'] },
  { label: 'ARAÇLAR',   items: ['survival', 'tax', 'import', 'agent', 'notes'] },
  { label: null,         items: ['settings'] }
];

export class Navigation {
  constructor(onNavigate) {
    this.onNavigate = onNavigate;
    this.activeId = 'dashboard';
    this.navListEl = document.getElementById('navList');
    this.sidebarEl = document.getElementById('sidebar');
    this.mobileMenuBtn = document.getElementById('mobileMenuBtn');

    this.render();
    this.bindEvents();
  }

  render() {
    const itemMap = Object.fromEntries(NAV_ITEMS.map(item => [item.id, item]));

    this.navListEl.innerHTML = NAV_GROUPS.map(group => {
      const labelHtml = group.label
        ? `<li class="nav-group-label">${group.label}</li>`
        : '';

      const itemsHtml = group.items
        .filter(id => itemMap[id])
        .map(id => {
          const item = itemMap[id];
          return `
            <li class="nav-item">
              <a class="nav-link ${item.id === this.activeId ? 'active' : ''}"
                 data-page="${item.id}" id="nav-${item.id}">
                <span class="nav-icon">${item.icon}</span>
                <span class="nav-label">${item.label}</span>
              </a>
            </li>`;
        })
        .join('');

      return labelHtml + itemsHtml;
    }).join('');

    // Update current date
    const dateEl = document.getElementById('currentDate');
    const now = new Date();
    dateEl.textContent = new Intl.DateTimeFormat('tr-TR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(now);
  }

  bindEvents() {
    this.navListEl.addEventListener('click', (e) => {
      const link = e.target.closest('.nav-link');
      if (!link) return;

      const page = link.dataset.page;
      this.setActive(page);
      this.onNavigate(page);

      // Close on mobile
      this.sidebarEl.classList.remove('open');
    });

    this.mobileMenuBtn?.addEventListener('click', () => {
      this.sidebarEl.classList.toggle('open');
    });
  }

  setActive(pageId) {
    this.activeId = pageId;
    this.navListEl.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.page === pageId);
    });

    // Update page title
    const item = NAV_ITEMS.find(i => i.id === pageId);
    if (item) {
      document.getElementById('pageTitle').textContent = item.label;
    }
  }
}
