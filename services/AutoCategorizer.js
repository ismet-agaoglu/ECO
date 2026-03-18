// ═══════════════════════════════════════════════════════════════════
// AutoCategorizer — Otomatik Kategorizasyon (Faz 5)
// Merchant mapping + rule-based + öğrenme
// ═══════════════════════════════════════════════════════════════════

class AutoCategorizer {
  constructor(customMappings = {}) {
    // Varsayılan merchant → kategori eşleşmeleri
    this.merchantMap = {
      // Market
      'migros': 'Market', 'bim': 'Market', 'a101': 'Market', 'şok': 'Market',
      'carrefour': 'Market', 'macro': 'Market', 'metro': 'Market', 'file': 'Market',
      'getir': 'Market', 'istegelsin': 'Market', 'trendyol market': 'Market',

      // Akaryakıt
      'shell': 'Akaryakıt', 'bp': 'Akaryakıt', 'opet': 'Akaryakıt',
      'petrol ofisi': 'Akaryakıt', 'total': 'Akaryakıt', 'go': 'Akaryakıt',

      // Yemek
      'yemeksepeti': 'Yemek', 'trendyol yemek': 'Yemek', 'starbucks': 'Yemek',
      'burger king': 'Yemek', 'mcdonalds': 'Yemek', 'dominos': 'Yemek',
      'papa johns': 'Yemek', 'popeyes': 'Yemek', 'kfc': 'Yemek',

      // Ulaşım
      'uber': 'Ulaşım', 'bitaksi': 'Ulaşım', 'istanbulkart': 'Ulaşım',
      'bilet': 'Ulaşım', 'thy': 'Ulaşım', 'pegasus': 'Ulaşım',

      // Giyim
      'lc waikiki': 'Giyim', 'h&m': 'Giyim', 'zara': 'Giyim',
      'koton': 'Giyim', 'defacto': 'Giyim', 'boyner': 'Giyim',
      'mavi': 'Giyim', 'trendyol': 'Giyim',

      // Elektronik
      'teknosa': 'Elektronik', 'mediamarkt': 'Elektronik', 'vatan': 'Elektronik',
      'hepsiburada': 'Elektronik', 'n11': 'Elektronik', 'amazon': 'Elektronik',

      // Sağlık
      'eczane': 'Sağlık', 'hastane': 'Sağlık', 'klinik': 'Sağlık',
      'doktor': 'Sağlık', 'muayene': 'Sağlık',

      // Eğlence
      'netflix': 'Eğlence', 'spotify': 'Eğlence', 'youtube': 'Eğlence',
      'sinema': 'Eğlence', 'cinema': 'Eğlence', 'playstation': 'Eğlence',
      'steam': 'Eğlence', 'disney': 'Eğlence',

      // Faturalar
      'elektrik': 'Faturalar', 'su faturası': 'Faturalar', 'doğalgaz': 'Faturalar',
      'internet': 'Faturalar', 'turkcell': 'Faturalar', 'vodafone': 'Faturalar',
      'türk telekom': 'Faturalar', 'superonline': 'Faturalar',

      ...customMappings
    };

    // Anahtar kelime → kategori (fallback)
    this.keywordMap = {
      'market': 'Market', 'alışveriş': 'Market', 'bakkal': 'Market',
      'benzin': 'Akaryakıt', 'mazot': 'Akaryakıt', 'lpg': 'Akaryakıt',
      'yemek': 'Yemek', 'restoran': 'Yemek', 'kafe': 'Yemek', 'cafe': 'Yemek',
      'kahve': 'Yemek', 'pizza': 'Yemek', 'kebab': 'Yemek',
      'kira': 'Kira', 'ev kirası': 'Kira',
      'fatura': 'Faturalar', 'aidat': 'Faturalar', 'abonelik': 'Faturalar',
      'taksi': 'Ulaşım', 'otobüs': 'Ulaşım', 'metro': 'Ulaşım',
      'uçak': 'Ulaşım', 'otopark': 'Ulaşım',
      'ilaç': 'Sağlık', 'tedavi': 'Sağlık', 'ameliyat': 'Sağlık',
      'okul': 'Eğitim', 'kurs': 'Eğitim', 'kitap': 'Eğitim',
      'taksit': 'Taksit', 'kredi': 'Taksit',
      'maaş': 'Maaş', 'ücret': 'Maaş', 'prim': 'Ek Gelir',
      'ikramiye': 'Ek Gelir', 'freelance': 'Ek Gelir',
      'sigorta': 'Sigorta', 'kasko': 'Sigorta', 'trafik sigortası': 'Sigorta'
    };
  }

  /**
   * Metin veya merchant'a göre kategori tahmin et
   * @returns {{ category: string, confidence: number, method: string }}
   */
  categorize(text) {
    if (!text) return { category: null, confidence: 0, method: 'none' };

    const lower = text.toLowerCase().trim();

    // 1. Tam merchant eşleşme
    for (const [merchant, cat] of Object.entries(this.merchantMap)) {
      if (lower.includes(merchant)) {
        return { category: cat, confidence: 0.95, method: 'merchant_match' };
      }
    }

    // 2. Keyword eşleşme
    for (const [keyword, cat] of Object.entries(this.keywordMap)) {
      if (lower.includes(keyword)) {
        return { category: cat, confidence: 0.75, method: 'keyword_match' };
      }
    }

    // 3. Bilinmeyen
    return { category: 'Diğer', confidence: 0.3, method: 'default' };
  }

  /**
   * Toplu kategorizasyon
   */
  categorizeBatch(items) {
    return items.map(item => ({
      ...item,
      _classification: this.categorize(item.description || item.merchant || '')
    }));
  }

  /**
   * Yeni mapping ekle (öğrenme)
   */
  addMapping(text, category) {
    this.merchantMap[text.toLowerCase()] = category;
  }

  /**
   * Mevcut mappingleri getir
   */
  getMappings() {
    return { merchants: this.merchantMap, keywords: this.keywordMap };
  }
}

module.exports = AutoCategorizer;
