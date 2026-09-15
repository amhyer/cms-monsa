/*
  Pemisahan catatan kirim uji manual dari kirim cron di StorageAlertState:
  lastTestSendAt + hasil kanal (paralel dengan lastSendAt milik cron).
  Ditulis POST /api/notifications/test-alert pada setiap percobaan uji —
  apa pun hasilnya — sehingga kartu "Alert Admin" di Pengaturan bisa
  menampilkan "Kirim cron terakhir" dan "Uji manual terakhir" secara
  terpisah. lastTestedAt (kolom lama) tetap berarti: uji manual terakhir
  yang SUKSES (minimal satu kanal terkirim).
*/
-- AlterTable
ALTER TABLE "StorageAlertState" ADD COLUMN     "lastTestSendAt" TIMESTAMP(3),
ADD COLUMN     "lastTestChannelsWhatsapp" BOOLEAN,
ADD COLUMN     "lastTestChannelsTelegram" BOOLEAN;
