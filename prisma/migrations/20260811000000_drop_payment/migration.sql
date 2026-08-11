-- DropTable
-- SPP dihapus: sekolah negeri tidak memungut SPP. CASCADE ikut
-- menghapus index + foreign key yang menunjuk ke tabel ini.
DROP TABLE IF EXISTS "Payment" CASCADE;
