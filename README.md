# ECO — Kişisel Ekonomi Takip Uygulaması

Evli çiftler için gelir/gider takibi, borç yönetimi, taksit takibi, bütçe kontrolü ve tasarruf planlaması yapan tam kapsamlı finans uygulaması.

## Hızlı Başlangıç

```bash
cd ECO
npm install          # Bağımlılıkları kur
node data/seed.js    # Örnek veri yükle (opsiyonel)
npm start            # Sunucuyu başlat (port 3000)
```

Tarayıcıda aç: **http://localhost:3000**

## Özellikler

| Sayfa | Açıklama |
|---|---|
| 📊 Dashboard | Gelir/gider toplamları, harcama dağılımı, bütçe takibi, yaklaşan ödemeler, öneriler |
| 💸 İşlemler | Yıl → Ay → Hafta drill-down, işlem ekleme/silme |
| 💳 Taksitler | Taksit planları, ilerleme takibi, otomatik aylara yayma |
| 🏦 Borçlar | Faiz hesaplama, snowball/avalanche karşılaştırma, ödeme kaydı |
| 📂 Kategoriler | Kategori bazlı harcama dağılımı, bar chart |
| 📈 Analitik | Finansal oranlar (borç/gelir, tasarruf, faiz yükü), trend grafikler, what-if simülasyonu |
| 🧮 Simülatör | 5 borç ödeme stratejisi karşılaştırma (avalanche, snowball, minimum, agresif, dengeli) |
| 🎯 Tasarruf | 12 aylık projeksiyon, akıllı öneriler |
| 🤖 Agent | OpenClaw agent import kuyruğu, onay/ret akışı, audit log |
| 📝 Notlar | Gayri resmi yükümlülükler, elden taksit, sözel anlaşma → kayda dönüştürme |
| ⚙️ Ayarlar | Bütçe limiti, tekrarlayan harcamalar, veri dışa aktarma |

## Teknoloji

- **Backend:** Node.js + Express.js
- **Frontend:** Vanilla JS (OOP, ES Modules)
- **Depolama:** JSON dosyaları (`data/` klasörü)
- **Tema:** Dark sapphire + mint neon, glassmorphism

## Proje Yapısı

```
ECO/
├── server.js              # Express sunucu
├── routes/api.js          # REST API (1100+ satır)
├── data/                  # JSON veri dosyaları
│   └── seed.js            # Örnek veri yükleyici
├── public/
│   ├── index.html
│   ├── css/style.css      # Tasarım sistemi
│   └── js/
│       ├── app.js          # SPA router
│       ├── services/ApiService.js
│       ├── utils/          # formatters, constants
│       └── components/     # 11 UI bileşeni
```

## Agent Entegrasyonu

Detaylı bilgi için bkz: [API.md](API.md)

```bash
# Harcama ekle (agent)
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"source":"agent","confidence":0.85,"amount":500,"type":"expense","category":"cat-market","description":"Migros"}'

# Dashboard özeti oku
curl http://localhost:3000/api/summary?year=2026&month=3

# Önerileri oku
curl http://localhost:3000/api/recommendations
```

## Yedekleme

`data/` klasörünü kopyalayarak tüm verilerinizi yedekleyebilirsiniz. Uygulamadan da "Verileri Dışa Aktar" ile JSON olarak indirebilirsiniz.
