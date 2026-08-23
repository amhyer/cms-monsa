import { PrismaClient } from "@prisma/client";
import { slugify } from "../src/lib/format.ts";
import { hashPassword } from "../src/lib/password.ts";

const db = new PrismaClient();

function img(seed: string, w = 1200, h = 700) {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}
function avatar(n: number) {
  return `https://i.pravatar.cc/400?img=${n}`;
}

async function main() {
  console.log("🌱 Seeding UPT SPF SD Negeri Unggulan Mongisidi 1...");

  // Guard: jangan pernah menimpa database yang sudah berisi data.
  // Seed hanya boleh dijalankan sekali di database kosong (fresh install).
  const existingUsers = await db.user.count();
  if (existingUsers > 0) {
    console.log(`⚠️  Database sudah berisi ${existingUsers} akun — seed dilewati.`);
    console.log("    (Jalankan hanya di database kosong: reset DB atau db push baru)");
    return;
  }

  // Wipe (hanya aman di database baru/duplikat dev)
  await db.activityLog.deleteMany();
  await db.contactMessage.deleteMany();
  await db.news.deleteMany();
  await db.announcement.deleteMany();
  await db.agenda.deleteMany();
  await db.teacher.deleteMany();
  await db.student.deleteMany();
  await db.class.deleteMany();
  await db.galleryItem.deleteMany();
  await db.achievement.deleteMany();
  await db.orgStructure.deleteMany();
  await db.bosExpenditure.deleteMany();
  await db.bosDocument.deleteMany();
  await db.user.deleteMany();
  await db.siteSetting.deleteMany();

  // ---------- USERS ----------
  const admin = await db.user.create({
    data: {
      name: "Nawawi Hamzah, S.Pd., M.Pd.",
      email: "admin@mongisidi1.sch.id",
      password: hashPassword("admin123"),
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  const op1 = await db.user.create({
    data: {
      name: "Siti Aminah, S.Pd.",
      email: "operator@mongisidi1.sch.id",
      password: hashPassword("operator123"),
      role: "OPERATOR",
      isActive: true,
    },
  });

  const op2 = await db.user.create({
    data: {
      name: "Muhammad Yusuf, S.Pd.",
      email: "yusuf@mongisidi1.sch.id",
      password: hashPassword("operator123"),
      role: "OPERATOR",
      isActive: true,
    },
  });

  // Akun guru contoh — wali kelas diisi manual oleh admin di dashboard
  // (Manajemen Akun → role "Guru" → pilih Wali Kelas).
  await db.user.create({
    data: {
      name: "Andi Mappangara, S.Pd.",
      email: "guru@mongisidi1.sch.id",
      password: hashPassword("guru123"),
      role: "GURU",
      guardianClassId: null,
      isActive: true,
    },
  });

  await db.user.create({
    data: {
      name: "Fatimah Zahra, S.Pd.",
      email: "fatimah@mongisidi1.sch.id",
      password: hashPassword("operator123"),
      role: "OPERATOR",
      isActive: false,
    },
  });

  // ---------- SITE SETTINGS ----------
  await db.siteSetting.create({
    data: {
      id: "singleton",
      schoolName: "UPT SPF SD Negeri Unggulan Mongisidi 1",
      npsn: "40313912",
      logo: null,
      address:
        "Jln. Wr. Monginsidi No.13, Kel. Maricaya Baru, Kec. Makasar, Kota Makassar, Sulawesi Selatan 90142",
      phone: "04118918116",
      email: "sdn.unggulanmonginsidi@yahoo.co.id",
      mapEmbed:
        "https://www.google.com/maps?q=Jln.+Wr.+Monginsidi+No.13+Maricaya+Baru+Makassar+Sulawesi+Selatan&output=embed",
      vision:
        "Sekolah yang berbudaya Unggul dan berwawasan lingkungan berdasarkan iman dan Taqwa.",
      mission:
        "1. Memperkuat kepribadian berlandaskan Etika, Logika, dan Estetika.\n2. Mewujudkan pembelajaran aktif, kreatif, inovatif, dan menyenangkan berbasis literasi dan numerasi.\n3. Menumbuhkan budaya unggul dan wawasan lingkungan melalui pembiasaan di sekolah.\n4. Mengembangkan pendidikan inklusi yang ramah anak berkebutuhan khusus.\n5. Meningkatkan kompetensi pendidik dan tenaga kependidikan secara berkelanjutan.\n6. Menjalin kemitraan dengan orang tua, komite sekolah, dan masyarakat.",
      history:
        "UPT SPF SD Negeri Unggulan Mongisidi 1 didirikan pada 31 Desember 1995 dan berlokasi di Jln. Wr. Monginsidi No.13, Maricaya Baru, Makassar. Berdiri di atas lahan strategis di pusat Kota Makassar, sekolah ini tumbuh menjadi salah satu sekolah dasar unggulan di Sulawesi Selatan. Dengan akreditasi A (SK No. 160/SK/BAP-SM/XI/2017), sekolah ini dikenal sebagai sekolah inklusi yang ramah anak berkebutuhan khusus serta unggul dalam pembinaan literasi, numerasi, drumband, dan kepramukaan. Hingga kini, ribuan alumni tersebar di berbagai SMP dan SMA favorit di Makassar.",
      principalName: "Nawawi Hamzah, S.Pd., M.Pd.",
      principalPhoto: avatar(60),
      principalWelcome:
        "Selamat datang di website resmi UPT SPF SD Negeri Unggulan Mongisidi 1 Makassar. Kami berkomitmen menyelenggarakan pendidikan dasar berkualitas yang memadukan iman, taqwa, dan budaya unggul berwawasan lingkungan. Sebagai sekolah inklusi, kami merangkul setiap anak untuk tumbuh sesuai potensinya.\n\nKami memiliki berbagai fasilitas dan program unggulan, termasuk website perpustakaan untuk mendukung literasi siswa, aplikasi Pandai untuk pembelajaran digital, serta sistem pengaduan yang terbuka untuk masukan demi kemajuan sekolah kita bersama. Kami juga bekerja sama aktif dengan komite sekolah dalam menjalankan program-program pendidikan.\n\nUntuk mengembangkan bakat dan minat siswa, kami menyediakan berbagai ekstrakurikuler seperti Futsal, Tari, Pencak Silat, dan Pramuka. Kedepan, kami berencana membangkitkan kembali ekstrakurikuler Drumband yang pernah berjaya di masanya.\n\nMari bersama membangun generasi cerdas, berkarakter, dan berakhlak mulia.",
      facebook: "https://facebook.com/mongisidisatu",
      instagram: "https://instagram.com/monsajaya_",
      youtube: null,
      tiktok: null,
      studentCount: 402,
      teacherCount: 28,
      facilityCount: 18,
      achievementCount: 45,
      spmbInfo:
        "Sistem Penerimaan Murid Baru (SPMB) SD Negeri Unggulan Mongisidi 1 Tahun Ajaran 2025/2026 dibuka mulai Juni 2025 untuk jenjang kelas 1. Jalur yang tersedia: Zonasi (50%), Afirmasi (15%), Prestasi (30%), dan Perpindahan Tugas Orang Tua (5%). Pendaftaran dilakukan secara daring melalui portal SPMB resmi Kota Makassar (spmb.makassarkota.go.id) yang diseragamkan untuk seluruh sekolah. Kuota tersedia 51 siswa untuk 3 rombongan belajar. Sekolah ini juga melayani pendidikan inklusi bagi anak berkebutuhan khusus.",
      spmbLink: "https://spmb.makassarkota.go.id",
      updatedAt: new Date(),
    },
  });

  // ---------- NEWS ----------
  const newsData = [
    {
      title: "Peringatan HUT Kemerdekaan RI ke-80 di SDN Mongisidi 1",
      category: "Kegiatan",
      excerpt:
        "Seluruh siswa, guru, dan tenaga kependidikan mengikuti upacara bendera dengan khidmat memperingati HUT Kemerdekaan Republik Indonesia ke-80.",
      content:
        "<p>UPT SPF SD Negeri Unggulan Mongisidi 1 menggelar upacara bendera dalam rangka memperingati Hari Ulang Tahun Kemerdekaan Republik Indonesia ke-80 di halaman sekolah. Kegiatan ini diikuti oleh seluruh siswa kelas 1 hingga kelas 6, guru, dan tenaga kependidikan.</p><p>Kepala Sekolah, Bapak Nawawi Hamzah, S.Pd., M.Pd., dalam sambutannya menekankan pentingnya meneladani semangat para pahlawan dengan rajin belajar dan cinta tanah air. \u201cMerdeka bukan sekadar bebas dari penjajahan, tetapi juga bebas dari kebodohan,\u201d ujarnya.</p><p>Upacara berjalan dengan tertib. Pasukan Pengibar Bendera (Paskibra) yang terdiri dari siswa kelas 6 tampil apik. Rangkaian kegiatan dilanjutkan dengan lomba-lomba kemerdekaan yang seru dan meriah.</p>",
      cover: img("upacara-80-sdn"),
      daysAgo: 4,
    },
    {
      title: "Siswa SDN Mongisidi 1 Juara 1 Lomba Cerdas Cermat Tingkat Kota Makassar",
      category: "Prestasi",
      excerpt:
        "Tim LCC sekolah berhasil meraih juara 1 pada Lomba Cerdas Cermat tingkat SD se-Kota Makassar 2025.",
      content:
        "<p>Alhamdulillah, tim Lomba Cerdas Cermat (LCC) SD Negeri Unggulan Mongisidi 1 berhasil meraih Juara 1 pada ajang LCC tingkat SD se-Kota Makassar 2025 yang diselenggarakan pekan lalu.</p><p>Tim yang terdiri dari Aisyah Putri (kelas 5), Muhammad Rizki (kelas 5), dan Fathur Rahman (kelas 6) mengalahkan 48 tim dari berbagai SD se-Kota Makassar. \u201cKami sangat bersyukur. Ini hasil latihan rutin selama tiga bulan,\u201d ungkap Aisyah, kapten tim.</p><p>Kepala Sekolah menyampaikan apresiasi tinggi dan berharap prestasi ini memotivasi siswa lain. Tim akan mewakili Kota Makassar pada LCC tingkat Provinsi Sulawesi Selatan bulan depan.</p>",
      cover: img("lcc-juara-sdn"),
      daysAgo: 9,
    },
    {
      title: "Pertemuan Komite Sekolah dan Orang Tua Awal Semester",
      category: "Akademik",
      excerpt:
        "Pertemuan orang tua siswa membahas program kerja semester, kalender akademik, dan kesehatan belajar siswa di sekolah.",
      content:
        "<p>Dalam rangka menyongsong tahun ajaran baru, SDN Mongisidi 1 mengadakan pertemuan komite sekolah dengan orang tua siswa di aula sekolah. Pertemuan membahas kalender akademik, program literasi-numerasi, serta pembiasaan karakter.</p><p>Kepala Sekolah mengarahkan orang tua untuk mendukung pembelajaran berbasis literasi dan numerasi di rumah. Sekolah juga menerapkan program sekolah inklusi dengan pendampingan khusus bagi anak berkebutuhan khusus.</p>",
      cover: img("rapat-komite-sdn"),
      daysAgo: 14,
    },
    {
      title: "Peringatan Hari Kartini & Lomba Dresscode Tradisional",
      category: "Kegiatan",
      excerpt:
        "Siswi-siswi SDN Mongisidi 1 tampil memukau dalam peringatan Hari Kartini dengan lomba dresscode pakaian tradisional Nusantara.",
      content:
        "<p>SDN Mongisidi 1 menggelar peringatan Hari Kartini dengan tema \u201cKartini Masa Kini\u201d. Kegiatan diisi dengan lomba dresscode pakaian adat tradisional, lomba membaca puisi, dan panggung seni siswa.</p><p>Siswi-siswi tampil cantik mengenakan pakaian adat dari berbagai daerah: Baju Bodo (Sulawesi Selatan), Kebaya Jawa, Batak, hingga pakaian adat Papua. Kegiatan ini menumbuhkan rasa cinta terhadap keberagaman budaya Nusantara sejak dini.</p>",
      cover: img("kartini-sdn"),
      daysAgo: 22,
    },
    {
      title: "Tim Drumband Mongisidi 1 Juara Festival Drumband Pelajar Makassar",
      category: "Prestasi",
      excerpt:
        "Tim Drumband sekolah kembali mengharumkan nama SDN Mongisidi 1 dengan meraih juara pada Festival Drumband Pelajar.",
      content:
        "<p>Tim Drumband \u201cMonsa Jaya\u201d SDN Mongisidi 1 berhasil meraih Juara Umum pada Festival Drumband Pelajar Tingkat SD se-Kota Makassar 2025. Mereka mengalahkan 25 tim drumband lainnya.</p><p>Penampilan tim yang terdiri dari 40 siswa kelas 4-6 memukau juri dengan formasi yang rapi dan harmoni yang mempesona. Tim berlatih rutin tiga kali seminggu di bawah bimbingan pelatih profesional.</p>",
      cover: img("drumband-sdn"),
      daysAgo: 28,
    },
    {
      title: "Pelaksanaan Penilaian Akhir Semester Ganjil 2025/2026",
      category: "Akademik",
      excerpt:
        "Penilaian Akhir Semester (PAS) akan dilaksanakan secara luring dengan jadwal yang telah dibagikan kepada siswa dan orang tua.",
      content:
        "<p>Penilaian Akhir Semester (PAS) Ganjil Tahun Ajaran 2025/2026 akan dilaksanakan mulai 8 Desember 2025. Siswa diharapkan mempersiapkan diri dengan belajar tekun.</p><p>Jadwal lengkap per kelas dapat diunduh pada halaman pengumuman. Orang tua dimohon mendampingi putra-putrinya selama masa persiapan. Tata tertib ujian wajib dipatuhi seluruh peserta.</p>",
      cover: img("pas-sdn"),
      daysAgo: 35,
    },
  ];

  for (const n of newsData) {
    const publishedAt = new Date(Date.now() - n.daysAgo * 86400000);
    await db.news.create({
      data: {
        title: n.title,
        slug: slugify(n.title) + "-" + Math.random().toString(36).slice(2, 6),
        excerpt: n.excerpt,
        content: n.content,
        coverImage: n.cover,
        category: n.category,
        status: "PUBLISHED",
        authorId: Math.random() > 0.5 ? op1.id : op2.id,
        publishedAt,
      },
    });
  }

  // A draft news
  await db.news.create({
    data: {
      title: "Persiapan Pentas Seni Akhir Tahun (Draf)",
      slug: slugify("Persiapan Pentas Seni Akhir Tahun") + "-draft",
      excerpt:
        "Rencana kegiatan pentas seni siswa yang akan digelar menjelang akhir tahun ajaran.",
      content: "<p>Artikel ini masih dalam tahap draf dan belum dipublikasikan.</p>",
      coverImage: img("pentas-draft-sdn"),
      category: "Kegiatan",
      status: "DRAFT",
      authorId: op1.id,
      publishedAt: null,
    },
  });

  // ---------- ANNOUNCEMENTS ----------
  const now = Date.now();
  await db.announcement.create({
    data: {
      title: "Pengumuman Libur Hari Raya Idul Fitri",
      content:
        "Diberitahukan kepada seluruh siswa, guru, dan orang tua, kegiatan belajar mengajar diliburkan mulai 28 Maret - 6 April 2025 dalam rangka Hari Raya Idul Fitri 1446 H. Kegiatan kembali normal pada 7 April 2025.",
      isPinned: true,
      expiresAt: new Date(now + 1000 * 60 * 60 * 24 * 30),
      isActive: true,
    },
  });
  await db.announcement.create({
    data: {
      title: "Pengumuman SPMB Tahun Ajaran 2025/2026",
      content:
        "Sistem Penerimaan Murid Baru (SPMB) kelas 1 dibuka mulai 9 Juni 2025 melalui portal SPMB resmi Kota Makassar (spmb.makassarkota.go.id). Jalur: Zonasi, Afirmasi, Prestasi, dan Perpindahan Tugas. Kuota 51 siswa untuk 3 rombongan belajar.",
      isPinned: true,
      expiresAt: new Date(now + 1000 * 60 * 60 * 24 * 45),
      isActive: true,
    },
  });
  await db.announcement.create({
    data: {
      title: "Pengumuman Jadwal Penilaian Akhir Semester",
      content:
        "Jadwal PAS Ganjil 2025/2026 telah dibagikan. Mohon orang tua mendampingi putra-putrinya selama persiapan ujian.",
      isPinned: false,
      expiresAt: new Date(now + 1000 * 60 * 60 * 24 * 21),
      isActive: true,
    },
  });
  await db.announcement.create({
    data: {
      title: "Pendaftaran Ekstrakurikuler Semester Genap",
      content:
        "Pendaftaran ekskul dibuka mulai 5 Januari 2026. Tersedia: Pramuka, Drumband, Tari, Qasidah, English Club, Robotic, Futsal, dan Tahfidz. Daftar melalui wali kelas.",
      isPinned: false,
      expiresAt: new Date(now + 1000 * 60 * 60 * 24 * 14),
      isActive: true,
    },
  });
  await db.announcement.create({
    data: {
      title: "Pengumuman Pertemuan Orang Tua",
      content:
        "Pertemuan orang tua siswa akan diadakan pada 20 September 2025 pukul 09.00 WIB di aula sekolah.",
      isPinned: false,
      expiresAt: new Date(now - 1000 * 60 * 60 * 24 * 5), // expired
      isActive: true,
    },
  });

  // ---------- AGENDA ----------
  const agendaBase = Date.now();
  const agenda = [
    {
      title: "Upacara Bendera Senin",
      date: new Date(agendaBase + 2 * 86400000),
      time: "07.00 - 07.30 WITA",
      location: "Halaman Sekolah",
      category: "Kegiatan",
      description: "Upacara bendera rutin setiap Senin pagi.",
    },
    {
      title: "Penilaian Akhir Semester Ganjil",
      date: new Date(agendaBase + 12 * 86400000),
      time: "07.30 - 10.00 WITA",
      location: "Ruang Kelas",
      category: "Akademik",
      description: "PAS untuk seluruh tingkatan kelas 1-6.",
    },
    {
      title: "Lomba Kebersihan dan Kerapian Kelas",
      date: new Date(agendaBase + 18 * 86400000),
      time: "09.00 - 11.00 WITA",
      location: "Seluruh Ruang Kelas",
      category: "Kegiatan",
      description: "Penilaian kebersihan, kerapian, dan dekorasi kelas.",
    },
    {
      title: "Workshop Guru: Pembelajaran Literasi-Numerasi",
      date: new Date(agendaBase + 25 * 86400000),
      time: "08.00 - 12.00 WITA",
      location: "Aula Sekolah",
      category: "Akademik",
      description: "Pelatihan guru tentang pembelajaran berbasis literasi-numerasi.",
    },
    {
      title: "Libur Hari Sumpah Pemuda",
      date: new Date(agendaBase + 40 * 86400000),
      time: "Sepanjang Hari",
      location: "-",
      category: "Libur",
      description: "Libur memperingati Hari Sumpah Pemuda ke-77.",
    },
    {
      title: "Pentas Seni & Wisuda Kelas 6",
      date: new Date(agendaBase + 65 * 86400000),
      time: "16.00 - 19.00 WITA",
      location: "Auditorium Sekolah",
      category: "Kegiatan",
      description: "Pertunjukan seni siswa dan wisuda kelas 6.",
    },
  ];
  for (const a of agenda) {
    await db.agenda.create({ data: a });
  }

  // ---------- TEACHERS (SD) ----------
  const teachers = [
    { name: "Nawawi Hamzah, S.Pd., M.Pd.", position: "Kepala Sekolah", subject: "Kepemimpinan", education: "S2 Manajemen Pendidikan", img: 60, nuptk: "1998765432100001", nip: "198007152008011001", nik: "7371011507800001", riwayat: "Memimpin SDN Unggulan Mongisidi 1 dengan fokus pada mutu pembelajaran, penguatan karakter siswa, dan tata kelola sekolah yang transparan.", email: "kepala.sekolah@mongisidi1.sch.id", phone: "081341112233" },
    { name: "Hj. Rosmiati, S.Pd., M.Pd.", position: "Wakil Kepala Sekolah Bidang Kurikulum", subject: "Guru Kelas", education: "S2 Pendidikan Dasar", img: 45, nuptk: "1998765432100002", nip: "197302102005012002", nik: "7371011002730002", riwayat: "Mengawal implementasi kurikulum dan program pembelajaran di seluruh jenjang.", email: "rosmiati@mongisidi1.sch.id", phone: "081342223344" },
    { name: "Drs. Abdul Rahman", position: "Wakil Kepala Sekolah Bidang Kesiswaan", subject: "PJOK", education: "S1 Pendidikan Olahraga", img: 12, nuptk: "1998765432100003", nip: "196808201994121003", nik: "7371012008680003", riwayat: "Membina kedisiplinan, kegiatan ekstrakurikuler, dan kesejahteraan siswa.", email: "abdul.rahman@mongisidi1.sch.id", phone: "081343334455" },
    { name: "Siti Aminah, S.Pd.", position: "Guru Kelas 1A", subject: "Kelas 1A", education: "S1 PGSD", img: 2, nuptk: "1998765432100004", nip: "198512102011012004", nik: "7371011012850004", riwayat: "Guru kelas 1A yang fokus pada literasi dan numerasi dasar siswa.", email: "siti.aminah@mongisidi1.sch.id", phone: "081344445566" },
    { name: "Andi Mappangara, S.Pd.", position: "Guru Kelas 4B", subject: "Kelas 4B", education: "S1 PGSD", img: 33, nuptk: "1998765432100005", nip: "197905182006041005", nik: "7371011805790005", riwayat: "Guru kelas 4B — membimbing siswa melalui pembelajaran yang aktif dan menyenangkan.", email: "andi.mappangara@mongisidi1.sch.id", phone: "081345556677" },
    { name: "Maya Sari, S.Pd.", position: "Guru Bahasa Inggris", subject: "Bahasa Inggris", education: "S1 Pendidikan Bahasa Inggris", img: 20, nuptk: "1998765432100006", nip: "198802252015022006", nik: "7371012502880006", riwayat: "Guru Bahasa Inggris dengan pendekatan komunikatif dan permainan bahasa.", email: "maya.sari@mongisidi1.sch.id", phone: "081346667788" },
    { name: "Ustadz Ahmad Fauzi, S.Pd.I.", position: "Guru Pendidikan Agama Islam", subject: "Agama Islam", education: "S1 PAI", img: 15, nuptk: "1998765432100007", nip: "198307122010011007", nik: "7371011207830007", riwayat: "Guru Pendidikan Agama Islam — membina keimanan dan akhlak siswa.", email: "ahmad.fauzi@mongisidi1.sch.id", phone: "081347778899" },
    { name: "Dewi Anggraini, S.Pd.", position: "Guru PJOK", subject: "PJOK", education: "S1 Pendidikan Olahraga", img: 25, nuptk: "1998765432100008", nip: "199003152019032008", nik: "7371011503900008", riwayat: "Guru PJOK — mengembangkan kebugaran jasmani dan jiwa sportivitas siswa.", email: "dewi.anggraini@mongisidi1.sch.id", phone: "081348889900" },
    { name: "Rina Marlina, S.Pd.", position: "Guru Seni Budaya & Drumband", subject: "Seni Budaya", education: "S1 Pendidikan Seni", img: 16, nuptk: "1998765432100009", nip: "198911042019042009", nik: "7371010411890009", riwayat: "Guru Seni Budaya sekaligus pembina Drumband Monsa Jaya.", email: "rina.marlina@mongisidi1.sch.id", phone: "081349990011" },
    { name: "Muhammad Yusuf, S.Kom.", position: "Guru Informatika", subject: "Informatika", education: "S1 Pendidikan Informatika", img: 8, nuptk: "1998765432100010", nip: "199208212020121010", nik: "7371012108920010", riwayat: "Guru Informatika — mengenalkan literasi digital dan dasar robotika sejak dini.", email: "yusuf.informatika@mongisidi1.sch.id", phone: "081350001122" },
    { name: "Nurul Hidayah, S.Pd.", position: "Guru Inklusi / Pembina ABK", subject: "Pendidikan Inklusi", education: "S1 Pendidikan Luar Biasa", img: 48, nuptk: "1998765432100011", nip: "199402072020122011", nik: "7371010702940011", riwayat: "Guru Pendidikan Inklusi / Pembina ABK — mendampingi siswa berkebutuhan khusus.", email: "nurul.hidayah@mongisidi1.sch.id", phone: "081351112233" },
    { name: "Ratna Dewi, S.E.", position: "Bendahara Sekolah", subject: "-", education: "S1 Akuntansi", img: 51, nuptk: "1998765432100012", nip: "199110052020122012", nik: "7371010510910012", riwayat: "Bendahara sekolah — menata keuangan dan dana BOS secara tertib dan akuntabel.", email: "ratna.dewi@mongisidi1.sch.id", phone: "081352223344" },
  ];
  for (let i = 0; i < teachers.length; i++) {
    const t = teachers[i];
    await db.teacher.create({
      data: {
        name: t.name,
        position: t.position,
        subject: t.subject,
        education: t.education,
        nuptk: t.nuptk,
        nip: t.nip,
        nik: t.nik,
        riwayat: t.riwayat ?? null,
        email: t.email ?? null,
        phone: t.phone ?? null,
        photo: avatar(t.img),
        order: i,
        isActive: true,
      },
    });
  }

  // ---------- KELAS & SISWA ----------
  // Dua rombel kelas 1 — galeri siswa di beranda butuh data agar tampil
  // (marquee foto + pencarian + filter kelas). Empat siswa diberi foto.
  const classes = [
    { name: "Kelas 1.a", grade: "1", stream: "a", academicYear: "2026/2027" },
    { name: "Kelas 1.b", grade: "1", stream: "b", academicYear: "2026/2027" },
  ];
  const classIds: Record<string, string> = {};
  for (const c of classes) {
    const created = await db.class.create({
      data: { ...c, isActive: true },
    });
    classIds[c.name] = created.id;
  }
  const students = [
    { name: "Aisyah Putri Ramadhani", nis: "2627078144", nisn: "0123456781", gender: "PEREMPUAN", cls: "Kelas 1.a", img: 21 },
    { name: "Bima Arya Saputra", nis: "2627076274", nisn: "0123456782", gender: "LAKI_LAKI", cls: "Kelas 1.a", img: 22 },
    { name: "Citra Ayu Lestari", nis: "2627078808", nisn: "0123456783", gender: "PEREMPUAN", cls: "Kelas 1.a", img: 23 },
    { name: "Dimas Prasetyo Nugroho", nis: "2627078851", nisn: "0123456784", gender: "LAKI_LAKI", cls: "Kelas 1.a", img: 24 },
    { name: "Eka Nurhaliza", nis: "2627072115", nisn: "0123456785", gender: "PEREMPUAN", cls: "Kelas 1.a" },
    { name: "Farhan Maulana Rizki", nis: "2627078952", nisn: "0123456786", gender: "LAKI_LAKI", cls: "Kelas 1.a" },
    { name: "Gita Maharani", nis: "2627072712", nisn: "0123456787", gender: "PEREMPUAN", cls: "Kelas 1.b" },
    { name: "Hadi Firmansyah", nis: "2627077926", nisn: "0123456788", gender: "LAKI_LAKI", cls: "Kelas 1.b" },
    { name: "Intan Permata Sari", nis: "2627076405", nisn: "0123456789", gender: "PEREMPUAN", cls: "Kelas 1.b" },
    { name: "Joko Susilo", nis: "2627071218", nisn: "0123456790", gender: "LAKI_LAKI", cls: "Kelas 1.b" },
    { name: "Kirana Dewi", nis: "2627071149", nisn: "0123456791", gender: "PEREMPUAN", cls: "Kelas 1.b" },
    { name: "Lutfi Ardiansyah", nis: "2627077858", nisn: "0123456792", gender: "LAKI_LAKI", cls: "Kelas 1.b" },
  ];
  const studentIds: Record<string, string> = {};
  for (const s of students) {
    const created = await db.student.create({
      data: {
        name: s.name,
        nis: s.nis,
        nisn: s.nisn,
        gender: s.gender,
        photoUrl: s.img ? avatar(s.img) : null,
        classId: classIds[s.cls],
        isActive: true,
        parentName: `Orang tua ${s.name}`,
        parentPhone: "081234567890",
      },
    });
    studentIds[s.nis] = created.id;
  }

  // ---------- AKUN PORTAL ORANG TUA & SISWA (contoh) ----------
  await db.user.create({
    data: {
      name: "Orang tua Aisyah Putri Ramadhani",
      email: "ortu.aisyah@mongisidi1.sch.id",
      password: hashPassword("ortu123"),
      role: "ORANG_TUA",
      isActive: true,
      guardianStudentId: studentIds["2627078144"] ?? null,
    },
  });
  await db.user.create({
    data: {
      name: "Bima Arya Saputra",
      email: "bima.siswa@mongisidi1.sch.id",
      password: hashPassword("siswa123"),
      role: "SISWA",
      isActive: true,
      studentId: studentIds["2627076274"] ?? null,
    },
  });

  // ---------- STRUKTUR ORGANISASI ----------
  const org = [
    { name: "Nawawi Hamzah, S.Pd., M.Pd.", position: "Kepala Sekolah", order: 0, img: 1, nuptk: "1345752663130001", nip: "196806121994031002", nik: "7371011206680001", bio: "Memimpin SDN Unggulan Mongisidi 1 sejak 2019, berfokus pada peningkatan mutu pembelajaran dan penguatan karakter siswa.", contact: "kepala.sekolah@mongisidi1.sch.id" },
    { name: "Muhammad Yusuf, S.Pd.", position: "Wakil Kepala Sekolah", order: 1, img: 8, nuptk: "2359761664130002", nip: "197503102005011003", nik: "7371011003750002", bio: "Mendampingi kepala sekolah dalam pengelolaan administrasi, kurikulum, dan pembinaan tenaga pendidik.", contact: "wakasek@mongisidi1.sch.id" },
    { name: "Siti Aminah, S.Pd.", position: "Bendahara Sekolah", order: 2, img: 2, nuptk: "6349763666130003", nip: "198009052006042004", nik: "7371010509800003", bio: "Mengelola keuangan sekolah secara transparan, termasuk penatausahaan dana BOS dan laporan anggaran.", contact: "bendahara@mongisidi1.sch.id" },
    { name: "Andi Mappangara, S.Pd.", position: "Koordinator Kurikulum", order: 3, img: 33, nuptk: "9351765667130004", nip: null, nik: "7371011205780004", bio: "Menyusun dan mengawal implementasi kurikulum serta program pembelajaran di semua jenjang kelas.", contact: "kurikulum@mongisidi1.sch.id" },
    { name: "Rahmat Hidayat, S.Pd.", position: "Koordinator Kesiswaan", order: 4, img: 5, nuptk: "4351766668130005", nip: null, nik: "7371012301800005", bio: "Membina kedisiplinan, kegiatan ekstrakurikuler, dan kesejahteraan siswa.", contact: "kesiswaan@mongisidi1.sch.id" },
  ];
  for (const o of org) {
    await db.orgStructure.create({
      data: {
        name: o.name,
        position: o.position,
        photo: avatar(o.img),
        nuptk: o.nuptk,
        nip: o.nip,
        nik: o.nik,
        bio: o.bio,
        contact: o.contact,
        order: o.order,
        isActive: true,
      },
    });
  }

  // ---------- TRANSPARANSI ANGGARAN (ARKAS / DANA BOS) ----------
  // Dua tahun anggaran sengaja di-seed (2026 + 2025) agar dropdown tahun
  // menunjukkan chip ringkasan per tahun yang BERBEDA (total 2026 = Rp 82,5
  // jt dari 8 item; 2025 = Rp 12 jt dari 2 item). Jumlah item dijaga agar
  // total keseluruhan ≤ 10 sehingga baseline test pagination tetap 1 halaman.
  const bos = [
    { year: 2026, source: "BOS Reguler", category: "Honorarium", item: "Honorarium guru tidak tetap", amount: 24000000, quarter: 1 },
    { year: 2026, source: "BOS Reguler", category: "Pembelajaran", item: "Pembelian buku & alat peraga", amount: 15000000, quarter: 2 },
    { year: 2026, source: "BOS Reguler", category: "Pembelajaran", item: "Kegiatan lomba & ekstrakurikuler", amount: 8000000, quarter: 3 },
    { year: 2026, source: "BOS Reguler", category: "Sarana Prasarana", item: "Perbaikan ringan sarana & prasarana", amount: 12000000, quarter: 4 },
    { year: 2026, source: "BOS Reguler", category: "Operasional", item: "Langganan daya & jasa (listrik, air, internet)", amount: 9000000, quarter: null },
    { year: 2026, source: "BOS Reguler", category: "Operasional", item: "ATK & bahan habis pakai", amount: 6000000, quarter: null },
    { year: 2026, source: "BOS Kinerja", category: "Pengembangan", item: "Peningkatan kompetensi guru (pelatihan)", amount: 5000000, quarter: null },
    { year: 2026, source: "BOS Kinerja", category: "Pengembangan", item: "Program literasi & perpustakaan", amount: 3500000, quarter: null },
    { year: 2025, source: "BOS Reguler", category: "Operasional", item: "ATK & perlengkapan kantor (2025)", amount: 7000000, quarter: 1 },
    { year: 2025, source: "BOS Reguler", category: "Sarana Prasarana", item: "Pemeliharaan gedung & fasilitas (2025)", amount: 5000000, quarter: 2 },
  ];
  for (const b of bos) {
    await db.bosExpenditure.create({
      data: {
        year: b.year,
        source: b.source,
        category: b.category,
        item: b.item,
        amount: b.amount,
        quarter: b.quarter,
        note: null,
      },
    });
  }

  // ---------- GALLERY ----------
  const gallery = [
    { title: "Upacara Bendera", category: "Upacara", seed: "upacara-sdn" },
    { title: "Lab Komputer", category: "Fasilitas", seed: "lab-komputer-sdn" },
    { title: "Juara Lomba Cerdas Cermat", category: "Prestasi", seed: "lcc-sdn" },
    { title: "Kegiatan Pramuka", category: "Kegiatan", seed: "pramuka-sdn" },
    { title: "Perpustakaan Sekolah", category: "Fasilitas", seed: "perpus-sdn" },
    { title: "Penampilan Drumband", category: "Prestasi", seed: "drumband-sdn" },
    { title: "Class Meeting", category: "Kegiatan", seed: "class-meeting-sdn" },
    { title: "Pentas Seni Anak", category: "Kegiatan", seed: "pentas-sdn" },
    { title: "Lapangan Olahraga", category: "Fasilitas", seed: "lapangan-sdn" },
    { title: "Wisuda Kelas 6", category: "Kegiatan", seed: "wisuda-sdn" },
    { title: "Lomba Mewarnai", category: "Prestasi", seed: "mewarnai-sdn" },
    { title: "Pembelajaran Inklusi", category: "Kegiatan", seed: "inklusi-sdn" },
  ];
  for (const g of gallery) {
    await db.galleryItem.create({
      data: {
        title: g.title,
        description: `Dokumentasi ${g.title.toLowerCase()} di SDN Unggulan Mongisidi 1.`,
        type: "PHOTO",
        url: img(g.seed, 1280, 800),
        thumbnail: img(g.seed, 600, 400),
        category: g.category,
      },
    });
  }
  await db.galleryItem.create({
    data: {
      title: "Profil Sekolah (Video)",
      description: "Video profil SDN Unggulan Mongisidi 1.",
      type: "VIDEO",
      url: "https://www.youtube.com/embed/aqz-KE-bpKQ",
      thumbnail: img("profil-video-sdn", 1280, 800),
      category: "Kegiatan",
    },
  });
  await db.galleryItem.create({
    data: {
      title: "Cinematic Wisuda Kelas 6",
      description: "Dokumentasi wisuda kelas 6 dalam bentuk video.",
      type: "VIDEO",
      url: "https://www.youtube.com/embed/ScMzIvxBSi4",
      thumbnail: img("cinematic-wisuda-sdn", 1280, 800),
      category: "Kegiatan",
    },
  });

  // ---------- ACHIEVEMENTS ----------
  // Prestasi perorangan ditautkan ke siswa nyata (menampilkan NIS/NISN di kartu),
  // prestasi tim tetap tanpa tautan siswa.
  const ach = [
    { title: "Juara 1 Lomba Cerdas Cermat Tingkat Kota", studentName: "Tim LCC SDN Mongisidi 1", level: "Kabupaten", category: "Akademik", date: new Date(now - 9 * 86400000) },
    { title: "Juara Umum Festival Drumband Pelajar", studentName: "Tim Drumband Monsa Jaya", level: "Kabupaten", category: "Non-Akademik", date: new Date(now - 28 * 86400000) },
    { title: "Juara 2 Olimpiade Matematika SD Tingkat Provinsi", studentName: "Bima Arya Saputra", studentId: studentIds["2627076274"] ?? null, level: "Provinsi", category: "Akademik", date: new Date(now - 45 * 86400000) },
    { title: "Juara 1 Lomba Mewarnai Tingkat Kota", studentName: "Citra Ayu Lestari", studentId: studentIds["2627078808"] ?? null, level: "Kabupaten", category: "Non-Akademik", date: new Date(now - 60 * 86400000) },
    { title: "Juara 1 Tahfidz Juz 30 Tingkat Kota", studentName: "Hadi Firmansyah", studentId: studentIds["2627077926"] ?? null, level: "Kabupaten", category: "Non-Akademik", date: new Date(now - 90 * 86400000) },
    { title: "Juara 3 Pidato Bahasa Inggris Tingkat Provinsi", studentName: "Gita Maharani", studentId: studentIds["2627072712"] ?? null, level: "Provinsi", category: "Non-Akademik", date: new Date(now - 120 * 86400000) },
  ];
  for (const a of ach) {
    await db.achievement.create({
      data: {
        title: a.title,
        description: `Prestasi diraih oleh ${a.studentName}.`,
        studentName: a.studentName,
        studentId: a.studentId,
        level: a.level,
        category: a.category,
        date: a.date,
      },
    });
  }

  // ---------- CONTACT MESSAGES ----------
  await db.contactMessage.create({
    data: {
      name: "Bapak Andi",
      email: "andi.parent@email.com",
      phone: "081234567890",
      subject: "Pertanyaan SPMB Kelas 1",
      message: "Apakah masih ada kuota jalur zonasi untuk pendaftaran kelas 1 tahun ajaran 2025/2026? Batas usia maksimal berapa?",
      isRead: false,
    },
  });
  await db.contactMessage.create({
    data: {
      name: "Ibu Wati",
      email: "wati@email.com",
      phone: "081298765432",
      subject: "Informasi Pendidikan Inklusi",
      message: "Mohon informasi mengenai program pendidikan inklusi di sekolah. Apakah menerima anak dengan autisme?",
      isRead: false,
    },
  });

  // ---------- ACTIVITY LOGS ----------
  await db.activityLog.create({
    data: {
      userId: op1.id,
      userName: op1.name,
      action: "CREATE",
      entity: "News",
      entityId: "-",
      detail: "Membuat berita baru: Peringatan HUT Kemerdekaan RI ke-80 di SDN Mongisidi 1",
      createdAt: new Date(now - 4 * 86400000),
    },
  });
  await db.activityLog.create({
    data: {
      userId: op1.id,
      userName: op1.name,
      action: "CREATE",
      entity: "News",
      entityId: "-",
      detail: "Membuat berita baru: Siswa SDN Mongisidi 1 Juara 1 Lomba Cerdas Cermat Tingkat Kota Makassar",
      createdAt: new Date(now - 9 * 86400000),
    },
  });
  await db.activityLog.create({
    data: {
      userId: op2.id,
      userName: op2.name,
      action: "CREATE",
      entity: "Announcement",
      entityId: "-",
      detail: "Menerbitkan pengumuman: Pengumuman Libur Hari Raya Idul Fitri",
      createdAt: new Date(now - 2 * 86400000),
    },
  });
  await db.activityLog.create({
    data: {
      userId: op2.id,
      userName: op2.name,
      action: "UPDATE",
      entity: "Teacher",
      entityId: "-",
      detail: "Memperbarui data guru: Siti Aminah, S.Pd.",
      createdAt: new Date(now - 1 * 86400000),
    },
  });
  await db.activityLog.create({
    data: {
      userId: admin.id,
      userName: admin.name,
      action: "LOGIN",
      entity: "Auth",
      entityId: "-",
      detail: "Login ke sistem",
      createdAt: new Date(now - 1 * 3600000),
    },
  });

  console.log("✅ Seed selesai!");
  console.log("   Login Admin   : admin@mongisidi1.sch.id / admin123");
  console.log("   Login Operator: operator@mongisidi1.sch.id / operator123");
  console.log("   Login Guru    : guru@mongisidi1.sch.id / guru123 (isi wali kelas via dashboard)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
