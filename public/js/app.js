// ═══════════════════════════════════════════════════════════════════
// ECO Finance Tracker — Main Application Entry Point (v2)
// ═══════════════════════════════════════════════════════════════════

import { Navigation } from './components/Navigation.js';
import { Dashboard } from './components/Dashboard.js';
import { TransactionTable } from './components/TransactionTable.js';
import { DebtManager } from './components/DebtManager.js';
import { CategoryView } from './components/CategoryView.js';
import { SavingsView } from './components/SavingsView.js';
import { Settings } from './components/Settings.js';
import { InstallmentsPage } from './components/InstallmentsPage.js';
import { AnalyticsPage } from './components/AnalyticsPage.js';
import { StrategySimulator } from './components/StrategySimulator.js';
import { AgentActivity } from './components/AgentActivity.js';
import { NotesPage } from './components/NotesPage.js';
import { SurvivalDashboard } from './components/SurvivalDashboard.js';
import { TaxPanel } from './components/TaxPanel.js';
import { AnalysisPanel } from './components/AnalysisPanel.js';
import { BehavioralPanel } from './components/BehavioralPanel.js';
import { GoalsPage } from './components/GoalsPage.js';
import { CalendarPage } from './components/CalendarPage.js';
import { ImportPage } from './components/ImportPage.js';
import { ReportsPage } from './components/ReportsPage.js';
import { MONTH_NAMES } from './utils/formatters.js';

class App {
  constructor() {
    this.contentArea = document.getElementById('contentArea');
    this.currentPage = 'dashboard';
    this.currentDate = new Date();
    this.year = this.currentDate.getFullYear();
    this.month = this.currentDate.getMonth() + 1;

    this.modalOverlay = document.getElementById('modalOverlay');
    this.modalTitle = document.getElementById('modalTitle');
    this.modalBody = document.getElementById('modalBody');
    this.modalClose = document.getElementById('modalClose');
    this.toastContainer = document.getElementById('toastContainer');

    this.nav = new Navigation((page) => this.navigate(page));

    this.updateMonthLabel();
    document.getElementById('prevMonth')?.addEventListener('click', () => this.changeMonth(-1));
    document.getElementById('nextMonth')?.addEventListener('click', () => this.changeMonth(1));

    this.modalClose?.addEventListener('click', () => this.closeModal());
    this.modalOverlay?.addEventListener('click', (e) => {
      if (e.target === this.modalOverlay) this.closeModal();
    });

    // Theme toggle
    this.initTheme();

    this.navigate('dashboard');
  }

  helpers() {
    return {
      onToast: (msg, type) => this.showToast(msg, type),
      openModal: (title, body) => this.openModal(title, body),
      closeModal: () => this.closeModal()
    };
  }

  async navigate(page) {
    this.currentPage = page;
    this.nav.setActive(page);
    this.contentArea.scrollTop = 0;

    const h = this.helpers();
    switch (page) {
      case 'dashboard':     { const c = new Dashboard(this.contentArea, this.year, this.month); await c.render(); break; }
      case 'survival':      { const c = new SurvivalDashboard(this.contentArea, h); await c.render(); break; }
      case 'tax':            { const c = new TaxPanel(this.contentArea, h); await c.render(); break; }
      case 'transactions':  { const c = new TransactionTable(this.contentArea, this.year, this.month, h); await c.render(); break; }
      case 'installments':  { const c = new InstallmentsPage(this.contentArea, h); await c.render(); break; }
      case 'debts':         { const c = new DebtManager(this.contentArea, h); await c.render(); break; }
      case 'categories':    { const c = new CategoryView(this.contentArea, this.year, this.month, h); await c.render(); break; }
      case 'analysis':      { const c = new AnalysisPanel(this.contentArea, this.year, this.month, h); await c.render(); break; }
      case 'behavioral':    { const c = new BehavioralPanel(this.contentArea, this.year, this.month, h); await c.render(); break; }
      case 'analytics':     { const c = new AnalyticsPage(this.contentArea); await c.render(); break; }
      case 'simulator':     { const c = new StrategySimulator(this.contentArea); await c.render(); break; }
      case 'savings':       { const c = new SavingsView(this.contentArea); await c.render(); break; }
      case 'goals':         { const c = new GoalsPage(this.contentArea, h); await c.render(); break; }
      case 'calendar':      { const c = new CalendarPage(this.contentArea, this.year, this.month, h); await c.render(); break; }
      case 'import':        { const c = new ImportPage(this.contentArea, h); await c.render(); break; }
      case 'reports':       { const c = new ReportsPage(this.contentArea, this.year, this.month, h); await c.render(); break; }
      case 'agent':         { const c = new AgentActivity(this.contentArea, h); await c.render(); break; }
      case 'notes':         { const c = new NotesPage(this.contentArea, h); await c.render(); break; }
      case 'settings':      { const c = new Settings(this.contentArea, this.year, this.month, h); await c.render(); break; }
      default: this.contentArea.innerHTML = '<div class="empty-state"><p>Sayfa bulunamadı</p></div>';
    }
  }

  changeMonth(delta) {
    this.month += delta;
    if (this.month > 12) { this.month = 1; this.year++; }
    if (this.month < 1) { this.month = 12; this.year--; }
    this.updateMonthLabel();
    this.navigate(this.currentPage);
  }

  updateMonthLabel() {
    const label = document.getElementById('currentMonth');
    if (label) label.textContent = `${MONTH_NAMES[this.month - 1]} ${this.year}`;
  }

  // Theme
  initTheme() {
    const saved = localStorage.getItem('eco-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.textContent = saved === 'dark' ? '☀️' : '🌙';
      btn.addEventListener('click', () => this.toggleTheme());
    }
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('eco-theme', next);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
  }

  openModal(title, bodyHTML) {
    this.modalTitle.textContent = title;
    this.modalBody.innerHTML = bodyHTML;
    this.modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  closeModal() {
    this.modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    this.toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => { window.app = new App(); });
