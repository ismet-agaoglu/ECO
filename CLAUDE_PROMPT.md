# ECO Finance Tracker — Claude Code Devam Promptu

Aşağıdaki metni Claude Code'a yapıştır:

---

## Prompt

```
Bu proje bir kişisel/aile finans takip uygulaması (ECO Finance Tracker). Node.js + Express.js + Vanilla JS + JSON dosyaları kullanıyor. `c:\Users\İsmet\Desktop\web\ECO` dizininde.

Sunucu: `node server.js` → http://localhost:3000
Veri: `data/` klasöründe JSON dosyaları (transactions, debts, recurring, categories, budgets, installments, notes, auditlog, crisis_transactions, goals, snapshots, settings)
Frontend: `public/js/` altında ES module yapısı (app.js → components + services + utils)
Backend: `routes/api.js` (tüm API endpoint'leri tek dosyada), `services/` altında business logic

## TAMAMLANAN FAZLAR (6/6 — TÜMÜ TAMAMLANDI)

### Faz 0 — Survival Engine ✅
- `services/SurvivalEngine.js` — S1-S12: hayatta kalma motoru, borç büyüme testi, break-even, konsolidasyon simülatörü
- `services/CrisisEngine.js` — S13-S21: kriz likidite, döngü tespiti, karar motoru
- `public/js/components/SurvivalDashboard.js` — Hayatta Kalma sayfası UI
- API: /survival/status, /survival/consolidation-sim, /survival/sustainability, /survival/crisis-analysis, /survival/cycle-detection, /crisis-transactions (CRUD)

### Faz 1 — Vergi & Maaş & Ek Mesai ✅
- `services/TaxService.js` — T1-T7: TR 2026 kümülatif vergi (15/20/27/35/40%), dilim kırılma, maaş projeksiyon, teşvik erimesi, vergi optimizasyonu
- `services/OvertimeService.js` — T9-T15: marjinal net kazanç, saat başı net, değme skoru, eşik analizi, hedef hesaplama, borç yönlendirme, survival bağlantısı
- `public/js/components/TaxPanel.js` — Vergi & Maaş sayfası (12 ay bar chart, ek mesai simülatörü)
- NOT: Yorgunluk faktörü ve SGK satırı kullanıcı isteğiyle kaldırıldı. Kullanıcı doktor, SGK/işsizlik gösterimi gereksiz.
- API: /tax/simulate-year, /tax/bracket-forecast, /tax/marginal-rate, /tax/extra-income-sim, /tax/optimize, /overtime/simulate, /overtime/target, /overtime/debt-advice, /overtime/survival-impact

### Faz 2 — Finans Motoru ✅
- `services/InterestModels.js` — A1-A6: DailyCompoundingInterest (KK), MonthlyCompoundingInterest (KMH), AnnuityLoanModel (kredi), BSMV %10 + KKDF %15, min ödeme tuzağı sim, 3-senaryo nakit akışı, borç önceliklendirme skoru
- API: /finance/interest-info, /finance/min-payment-trap, /finance/cashflow, /finance/debt-priority, /finance/amortization/:debtId, /finance/source-types

### Faz 3 — Akıllı Analiz ✅
- `services/AnalysisEngine.js` — B1-B9: monthly snapshot, net worth, likidite risk, constraint optimization, forecast (linear regression), kategori tahmini, sapma analizi, dönem sonu tahmini, tasarruf potansiyeli
- `public/js/components/AnalysisPanel.js` — Akıllı Analiz sayfası UI
- API: /analysis/snapshot, /analysis/net-worth, /analysis/liquidity-risk, /analysis/constraint-optimization, /analysis/forecast, /analysis/category-forecast, /analysis/deviation, /analysis/end-of-month, /analysis/savings-potential, /analysis/full, /analysis/debt-payoff, /analysis/savings, /analysis/strategies

### Faz 4 — Davranışsal Finans ✅
- `services/BehavioralEngine.js` — Harcama pattern, anomali tespiti, what changed panel, financial stress view, maaş erime analizi, risk skoru, günlük limit, Monte Carlo stres testi
- `public/js/components/BehavioralPanel.js` — Davranışsal Analiz sayfası UI
- API: /behavioral/patterns, /behavioral/anomalies, /behavioral/what-changed, /behavioral/stress, /behavioral/salary-erosion, /behavioral/risk-score, /behavioral/daily-limit, /behavioral/monte-carlo, /behavioral/full

### Faz 5 — Agent + Pipeline ✅
- `services/NLPParser.js` — Doğal dil ile işlem girişi
- `services/ImportPipeline.js` — Banka ekstresi import
- `services/DuplicateDetector.js` — Tekrar eden işlem tespiti
- `services/AutoCategorizer.js` — Otomatik kategorizasyon
- `services/NotificationService.js` — Bildirim sistemi
- `services/SnapshotService.js` — Aylık anlık görüntüler
- `services/ActionEngine.js` — Agent aksiyon motoru
- `public/js/components/ImportPage.js` — Import sayfası UI
- `public/js/components/AgentActivity.js` — Agent aktivite sayfası UI
- API: /nlp/parse, /import/process, /import/commit, /duplicate/check, /categorize, /categorize/mappings, /notifications, /snapshots, /snapshots/generate, /snapshots/trend, /actions, /actions/validate-plan, /actions/reverse-goal, /audit-log, /transactions/pending, /transactions/:id/approve, /transactions/:id/reject

### Faz 6 — UX & Raporlama ✅
- `services/GoalService.js` — Hedef simülasyon ve reverse hesaplama
- `services/InflationService.js` — Enflasyon etki analizi
- `services/ReportService.js` — PDF rapor, yıllık karşılaştırma, vergi özeti
- `public/js/components/GoalsPage.js` — Hedefler sayfası UI
- `public/js/components/CalendarPage.js` — Takvim sayfası UI
- `public/js/components/ReportsPage.js` — Raporlar sayfası UI
- Responsive CSS tamamlandı (768px / 480px breakpoints)
- API: /goals (CRUD), /goals/simulate/:id, /goals/reverse-calc, /inflation/future-value, /inflation/past-value, /inflation/expense-projection, /inflation/salary-erosion, /reports/yearly-comparison, /reports/tax-summary, /reports/pdf, /calendar

## ÖNEMLİ KURALLAR

- Tüm metin Türkçe (UI etiketleri, mesajlar, yorumlar)
- Frontend: Vanilla JS, ES modules, `export class ...` pattern
- Her yeni sayfa için: constants.js'e nav item ekle, app.js'e route ekle, ApiService.js'e method ekle
- Mevcut CSS kullanılıyor (var(--accent-primary), var(--surface-2), card, stats-grid, btn gibi class'lar)
- api.js'deki readData() ve writeData() helper'ları kullan
- Kullanıcı doktor — SGK/işsizlik detayları gereksiz

Tüm 6 faz tamamlandı. Yeni özellikler veya iyileştirmeler için bu yapıyı temel al.
```

---

Bu promptu Claude Code'a verdiğinde projeyi sorunsuz devam ettirebilir.
