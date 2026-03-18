// ═══════════════════════════════════════════════════════════════════
// ImportPipeline — Veri İçe Aktarma Pipeline'ı (Faz 5)
// raw → parsed → classified → validated → committed
// ═══════════════════════════════════════════════════════════════════

const crypto = require('crypto');

class ImportPipeline {
  constructor({ categories = [], existingTransactions = [] }) {
    this.categories = categories;
    this.existing = existingTransactions;
  }

  /**
   * Aşama 1: Raw veri al, parse et
   * Kaynak: agent, CSV, manuel toplu giriş
   */
  parseRaw(rawItems, source = 'agent') {
    return rawItems.map((item, idx) => ({
      _importId: crypto.randomUUID(),
      _source: source,
      _stage: 'parsed',
      _importedAt: new Date().toISOString(),
      _batchIndex: idx,
      date: item.date || null,
      amount: parseFloat(item.amount) || 0,
      type: item.type || 'expense',
      category: item.category || null,
      description: item.description || '',
      merchant: item.merchant || null,
      raw: item
    }));
  }

  /**
   * Aşama 2: Otomatik sınıflandırma
   */
  classify(parsedItems, autoCategorizer) {
    return parsedItems.map(item => {
      const classification = autoCategorizer
        ? autoCategorizer.categorize(item.description || item.merchant || '')
        : { category: item.category, confidence: item.category ? 0.5 : 0 };

      return {
        ...item,
        _stage: 'classified',
        category: classification.category || item.category,
        _categoryConfidence: classification.confidence || 0,
        _amountConfidence: item.amount > 0 ? 0.9 : 0.3,
        _dateConfidence: item.date ? 0.9 : 0.3,
        _overallConfidence: this._overallConfidence(item, classification)
      };
    });
  }

  /**
   * Aşama 3: Doğrulama
   */
  validate(classifiedItems, duplicateDetector) {
    return classifiedItems.map(item => {
      const errors = [];
      const warnings = [];

      // Zorunlu alan kontrolleri
      if (!item.date) errors.push('Tarih eksik');
      if (!item.amount || item.amount <= 0) errors.push('Tutar geçersiz');
      if (!item.type || !['income', 'expense'].includes(item.type)) errors.push('Tür geçersiz');

      // Tarih formatı
      if (item.date && isNaN(new Date(item.date).getTime())) errors.push('Tarih formatı hatalı');

      // Gelecek tarih uyarısı
      if (item.date && new Date(item.date) > new Date()) warnings.push('Gelecek tarihli işlem');

      // Yüksek tutar uyarısı
      if (item.amount > 50000) warnings.push('Yüksek tutar');

      // Kategori eksikliği
      if (!item.category) warnings.push('Kategori atanmamış');

      // Düşük güven
      if (item._overallConfidence < 0.5) warnings.push('Düşük güven skoru');

      // Duplicate kontrolü
      let duplicates = [];
      if (duplicateDetector) {
        duplicates = duplicateDetector.check(item);
        if (duplicates.length > 0) {
          const best = duplicates[0];
          if (best.type === 'exact_duplicate') errors.push('Muhtemel kopya kayıt');
          else if (best.type === 'probable_duplicate') warnings.push('Benzer kayıt mevcut');
        }
      }

      const status = errors.length > 0 ? 'rejected' : warnings.length > 0 ? 'review_required' : 'ready';

      return {
        ...item,
        _stage: 'validated',
        _status: status,
        _errors: errors,
        _warnings: warnings,
        _duplicates: duplicates.slice(0, 3)
      };
    });
  }

  /**
   * Aşama 4: Onaylanan kayıtları işleme al
   */
  commit(validatedItems) {
    const ready = validatedItems.filter(i => i._status === 'ready' || i._status === 'approved');

    return ready.map(item => ({
      id: item._importId,
      date: item.date,
      amount: item.amount,
      type: item.type,
      category: item.category || 'Diğer',
      description: item.description,
      source: item._source,
      importedAt: item._importedAt,
      confidence: item._overallConfidence,
      isAutoClassified: item._categoryConfidence > 0 && item._categoryConfidence < 1
    }));
  }

  /**
   * Tam pipeline — raw'dan commit'e
   */
  process(rawItems, source, autoCategorizer, duplicateDetector) {
    const parsed = this.parseRaw(rawItems, source);
    const classified = this.classify(parsed, autoCategorizer);
    const validated = this.validate(classified, duplicateDetector);

    const stats = {
      total: validated.length,
      ready: validated.filter(i => i._status === 'ready').length,
      reviewRequired: validated.filter(i => i._status === 'review_required').length,
      rejected: validated.filter(i => i._status === 'rejected').length
    };

    return { items: validated, stats };
  }

  _overallConfidence(item, classification) {
    let score = 0;
    let count = 0;

    if (item.amount > 0) { score += 0.9; count++; }
    if (item.date) { score += 0.9; count++; }
    if (classification.confidence) { score += classification.confidence; count++; }

    return count > 0 ? parseFloat((score / count).toFixed(2)) : 0.3;
  }
}

module.exports = ImportPipeline;
