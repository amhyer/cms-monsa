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
  await db.galleryItem.deleteMany();
  await db.achievement.deleteMany();
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
        "Selamat datang di website resmi UPT SPF SD Negeri Unggulan Mongisidi 1 Makassar. Kami berkomitmen menyelenggarakan pendidikan dasar berkualitas yang memadukan iman, taqwa, dan budaya unggul berwawasan lingkungan. Sebagai sekolah inklusi, kami merangkul setiap anak untuk tumbuh sesuai potensinya. Mari bersama membangun generasi cerdas, berkarakter, dan berakhlak mulia.",
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
    { name: "Nawawi Hamzah, S.Pd., M.Pd.", position: "Kepala Sekolah", subject: "Kepemimpinan", education: "S2 Manajemen Pendidikan", img: 60 },
    { name: "Hj. Rosmiati, S.Pd., M.Pd.", position: "Wakil Kepala Sekolah Bidang Kurikulum", subject: "Guru Kelas", education: "S2 Pendidikan Dasar", img: 45 },
    { name: "Drs. Abdul Rahman", position: "Wakil Kepala Sekolah Bidang Kesiswaan", subject: "PJOK", education: "S1 Pendidikan Olahraga", img: 12 },
    { name: "Siti Aminah, S.Pd.", position: "Guru Kelas 1A", subject: "Kelas 1A", education: "S1 PGSD", img: 5 },
    { name: "Andi Mappangara, S.Pd.", position: "Guru Kelas 4B", subject: "Kelas 4B", education: "S1 PGSD", img: 33 },
    { name: "Maya Sari, S.Pd.", position: "Guru Bahasa Inggris", subject: "Bahasa Inggris", education: "S1 Pendidikan Bahasa Inggris", img: 20 },
    { name: "Ustadz Ahmad Fauzi, S.Pd.I.", position: "Guru Pendidikan Agama Islam", subject: "Agama Islam", education: "S1 PAI", img: 15 },
    { name: "Dewi Anggraini, S.Pd.", position: "Guru PJOK", subject: "PJOK", education: "S1 Pendidikan Olahraga", img: 25 },
    { name: "Rina Marlina, S.Pd.", position: "Guru Seni Budaya & Drumband", subject: "Seni Budaya", education: "S1 Pendidikan Seni", img: 16 },
    { name: "Muhammad Yusuf, S.Kom.", position: "Guru Informatika", subject: "Informatika", education: "S1 Pendidikan Informatika", img: 8 },
    { name: "Nurul Hidayah, S.Pd.", position: "Guru Inklusi / Pembina ABK", subject: "Pendidikan Inklusi", education: "S1 Pendidikan Luar Biasa", img: 48 },
    { name: "Ratna Dewi, S.E.", position: "Bendahara Sekolah", subject: "-", education: "S1 Akuntansi", img: 51 },
  ];
  for (let i = 0; i < teachers.length; i++) {
    const t = teachers[i];
    await db.teacher.create({
      data: {
        name: t.name,
        position: t.position,
        subject: t.subject,
        education: t.education,
        photo: avatar(t.img),
        order: i,
        isActive: true,
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
  const ach = [
    { title: "Juara 1 Lomba Cerdas Cermat Tingkat Kota", studentName: "Tim LCC SDN Mongisidi 1", level: "Kabupaten", category: "Akademik", date: new Date(now - 9 * 86400000) },
    { title: "Juara Umum Festival Drumband Pelajar", studentName: "Tim Drumband Monsa Jaya", level: "Kabupaten", category: "Non-Akademik", date: new Date(now - 28 * 86400000) },
    { title: "Juara 2 Olimpiade Matematika SD Tingkat Provinsi", studentName: "Fathur Rahman (kelas 6)", level: "Provinsi", category: "Akademik", date: new Date(now - 45 * 86400000) },
    { title: "Juara 1 Lomba Mewarnai Tingkat Kota", studentName: "Khadijah Aulia (kelas 3)", level: "Kabupaten", category: "Non-Akademik", date: new Date(now - 60 * 86400000) },
    { title: "Juara 1 Tahfidz Juz 30 Tingkat Kota", studentName: "Ahmad Zaki (kelas 5)", level: "Kabupaten", category: "Non-Akademik", date: new Date(now - 90 * 86400000) },
    { title: "Juara 3 Pidato Bahasa Inggris Tingkat Provinsi", studentName: "Sarah Wijaya (kelas 6)", level: "Provinsi", category: "Non-Akademik", date: new Date(now - 120 * 86400000) },
  ];
  for (const a of ach) {
    await db.achievement.create({
      data: {
        title: a.title,
        description: `Prestasi diraih oleh ${a.studentName}.`,
        studentName: a.studentName,
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
