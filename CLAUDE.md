# ECO — Kişisel Ekonomi Takip Uygulaması

## Proje Özeti
Node.js + Express tabanlı, vanilla JS frontend ile yazılmış kişisel finans takip uygulaması.
Veritabanı yok — veriler `data/` klasöründeki JSON dosyalarında tutulur.

## Sunucu Başlatma
```bash
node server.js        # http://localhost:3000
```

## Klasör Yapısı
```
ECO/
├── server.js              # Express sunucusu, tüm API route'ları
├── routes/
│   └── api.js             # REST API endpoint tanımları
├── data/                  # JSON veri dosyaları (git'e dahil değil)
│   ├── transactions.json  # Gelir/gider işlemleri
│   ├── debts.json         # Borç kayıtları
│   ├── installments.json  # Taksit planları
│   ├── goals.json         # Birikim hedefleri
│   ├── recurring.json     # Tekrarlayan harcamalar
│   ├── notes.json         # Notlar & yükümlülükler
│   ├── snapshots.json     # Aylık anlık görüntüler
│   └── auditlog.json      # Denetim geçmişi (audit log)
└── public/
    ├── index.html
    ├── css/style.css
    └── js/
        ├── app.js                    # Router, tema, navigasyon
        ├── utils/
        │   ├── constants.js          # NAV_ITEMS, sabitler
        │   ├── formatters.js         # Para/tarih formatlama
        │   └── api.js                # fetch wrapper
        └── components/               # Her sayfa bir bileşen
            ├── Dashboard.js
            ├── TransactionTable.js
            ├── DebtManager.js
            ├── InstallmentsPage.js
            ├── CategoryView.js
            ├── AnalyticsPage.js
            ├── AnalysisPanel.js
            ├── BehavioralPanel.js
            ├── StrategySimulator.js
            ├── SavingsView.js
            ├── GoalsPage.js
            ├── CalendarPage.js
            ├── ReportsPage.js
            ├── SurvivalDashboard.js
            ├── TaxPanel.js
            ├── ImportPage.js
            ├── AgentActivity.js
            ├── NotesPage.js
            ├── Settings.js
            └── Navigation.js
```

## API Endpoint'leri

### İşlemler
```
GET    /api/transactions              # Tüm işlemleri getir
POST   /api/transactions              # Yeni işlem ekle
DELETE /api/transactions/:id          # İşlem sil
```

**İşlem Şeması:**
```json
{
  "id": "uuid",
  "date": "2026-03-18",
  "type": "income | expense",
  "amount": 5000,
  "category": "market",
  "description": "Haftalık alışveriş",
  "source": "manuel | agent | import"
}
```

### Borçlar
```
GET    /api/debts                     # Tüm borçlar
POST   /api/debts                     # Yeni borç ekle
DELETE /api/debts/:id                 # Borç sil
```

**Borç Şeması:**
```json
{
  "id": "uuid",
  "name": "Yapı Kredi Kredi Kartı",
  "type": "kredi-karti | kredi | ek-hesap | diger",
  "balance": 72000,
  "interestRate": 3.5,       // Aylık faiz oranı (%)
  "minPayment": 8000
}
```

### Taksitler
```
GET    /api/installments              # Tüm taksitler
POST   /api/installments              # Yeni taksit ekle
DELETE /api/installments/:id          # Taksit sil
```

**Taksit Şeması:**
```json
{
  "id": "uuid",
  "name": "iPhone 15 Pro",
  "totalAmount": 80000,
  "monthlyPayment": 6666.67,
  "remainingMonths": 10,
  "startDate": "2025-11-01",
  "category": "elektronik"
}
```

### Hedefler
```
GET    /api/goals                     # Tüm hedefler
POST   /api/goals                     # Yeni hedef ekle
PUT    /api/goals/:id                 # Hedef güncelle (katkı ekle)
DELETE /api/goals/:id                 # Hedef sil
```

**Hedef Şeması:**
```json
{
  "id": "uuid",
  "name": "Acil Fon",
  "targetAmount": 100000,
  "currentAmount": 15000,
  "deadline": "2026-12-31",
  "category": "tasarruf"
}
```

