# Agent Control

OpenClaw için görev merkezi / mission control paneli.

Bu proje, OpenClaw ajanlarını tek panelde görmen, aktifliklerini izlemen, cron job’larını incelemen, ajanlara görev ataman ve bu görevleri dashboard içinden takip etmen için tasarlandı.

## Neler Var?

- **Agent overview**
  - hangi agent var
  - hangi model ile çalışıyor
  - son ne zaman aktif oldu
  - toplam / sıcak session sayısı
  - online / idle / offline durumu

- **Live activity feed**
  - session touch akışı
  - cron run geçmişinden özet olaylar

- **Agent cron map**
  - OpenClaw scheduler’daki job’ları listeler
  - job bazında son durum, hata sayısı, sonraki çalışma zamanı

- **Mission tasks**
  - dashboard içinden görev oluştur
  - görevi belirli bir agente ata
  - tek tıkla çalıştır
  - istersen OpenClaw cron’a bağla

## Mimari

Bu uygulama doğrudan OpenClaw CLI ile konuşur:

- `openclaw agents list --json`
- `openclaw sessions --all-agents --json`
- `openclaw cron list --json`
- `openclaw agent --agent <id> --message <prompt> --json`
- `openclaw cron add ...`

Yani panel kendi UI’ını sağlar ama veriyi ve aksiyonları **OpenClaw’ın gerçek runtime’ından** okur/yazar.

## Stack

- Next.js
- React
- TypeScript
- OpenClaw CLI

## Kurulum

```bash
npm install
npm run dev
```

Prod build:

```bash
npm run build
npm start
```

## Önemli Not

Bu proje `openclaw` binary’sinin sistemde erişilebilir olduğu bir makinede çalışmak üzere tasarlanmıştır.

Yani aşağıdakiler hazır olmalı:

- OpenClaw kurulu olmalı
- gateway / local state erişilebilir olmalı
- CLI komutları terminalden çalışıyor olmalı

## Dashboard’da Görev Çalıştırma

Bir mission task oluşturduğunda sistem bunu yerel `data/tasks.json` içinde takip eder.

- **Run now** → ilgili agente anlık görev yollar
- **Attach cron** → görevi OpenClaw cron job olarak ekler

## Gelecek Adımlar

Planlanan genişletmeler:

- SSE / websocket tabanlı gerçek zamanlı event stream
- cron düzenleme / silme
- agent bazlı filtreler
- görev sonuçlarını structured JSON parse etme
- log paneli
- approvals / nodes / browser / device health entegrasyonu

## Geliştirici Notu

Bu repo şu an hızlı çalışan bir ilk sürüm olarak kuruldu:

- gerçek OpenClaw verisini okuyor
- görev yaratıp çalıştırabiliyor
- cron bağlayabiliyor
- dashboard üzerinden operasyon görünürlüğü sağlıyor

Bir sonraki iterasyonda bunu daha da “control room” hissi veren bir yapıya çevirebiliriz.
