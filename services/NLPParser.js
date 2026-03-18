// ═══════════════════════════════════════════════════════════════════
// NLPParser — Doğal Dil → Yapılandırılmış Veri (Faz 5)
// "dün Migros'ta 850 lira harcadım" → {date, amount, category, merchant}
// ═══════════════════════════════════════════════════════════════════

class NLPParser {
  constructor() {
    // Türkçe tarih kalıpları
    this.datePatterns = [
      { regex: /bugün/i, fn: () => this._today() },
      { regex: /dün/i, fn: () => this._daysAgo(1) },
      { regex: /evvelsi\s*gün|önceki\s*gün/i, fn: () => this._daysAgo(2) },
      { regex: /(\d{1,2})\s*(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)/i, fn: (m) => this._parseMonthDay(m) },
      { regex: /(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{2,4})/i, fn: (m) => this._parseDateStr(m) },
      { regex: /(\d{1,2})[\.\/\-](\d{1,2})/i, fn: (m) => this._parseShortDate(m) },
      { regex: /geçen\s*hafta/i, fn: () => this._daysAgo(7) },
      { regex: /bu\s*hafta/i, fn: () => this._today() },
    ];

    // Tutar kalıpları
    this.amountPatterns = [
      /(\d[\d.,]*)\s*(?:tl|₺|lira|TL)/i,
      /(\d[\d.,]*)\s*(?:bin)\s*(?:tl|₺|lira)?/i,
      /(?:tutarı?|fiyat[ıi]?|ücret[i]?|bedel[i]?)\s*[:=]?\s*(\d[\d.,]*)/i,
      /(\d[\d.,]*)\s*(?:kuruş|kr)/i,
    ];

    // Tür kalıpları
    this.typePatterns = {
      expense: [/harca|ödeme|aldım|alındı|fatura|masraf|gider|kira|taksit|market|yemek|benzin|akaryakıt/i],
      income: [/maaş|gelir|kazanç|aldım.*para|havale.*geldi|iade|geri.*ödeme|prim|ikramiye/i]
    };

    // Tekrarlayan kalıpları
    this.recurringPatterns = [
      { regex: /aylık\s+(.*?)(?:\s+(\d[\d.,]*)\s*(?:tl|₺|lira))/i, type: 'monthly' },
      { regex: /haftalık\s+(.*?)(?:\s+(\d[\d.,]*)\s*(?:tl|₺|lira))/i, type: 'weekly' },
      { regex: /her\s+ay\s+(.*?)(?:\s+(\d[\d.,]*)\s*(?:tl|₺|lira))/i, type: 'monthly' },
    ];

    // Taksit kalıpları
    this.installmentPatterns = [
      /(\d+)\s*(?:ay|aylık|taksit)\s+(.*?)\s+(\d[\d.,]*)\s*(?:tl|₺|lira)/i,
      /(.*?)\s+(\d+)\s*taksit\s+(\d[\d.,]*)\s*(?:tl|₺|lira)/i,
      /(\d+)\s*ay\s+(.*?)\s+taksid?i?\s+(\d[\d.,]*)\s*(?:tl|₺|lira)/i,
    ];

    // Merchant / yer kalıpları
    this.merchantPatterns = [
      /(?:da|de|'da|'de|'ta|'te)\s+(\w+)/i,
      /(\w+)'(?:da|de|ta|te)/i,
      /(\w+)\s+(?:market|mağaza|restaurant|restoran|cafe|kafe)/i,
    ];
  }

  /**
   * Doğal dil metnini parse et
   * @returns {Object} parsed transaction data
   */
  parse(text) {
    const result = {
      originalText: text,
      date: this._extractDate(text),
      amount: this._extractAmount(text),
      type: this._extractType(text),
      category: null,
      merchant: this._extractMerchant(text),
      description: text.trim(),
      isRecurring: false,
      isInstallment: false,
      installmentMonths: null,
      confidence: {}
    };

    // Taksit kontrolü
    const installment = this._extractInstallment(text);
    if (installment) {
      result.isInstallment = true;
      result.installmentMonths = installment.months;
      result.amount = installment.amount || result.amount;
      result.description = installment.description || result.description;
    }

    // Tekrarlayan kontrolü
    const recurring = this._extractRecurring(text);
    if (recurring) {
      result.isRecurring = true;
      result.recurringType = recurring.type;
    }

    // Güven skorları
    result.confidence = {
      date: result.date ? 0.85 : 0.2,
      amount: result.amount > 0 ? 0.9 : 0.1,
      type: 0.7,
      overall: this._calcOverallConfidence(result)
    };

    return result;
  }

