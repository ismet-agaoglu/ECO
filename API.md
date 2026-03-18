# ECO API Documentation

Base URL: `http://localhost:3000/api`

---

## Transactions

| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/transactions?year=&month=&category=&type=` | İşlem listesi (filtreli) |
| POST | `/transactions` | İşlem ekle |
| PUT | `/transactions/:id` | İşlem güncelle |
| DELETE | `/transactions/:id` | İşlem sil |
| GET | `/transactions/pending` | Agent onay bekleyen işlemler |
| PUT | `/transactions/:id/approve` | İşlemi onayla (düzeltme ile) |
| PUT | `/transactions/:id/reject` | İşlemi reddet |

### POST /transactions
```json
{
  "date": "2026-03-18",
  "amount": 5000,
  "type": "expense",
  "category": "cat-market",
  "description": "Haftalık market",
  "source": "manual|agent",
  "confidence": 0.85
}
```
Agent kaynaklı (`source: "agent"`) işlemler otomatik olarak `status: "pending_review"` alır.

---

## Debts

| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/debts` | Borç listesi |
| POST | `/debts` | Borç ekle |
| PUT | `/debts/:id` | Borç güncelle |
| DELETE | `/debts/:id` | Borç sil |
| POST | `/debts/:id/payments` | Borç ödemesi kaydı ekle |

---

## Installments

| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/installments` | Taksit listesi |
| POST | `/installments` | Taksit ekle (otomatik aylara yayılır) |
| DELETE | `/installments/:id` | Taksit ve ilişkili işlemleri sil |

### POST /installments
```json
{
  "name": "iPhone Taksit",
  "totalAmount": 72000,
  "installmentCount": 12,
  "paidCount": 0,
  "startYear": 2026,
  "startMonth": 3,
  "category": "cat-taksit"
}
```

---

## Notes (Gayri Resmi Yükümlülükler)

| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/notes` | Not listesi |
| POST | `/notes` | Not ekle |
| PUT | `/notes/:id` | Not güncelle |
| DELETE | `/notes/:id` | Not sil |
| POST | `/notes/:id/convert` | Notu yapılandırılmış kayda dönüştür |

---

## Budgets & Recurring

| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/budget/:year/:month` | Bütçe bilgisi |
| POST | `/budget` | Bütçe kaydet/güncelle |
| GET | `/remaining-budget/:year/:month` | Kalan harcama hakkı |
| GET | `/recurring` | Tekrarlayan harcamalar |
| POST | `/recurring` | Tekrarlayan harcama ekle |
| DELETE | `/recurring/:id` | Tekrarlayan harcama sil |

---

## Analytics & Recommendations

| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/summary?year=&month=` | Aylık özet |
| GET | `/categories/summary?year=&month=` | Kategori bazlı harcama |
| GET | `/recommendations` | Akıllı öneriler |
| GET | `/analytics/trends?months=6` | Gelir/gider trendi |
| GET | `/analytics/category-trends?months=6` | Kategori trendleri |
| GET | `/analytics/ratios` | Finansal oranlar |
| GET | `/analytics/what-if?category=&reducePercent=` | What-if simülasyonu |
| GET | `/upcoming-payments` | Yaklaşan ödemeler |
| GET | `/aggregations?year=&month=&groupBy=day|week` | Haftalık/günlük toplamlar |

---

## Debt Strategies

| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/analysis/debt-payoff?extraPayment=` | Borç ödeme analizi |
| GET | `/analysis/strategies?extraPayment=` | 5 strateji karşılaştırma |
| GET | `/analysis/savings` | Tasarruf analizi + projeksiyon |

---

## Audit Log

| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/audit-log?source=&entity=&limit=` | İşlem geçmişi |

---

## How OpenClaw Should Use This App

### Write Endpoints
```bash
# 1. Harcama ekle (otomatik pending_review)
POST /api/transactions
{"source":"agent","confidence":0.85,"amount":500,"type":"expense","category":"cat-market","description":"Migros"}

# 2. Borç ekle
POST /api/debts
{"name":"Yeni Kredi","type":"credit_card","currentBalance":15000,"interestRate":72,"minPayment":3000}

# 3. Not ekle
POST /api/notes
{"source":"agent","title":"Aylık kira","amount":17500,"isObligation":true,"frequency":"monthly"}

# 4. Taksit ekle
POST /api/installments
{"name":"Telefon taksit","totalAmount":36000,"installmentCount":12,"source":"agent"}
```

### Read Endpoints
```bash
# Dashboard özeti
GET /api/summary?year=2026&month=3

# Kalan bütçe
GET /api/remaining-budget/2026/3

# Öneriler (human-readable)
GET /api/recommendations

# Borç stratejileri
GET /api/analysis/strategies?extraPayment=5000

# Kategori harcamaları
GET /api/categories/summary?year=2026&month=3
```

### Safe Sync Recommendations
1. Her zaman `source: "agent"` kullanın
2. `confidence` skoru ekleyin (0-1 arası)
3. Kullanıcı onay akışını atlamamak için `status` alanını zorlamayın
4. Aynı işlemi tekrar göndermemek için `importId` kullanın
5. Audit log'u kontrol edin: `GET /api/audit-log?source=agent`
