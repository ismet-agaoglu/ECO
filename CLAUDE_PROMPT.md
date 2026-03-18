# ECO Finance Tracker — Claude Code Devam Promptu

Aşağıdaki metni Claude Code'a yapıştır:

---

## Prompt

```
Bu proje bir kişisel/aile finans takip uygulaması (ECO Finance Tracker). Node.js + Express.js + Vanilla JS + JSON dosyaları kullanıyor. `c:\Users\İsmet\Desktop\web\ECO` dizininde.

Sunucu: `node server.js` → http://localhost:3000
Veri: `data/` klasöründe JSON dosyaları (transactions, debts, recurring, categories, budgets, crisis_transactions)
Frontend: `public/js/` altında ES module yapısı (app.js → components + services + utils)
Backend: `routes/api.js` (tüm API endpoint'leri tek dosyada), `services/` altında business logic

## TAMAMLANAN FAZLAR

### Faz 0 — Survival Engine ✅
- `services/SurvivalEngine.js` — S1-S12: hayatta kalma motoru, borç büyüme testi, break-even, konsolidasyon simülatörü
- `services/CrisisEngine.js` — S13-S21: kriz likidite, döngü tespiti, karar motoru
- `public/js/components/SurvivalDashboard.js` — Hayatta Kalma sayfası UI
- API: /survival/status, /survival/consolidation-sim, /survival/crisis-analysis, /crisis-transactions (CRUD), /survival/cycle-detection

### Faz 1 — Vergi & Maaş & Ek Mesai ✅
- `services/TaxService.js` — T1-T7: TR 2026 kümülatif vergi (15/20/27/35/40%), dilim kırılma, maaş projeksiyon, teşvik erimesi, vergi optimizasyonu
- `services/OvertimeService.js` — T9-T15: marjinal net kazanç, saat başı net, değme skoru, eşik analizi, hedef hesaplama, borç yönlendirme, survival bağlantısı
- `public/js/components/TaxPanel.js` — Vergi & Maaş sayfası (12 ay bar chart, ek mesai simülatörü)
- NOT: Yorgunluk faktörü ve SGK satırı kullanıcı isteğiyle kaldırıldı. Kullanıcı doktor, SGK/işsizlik gösterimi gereksiz.
- API: /tax/simulate-year, /tax/bracket-forecast, /tax/marginal-rate, /tax/extra-income-sim, /tax/optimize, /overtime/simulate, /overtime/target, /overtime/debt-advice, /overtime/survival-impact

### Faz 2 — Finans Motoru ✅
- `services/InterestModels.js` — A1-A6: DailyCompoundingInterest (KK), MonthlyCompoundingInterest (KMH), AnnuityLoanModel (kredi), BSMV %10 + KKDF %15, min ödeme tuzağı sim, 3-senaryo nakit akışı, borç önceliklendirme skoru
- API: /finance/interest-info, /finance/min-payment-trap, /finance/cashflow, /finance/debt-priority, /finance/amortization/:debtId, /finance/source-types

### Faz 3 — Akıllı Analiz (BACKEND YAZILDI, API+UI EKSİK)
- `services/AnalysisEngine.js` — B1-B9: monthly snapshot, net worth, likidite risk, constraint optimization, forecast (linear regression), kategori tahmini, sapma analizi, dönem sonu tahmini, tasarruf potansiyeli
- ⚠️ Bu servisin API endpoint'leri ve frontend UI'ı henüz yazılmadı!

## KALANLARI YAPILACAKLAR

1. **Faz 3 tamamla**: AnalysisEngine.js için API endpoint'leri + frontend component ekle
2. **Faz 4 — Davranışsal Finans (8 özellik)**: Harcama pattern, anomali tespiti, what changed panel, financial stress view, maaş erime analizi, risk skoru, günlük limit, Monte Carlo stres testi
3. **Faz 5 — Agent + Pipeline (11 özellik)**: Duplicate detection, import pipeline, NLP, otomatik kategorizasyon, bildirim sistemi
4. **Faz 6 — UX & Raporlama (9 özellik)**: Chart.js, takvim, hedef simülasyon, PDF rapor, yıllık karşılaştırma, PWA, responsive

## ÖNEMLİ KURALLAR

- Tüm metin Türkçe (UI etiketleri, mesajlar, yorumlar)
- Frontend: Vanilla JS, ES modules, `export class ...` pattern
- Her yeni sayfa için: constants.js'e nav item ekle, app.js'e route ekle, ApiService.js'e method ekle
- Mevcut CSS kullanılıyor (var(--accent-primary), var(--surface-2), card, stats-grid, btn gibi class'lar)
- api.js'deki readData() ve writeData() helper'ları kullan
- Kullanıcı doktor — SGK/işsizlik detayları gereksiz

Detaylı implementasyon planı: implementation_plan.md dosyasına bak (76 özellik tablo halinde).

Faz 3'ü tamamla (API endpoint'leri + UI), sonra Faz 4'e geç.
```

---

Bu promptu Claude Code'a verdiğinde projeyi sorunsuz devam ettirebilir.
