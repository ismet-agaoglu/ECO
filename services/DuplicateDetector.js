// ═══════════════════════════════════════════════════════════════════
// DuplicateDetector — Yinelenen Kayıt Tespiti (Faz 5)
// Fuzzy match: tarih + tutar + merchant/açıklama
// ═══════════════════════════════════════════════════════════════════

class DuplicateDetector {
  constructor(existingTransactions = []) {
    this.existing = existingTransactions;
  }

  /**
   * Yeni işlemi mevcut kayıtlarla karşılaştır
   * @returns {Array} [{match, score, type}]
   */
  check(newTx) {
    const candidates = [];

    for (const ex of this.existing) {
      const score = this._similarity(newTx, ex);
      if (score >= 0.6) {
        candidates.push({
          existingId: ex.id,
          existing: ex,
          score: parseFloat(score.toFixed(3)),
          type: score >= 0.95 ? 'exact_duplicate' : score >= 0.8 ? 'probable_duplicate' : 'possible_duplicate'
        });
      }
    }

    return candidates.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  /**
   * Toplu kontrol — birden fazla işlem
   */
  checkBatch(newTxs) {
    return newTxs.map(tx => ({
      transaction: tx,
      duplicates: this.check(tx)
    }));
  }

  /**
   * İki işlem arası benzerlik skoru (0–1)
   */
  _similarity(a, b) {
    let score = 0;
    let weights = 0;

    // Tutar eşleşmesi (en önemli) — ağırlık 0.35
    const amountDiff = Math.abs((a.amount || 0) - (b.amount || 0));
    const amountMax = Math.max(a.amount || 1, b.amount || 1);
    const amountSim = amountDiff === 0 ? 1 : Math.max(0, 1 - amountDiff / amountMax);
    score += amountSim * 0.35;
    weights += 0.35;

    // Tarih yakınlığı — ağırlık 0.30
    if (a.date && b.date) {
      const dayDiff = Math.abs(new Date(a.date) - new Date(b.date)) / (1000 * 60 * 60 * 24);
      const dateSim = dayDiff === 0 ? 1 : dayDiff <= 1 ? 0.9 : dayDiff <= 3 ? 0.6 : dayDiff <= 7 ? 0.3 : 0;
      score += dateSim * 0.30;
    }
    weights += 0.30;

    // Tür eşleşmesi — ağırlık 0.10
    if (a.type && b.type) {
      score += (a.type === b.type ? 1 : 0) * 0.10;
    }
    weights += 0.10;

    // Kategori eşleşmesi — ağırlık 0.10
    if (a.category && b.category) {
      score += (a.category === b.category ? 1 : 0) * 0.10;
    }
    weights += 0.10;

    // Açıklama benzerliği — ağırlık 0.15
    if (a.description && b.description) {
      const descSim = this._stringSimilarity(
        (a.description || '').toLowerCase(),
        (b.description || '').toLowerCase()
      );
      score += descSim * 0.15;
    }
    weights += 0.15;

    return weights > 0 ? score / weights * (1 / Math.max(...[0.35, 0.30, 0.10, 0.10, 0.15])) * weights : 0;
  }

  /**
   * Basit string benzerliği (bigram)
   */
  _stringSimilarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;

    const bigramsA = this._bigrams(a);
    const bigramsB = this._bigrams(b);
    if (bigramsA.length === 0 && bigramsB.length === 0) return 1;

    let matches = 0;
    for (const bg of bigramsA) {
      if (bigramsB.includes(bg)) matches++;
    }

    return (2 * matches) / (bigramsA.length + bigramsB.length);
  }

  _bigrams(str) {
    const result = [];
    for (let i = 0; i < str.length - 1; i++) {
      result.push(str.substring(i, i + 2));
    }
    return result;
  }
}

module.exports = DuplicateDetector;