### Tekrarlayan Harcamalar
```
GET    /api/recurring                 # Tüm tekrarlayan harcamalar
POST   /api/recurring                 # Yeni ekle
DELETE /api/recurring/:id             # Sil
```

### Notlar
```
GET    /api/notes                     # Tüm notlar
POST   /api/notes                     # Yeni not ekle
PUT    /api/notes/:id                 # Not güncelle
DELETE /api/notes/:id                 # Not sil
```

### Bildirimler & Özet
```
GET    /api/notifications             # Uyarılar ve bildirimler
GET    /api/summary?month=3&year=2026 # Aylık özet
GET    /api/audit-log                 # Denetim geçmişi (otomatik kaydedilir)
```

### Agent Onay Sistemi
```
GET    /api/transactions/pending      # Onay bekleyen işlemler
PUT    /api/transactions/:id/approve  # İşlemi onayla
PUT    /api/transactions/:id/reject   # İşlemi reddet
```

## Agent Kullanım Rehberi

### Yeni İşlem Ekleme (Agent olarak)
```bash
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-03-18",
    "type": "expense",
    "amount": 850,
    "category": "market",
    "description": "Migros alışverişi",
    "source": "agent"
  }'
```

### Özet Sorgulama
```bash
curl "http://localhost:3000/api/summary?month=3&year=2026"
```

### Bildirim/Uyarı Kontrolü
```bash
curl http://localhost:3000/api/notifications
```

## Kategori Listesi (Türkçe)
- `market` — Market & Süpermarket
- `kira` — Kira & Konut
- `faturalar` — Faturalar (elektrik, su, gaz)
- `ulasim` — Ulaşım
- `yemek` — Dışarıda Yemek
- `saglik` — Sağlık
- `egitim` — Eğitim
- `eglence` — Eğlence & Abonelik
- `giyim` — Giyim
- `elektronik` — Elektronik
- `akaryakit` — Akaryakıt
- `cocuk` — Çocuk Harcamaları
- `maas` — Maaş (gelir)
- `ek-gelir` — Ek Gelir
- `yatirim` — Yatırım Getirisi
- `diger` — Diğer

## Önemli Kurallar
1. `data/` klasöründeki JSON dosyalarını doğrudan düzenleme, her zaman API kullan
2. Silme işlemlerinde dikkatli ol — geri alma yok
3. Agent işlemlerini kaydetmek için `source: "agent"` kullan
4. Büyük miktarlar (>10.000₺) için onay sistemi kullan (`/api/transactions/pending`)
5. Tarih formatı her zaman `YYYY-MM-DD`
6. Para birimleri Türk Lirası (₺), kuruş yok — tam sayı kullan

## Tipik Agent Görevleri

### Aylık Rapor
```javascript
// Mart 2026 özeti al
fetch('/api/summary?month=3&year=2026')
  .then(r => r.json())
  .then(data => {
    console.log('Gelir:', data.income);
    console.log('Gider:', data.expense);
    console.log('Net:', data.net);
  });
```

### Bütçe Kontrolü
```javascript
fetch('/api/notifications')
  .then(r => r.json())
  .then(alerts => {
    const budgetAlert = alerts.find(a => a.type === 'budget');
    if (budgetAlert) console.log('⚠️ Bütçe uyarısı:', budgetAlert.message);
  });
```

### Toplu İşlem Aktarımı (Banka ekstresi)
```javascript
const transactions = [
  { date: '2026-03-15', type: 'expense', amount: 500, category: 'market', description: 'BIM' },
  { date: '2026-03-14', type: 'expense', amount: 2800, category: 'akaryakit', description: 'Benzin' }
];

for (const tx of transactions) {
  await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...tx, source: 'agent' })
  });
}
```

## CSS Tasarım Sistemi
- **Tema:** Dark default, `[data-theme="light"]` ile açık tema
- **CSS Variables:** `--accent-primary`, `--surface-2`, `--text-primary`, `--text-muted`
- **Breakpoints:** 768px (sidebar gizle), 480px (tek kolon)
- **Utility sınıfları:** `.card`, `.btn`, `.badge-*`, `.stats-grid`, `.data-table`, `.table-responsive`

## Git & Deploy
```bash
git add -A && git commit -m "açıklama"
git push origin main    # GitHub: https://github.com/ismet-agaoglu/ECO
```