  /**
   * Birden fazla metin parse et
   */
  parseBatch(texts) {
    return texts.map(t => this.parse(t));
  }

  _extractDate(text) {
    for (const p of this.datePatterns) {
      const match = text.match(p.regex);
      if (match) return p.fn(match);
    }
    return this._today(); // default bugün
  }

  _extractAmount(text) {
    // "bin" çevirisi
    const binMatch = text.match(/(\d+)\s*bin/i);
    if (binMatch) {
      return parseFloat(binMatch[1]) * 1000;
    }

    for (const p of this.amountPatterns) {
      const match = text.match(p);
      if (match) {
        const raw = match[1].replace(/\./g, '').replace(',', '.');
        return parseFloat(raw) || 0;
      }
    }

    // Son çare: metindeki ilk büyük sayıyı al
    const numMatch = text.match(/(\d{2,}[\d.,]*)/);
    if (numMatch) {
      const raw = numMatch[1].replace(/\./g, '').replace(',', '.');
      return parseFloat(raw) || 0;
    }

    return 0;
  }

  _extractType(text) {
    for (const [type, patterns] of Object.entries(this.typePatterns)) {
      for (const p of patterns) {
        if (p.test(text)) return type;
      }
    }
    return 'expense'; // default
  }

  _extractMerchant(text) {
    // Bilinen merchant isimleri
    const knownMerchants = [
      'Migros', 'BİM', 'A101', 'ŞOK', 'Carrefour', 'Trendyol', 'Hepsiburada',
      'Shell', 'BP', 'Opet', 'Petrol Ofisi', 'Starbucks', 'LC Waikiki',
      'Teknosa', 'MediaMarkt', 'Getir', 'Yemeksepeti', 'İstegelsin'
    ];

    const textLower = text.toLowerCase();
    for (const m of knownMerchants) {
      if (textLower.includes(m.toLowerCase())) return m;
    }

    for (const p of this.merchantPatterns) {
      const match = text.match(p);
      if (match && match[1] && match[1].length > 2) return match[1];
    }

    return null;
  }

  _extractInstallment(text) {
    for (const p of this.installmentPatterns) {
      const match = text.match(p);
      if (match) {
        return {
          months: parseInt(match[1]) || parseInt(match[2]) || 0,
          amount: this._extractAmount(text),
          description: text.trim()
        };
      }
    }
    return null;
  }

  _extractRecurring(text) {
    for (const p of this.recurringPatterns) {
      const match = text.match(p.regex);
      if (match) return { type: p.type };
    }
    return null;
  }

  _calcOverallConfidence(result) {
    let score = 0;
    let count = 0;
    if (result.date) { score += 0.85; count++; }
    if (result.amount > 0) { score += 0.9; count++; }
    if (result.type) { score += 0.7; count++; }
    return count > 0 ? parseFloat((score / count).toFixed(2)) : 0.2;
  }

  _today() {
    return new Date().toISOString().split('T')[0];
  }

  _daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  }

  _parseMonthDay(match) {
    const months = { ocak: 1, şubat: 2, mart: 3, nisan: 4, mayıs: 5, haziran: 6, temmuz: 7, ağustos: 8, eylül: 9, ekim: 10, kasım: 11, aralık: 12 };
    const day = parseInt(match[1]);
    const month = months[match[2].toLowerCase()] || 1;
    const year = new Date().getFullYear();
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  _parseDateStr(match) {
    let [_, d, m, y] = match;
    if (y.length === 2) y = '20' + y;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  _parseShortDate(match) {
    const [_, d, m] = match;
    const y = new Date().getFullYear();
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
}

module.exports = NLPParser;
