/*
  Waktu terakhir jalur alert diuji manual (StorageAlertState.lastTestedAt):
  diisi oleh POST /api/notifications/test-alert saat minimal satu kanal
  (WhatsApp/Telegram) benar-benar terkirim — bukan saat cron alert jalan.
  Dipakai panel Storage Upload di dashboard untuk menampilkan kapan jalur
  alert terakhir diverifikasi manual.
*/
-- AlterTable
ALTER TABLE "StorageAlertState" ADD COLUMN     "lastTestedAt" TIMESTAMP(3);
