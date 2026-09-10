/*
  Catatan pengiriman alert TERAKHIR di StorageAlertState (model di
  prisma/schema.prisma): kanal + hasil + waktu, ditulis cron
  /api/cron/storage-alert setiap kali mencoba mengirim notifikasi.
  Dipakai kartu "Alert Admin (cron)" di Pengaturan untuk menampilkan
  kesehatan jalur alert tanpa menunggu cron berikutnya.
*/
-- AlterTable
ALTER TABLE "StorageAlertState" ADD COLUMN     "lastSendAt" TIMESTAMP(3),
ADD COLUMN     "lastChannelsWhatsapp" BOOLEAN,
ADD COLUMN     "lastChannelsTelegram" BOOLEAN;
