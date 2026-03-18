// ═══════════════════════════════════════════════════════════════════
// ReportService — PDF Rapor & Yıllık Karşılaştırma (Faz 6)
// PDF oluşturma, yıllık karşılaştırma, vergi özeti
// ═══════════════════════════════════════════════════════════════════

const PDFDocument = require('pdfkit');

class ReportService {
  constructor({ transactions = [], debts = [], recurring = [], snapshots = [] }) {
    this.txs = transactions;
    this.debts = debts;
    this.recurring = recurring;
    this.snapshots = snapshots;
  }

  /**
   * Yıllık karşılaştırma (iki yılı karşılaştır)
   */
  yearlyComparison(year1, year2) {
    const y1 = this._yearSummary(year1);
    const y2 = this._yearSummary(year2);

    const catComparison = {};
    const allCats = new Set([...Object.keys(y1.categories), ...Object.keys(y2.categories)]);
    for (const cat of allCats) {
      catComparison[cat] = {
        year1: y1.categories[cat] || 0,
        year2: y2.categories[cat] || 0,
        delta: (y2.categories[cat] || 0) - (y1.categories[cat] || 0),
        deltaPercent: y1.categories[cat] > 0
          ? Math.round(((y2.categories[cat] || 0) - y1.categories[cat]) / y1.categories[cat] * 100) : null
      };
    }

    return {
      year1: { year: year1, ...y1 },
      year2: { year: year2, ...y2 },
      incomeDelta: y2.totalIncome - y1.totalIncome,
      expenseDelta: y2.totalExpense - y1.totalExpense,
      netDelta: y2.net - y1.net,
      categoryComparison: Object.entries(catComparison)
        .map(([cat, data]) => ({ category: cat, ...data }))
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
      monthlyComparison: this._monthlyComparison(year1, year2)
    };
  }

  /**
   * Vergi hazırlık özeti
   */
  taxSummary(year) {
    const yearTxs = this.txs.filter(t => new Date(t.date).getFullYear() === year);

    const totalIncome = yearTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = yearTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    // Aylık gelir dağılımı
    const monthlyIncome = {};
    yearTxs.filter(t => t.type === 'income').forEach(t => {
      const m = new Date(t.date).getMonth() + 1;
      monthlyIncome[m] = (monthlyIncome[m] || 0) + t.amount;
    });

    // Gider kategorileri (vergi indirimi olabilecekler)
    const deductibleCategories = ['Sağlık', 'Eğitim', 'Sigorta', 'Bağış'];
    const deductibles = {};
    yearTxs.filter(t => t.type === 'expense' && deductibleCategories.includes(t.category)).forEach(t => {
      deductibles[t.category] = (deductibles[t.category] || 0) + t.amount;
    });

    return {
      year,
      totalIncome: Math.round(totalIncome),
      totalExpense: Math.round(totalExpense),
      net: Math.round(totalIncome - totalExpense),
      monthlyIncome: Object.entries(monthlyIncome).map(([m, amt]) => ({
        month: parseInt(m), amount: Math.round(amt)
      })).sort((a, b) => a.month - b.month),
      potentialDeductibles: Object.entries(deductibles).map(([cat, amt]) => ({
        category: cat, amount: Math.round(amt)
      })),
      totalDeductible: Math.round(Object.values(deductibles).reduce((s, v) => s + v, 0)),
      transactionCount: yearTxs.length
    };
  }

  /**
   * PDF rapor oluştur (binary stream döner)
   */
  generatePDF(year, month, data) {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));

    // Başlık
    doc.fontSize(20).text('ECO Finance Tracker', { align: 'center' });
    doc.fontSize(14).text(`Aylık Rapor — ${this._monthName(month)} ${year}`, { align: 'center' });
    doc.moveDown(2);

    // Özet
    doc.fontSize(12).text('ÖZET', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Gelir: ${this._fmt(data.income || 0)}`);
    doc.text(`Gider: ${this._fmt(data.expense || 0)}`);
    doc.text(`Net: ${this._fmt(data.net || 0)}`);
    doc.text(`Toplam Borç: ${this._fmt(data.totalDebt || 0)}`);
    doc.text(`İşlem Sayısı: ${data.transactionCount || 0}`);
    doc.moveDown(1);

    // Kategori dağılımı
    if (data.categoryBreakdown && data.categoryBreakdown.length > 0) {
      doc.fontSize(12).text('KATEGORİ DAĞILIMI', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      for (const cat of data.categoryBreakdown) {
        doc.text(`${cat.category}: ${this._fmt(cat.amount)}`);
      }
      doc.moveDown(1);
    }

    // Borç durumu
    if (data.debtSnapshot && data.debtSnapshot.length > 0) {
      doc.fontSize(12).text('BORÇ DURUMU', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      for (const d of data.debtSnapshot) {
        doc.text(`${d.name}: ${this._fmt(d.balance)} (faiz: %${d.rate})`);
      }
      doc.moveDown(1);
    }

    // Risk
    doc.fontSize(12).text('RİSK DEĞERLENDİRMESİ', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Risk Skoru: ${data.riskScore || 'N/A'}/100 — ${data.riskLabel || 'N/A'}`);
    doc.moveDown(1);

    // Footer
    doc.fontSize(8).text(`Oluşturulma: ${new Date().toLocaleString('tr-TR')}`, { align: 'center' });
    doc.text('ECO Finance Tracker — Kişisel Finans Yönetimi', { align: 'center' });

    doc.end();

    return new Promise(resolve => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  // ─── Helpers ────────────────────────────────────────────────
  _yearSummary(year) {
    const yearTxs = this.txs.filter(t => new Date(t.date).getFullYear() === year);
    const totalIncome = yearTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = yearTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    const categories = {};
    yearTxs.filter(t => t.type === 'expense').forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + t.amount;
    });

    return {
      totalIncome: Math.round(totalIncome),
      totalExpense: Math.round(totalExpense),
      net: Math.round(totalIncome - totalExpense),
      transactionCount: yearTxs.length,
      categories
    };
  }

  _monthlyComparison(year1, year2) {
    const result = [];
    for (let m = 1; m <= 12; m++) {
      const m1Txs = this.txs.filter(t => { const d = new Date(t.date); return d.getFullYear() === year1 && d.getMonth() + 1 === m; });
      const m2Txs = this.txs.filter(t => { const d = new Date(t.date); return d.getFullYear() === year2 && d.getMonth() + 1 === m; });
      result.push({
        month: m,
        year1Income: Math.round(m1Txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)),
        year1Expense: Math.round(m1Txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)),
        year2Income: Math.round(m2Txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)),
        year2Expense: Math.round(m2Txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0))
      });
    }
    return result;
  }

  _monthName(m) {
    return ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'][m - 1];
  }

  _fmt(n) { return Math.round(n).toLocaleString('tr-TR') + ' ₺'; }
}

module.exports = ReportService;
