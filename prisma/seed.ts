import { PrismaClient } from "@prisma/client";
import { slugify } from "../src/lib/format";

const db = new PrismaClient();

function img(seed: string, w = 1200, h = 700) {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}
function avatar(n: number) {
  return `https://i.pravatar.cc/400?img=${n}`;
}

async function main() {
  console.log("🌱 Seeding SMA Negeri 1 Nusantara...");

  // Wipe
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
      name: "Dr. Bambang Sutrisno, M.Pd.",
      email: "admin@smansara.sch.id",
      password: "admin123",
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  const op1 = await db.user.create({
    data: {
      name: "Siti Rahmawati, S.Pd.",
      email: "operator@smansara.sch.id",
      password: "operator123",
      role: "OPERATOR",
      isActive: true,
    },
  });

  const op2 = await db.user.create({
    data: {
      name: "Ahmad Fauzi, S.Pd.",
      email: "ahmad@smansara.sch.id",
      password: "operator123",
      role: "OPERATOR",
      isActive: true,
    },
  });

  const op3 = await db.user.create({
    data: {
      name: "Dewi Lestari, S.Kom.",
      email: "dewi@smansara.sch.id",
      password: "operator123",
      role: "OPERATOR",
      isActive: false,
    },
  });

  // ---------- SITE SETTINGS ----------
  await db.siteSetting.create({
    data: {
      id: "singleton",
      schoolName: "SMA Negeri 1 Nusantara",
      npsn: "20100001",
      logo: null,
      address:
        "Jl. Pendidikan No. 1, Kel. Nusantara Jaya, Kec. Nusantara, Kota Nusantara 12345",
      phone: "(021) 1234567",
      email: "info@smansara.sch.id",
      mapEmbed:
        "https://www.google.com/maps?q=Monas+Jakarta&output=embed",
      vision:
        "Menjadi pusat pendidikan menengah unggul yang menghasilkan generasi beriman, berakhlak mulia, cerdas, terampil, dan berdaya saing global pada tahun 2030.",
      mission:
        "1. Menyelenggarakan pendidikan berbasis karakter dan nilai-nilai keagamaan.\n2. Mengembangkan kurikulum yang relevan dengan perkembangan ilmu pengetahuan dan teknologi.\n3. Meningkatkan kompetensi pendidik dan tenaga kependidikan secara berkelanjutan.\n4. Membangun budaya literasi, riset, dan inovasi peserta didik.\n5. Menjalin kemitraan dengan masyarakat, dunia usaha, dan perguruan tinggi.",
      history:
        "SMA Negeri 1 Nusantara didirikan pada 17 Agustus 1965 atas prakarsa tokoh masyarakat dan pemerintah daerah. Berawal dari tiga ruang kelas sederhana, sekolah ini terus berkembang menjadi institusi pendidikan menengah terkemuka. Hingga kini, puluhan ribu alumni tersebar di berbagai bidang, dari akademisi, pejabat, hingga pengusaha. Dengan akreditasi A, SMA Negeri 1 Nusantara berkomitmen mencetak generasi pemimpin masa depan.",
      principalName: "Dr. Bambang Sutrisno, M.Pd.",
      principalPhoto: avatar(60),
      principalWelcome:
        "Selamat datang di website resmi SMA Negeri 1 Nusantara. Kami berkomitmen menyelenggarakan pendidikan berkualitas yang memadukan keimanan, ilmu pengetahuan, dan karakter. Mari bergabung membangun generasi unggul yang siap menghadapi tantangan masa depan.",
      facebook: "https://facebook.com/sman1nusantara",
      instagram: "https://instagram.com/sman1nusantara",
      youtube: "https://youtube.com/@sman1nusantara",
      tiktok: "https://tiktok.com/@sman1nusantara",
      studentCount: 1240,
      teacherCount: 78,
      facilityCount: 24,
      achievementCount: 156,
      ppdbInfo:
        "Penerimaan Peserta Didik Baru (PPDB) Tahun Ajaran 2025/2026 dibuka mulai 1 Juni 2025. Jalur yang tersedia: Zonasi (50%), Afirmasi (15%), Prestasi (30%), dan Perpindahan Tugas Orang Tua (5%). Pendaftaran dilakukan secara daring melalui portal PPDB. Kuota total 360 siswa untuk 9 rombongan belajar.",
      updatedAt: new Date(),
    },
  });

  // ---------- NEWS ----------
  const newsData = [
    {
      title: "Upacara Bendera Peringatan HUT Kemerdekaan RI ke-79",
      category: "Kegiatan",
      excerpt:
        "Seluruh warga sekolah mengikuti upacara bendera dengan khidmat untuk memperingati HUT Kemerdekaan Republik Indonesia ke-79.",
      content:
        "<p>SMA Negeri 1 Nusantara menggelar upacara bendera dalam rangka memperingati Hari Ulang Tahun Kemerdekaan Republik Indonesia ke-79 di lapangan utama sekolah, Sabtu (17/8). Kegiatan ini diikuti oleh seluruh siswa, guru, dan tenaga kependidikan.</p><p>Kepala Sekolah, Dr. Bambang Sutrisno, M.Pd., dalam sambutannya menekankan pentingnya memaknai kemerdekaan dengan kerja keras dan prestasi. \u201cKemerdekaan bukan sekadar bebas dari penjajahan, tetapi bebas dari kebodohan dan kemiskinan,\u201d ujarnya.</p><p>Upacara berjalan dengan tertib dan khidmat. Pasukan Pengibar Bendera Pusaka (Paskibra) tampil apik membawa bendera Merah Putih. Kegiatan ditutup dengan penyembelihan hewan qurban sebagai rangkaian kegiatan keagamaan.</p>",
      cover: img("upacara-79"),
      daysAgo: 3,
    },
    {
      title: "Siswa SMA Negeri 1 Nusantara Raih Medali Emas Olimpiade Sains Nasional",
      category: "Prestasi",
      excerpt:
        "Anindya Putri Maharani, siswa kelas XII IPA, meraih medali emas pada Olimpiade Sains Nasional (OSN) bidang Fisika 2024.",
      content:
        "<p>Bangga! Anindya Putri Maharani, siswi kelas XII IPA-1 SMA Negeri 1 Nusantara, berhasil meraih medali emas pada Olimpiade Sains Nasional (OSN) 2024 bidang Fisika yang diselenggarakan di Bali, pekan lalu.</p><p>Anindya mengalahkan lebih dari 200 peserta dari seluruh Indonesia. Ia mempersiapkan diri selama satu tahun dengan bimbingan tim pelatih sekolah. \u201cSaya sangat bersyukur. Ini hasil kerja keras dan doa,\u201d ungkap Anindya.</p><p>Kepala Sekolah menyampaikan apresiasi tinggi dan berharap prestasi ini memotivasi siswa lain. Sekolah memberikan beasiswa penuh untuk Anindya melanjutkan studi ke perguruan tinggi negeri favorit.</p>",
      cover: img("osn-emas"),
      daysAgo: 7,
    },
    {
      title: "Rapat Koordinasi Guru dan Tenaga Kependidikan Awal Semester",
      category: "Akademik",
      excerpt:
        "Seluruh guru dan tenaga kependidikan mengikuti rapat koordinasi untuk menyusun program kerja semester ganjil 2025/2026.",
      content:
        "<p>Dalam rangka menyongsong tahun ajaran baru, SMA Negeri 1 Nusantara mengadakan rapat koordinasi guru dan tenaga kependidikan di aula sekolah. Rapat membahas kalender akademik, pembagian tugas mengajar, serta program peningkatan mutu pembelajaran.</p><p>Kepala Sekolah mengarahkan seluruh guru untuk menerapkan pembelajaran berbasis proyek (project based learning) dan memperkuat literasi digital. Evaluasi pembelajaran akan menggunakan asesmen autentik.</p>",
      cover: img("rapat-guru"),
      daysAgo: 12,
    },
    {
      title: "Pekan Literasi dan Gelar Karya Siswa 2024",
      category: "Kegiatan",
      excerpt:
        "Serangkaian kegiatan pekan literasi diisi dengan lomba menulis, pamerkan karya, dan bedah buku bersama penulis nasional.",
      content:
        "<p>SMA Negeri 1 Nusantara menggelar Pekan Literasi dan Gelar Karya Siswa 2024 dengan tema \u201cMembaca Membuka Dunia\u201d. Kegiatan berlangsung selama lima hari dan menampilkan lomba menulis esai, puisi, serta pameran karya inovasi siswa.</p><p>Sebagai puncak acara, diadakan bedah buku bersama penulis nasional, Bapak Andrea Hirata. Beliau memotivasi siswa untuk menjadikan membaca sebagai gaya hidup.</p>",
      cover: img("literasi"),
      daysAgo: 20,
    },
    {
      title: "Tim Robotik Juara 1 Tingkat Provinsi",
      category: "Prestasi",
      excerpt:
        "Tim robotik sekolah berhasil meraih juara 1 pada kompetisi robotik tingkat provinsi dan berhak melaju ke tingkat nasional.",
      content:
        "<p>Tim Robotik SMA Negeri 1 Nusantara yang bernama \u201cNusantara Tech\u201d berhasil meraih juara 1 pada Kompetisi Robotik Cerdas Tingkat Provinsi 2024. Mereka mengalahkan 32 tim dari berbagai sekolah.</p><p>Robot yang dibuat mampu menyelesaikan misi sortir benda berwarna dalam waktu tercepat. Tim berhak mewakili provinsi pada kompetisi nasional bulan depan.</p>",
      cover: img("robotik"),
      daysAgo: 25,
    },
    {
      title: "Pelaksanaan Ujian Tengah Semester Ganjil 2025/2026",
      category: "Akademik",
      excerpt:
        "Ujian Tengah Semester (UTS) akan dilaksanakan secara luring dan daring dengan jadwal yang telah dibagikan kepada siswa.",
      content:
        "<p>Ujian Tengah Semester (UTS) Ganjil Tahun Ajaran 2025/2026 akan dilaksanakan mulai 23 September 2025. Siswa diharapkan mempersiapkan diri dengan baik.</p><p>Jadwal lengkap dapat diunduh pada halaman pengumuman. Tata tertib ujian wajib dipatuhi seluruh peserta.</p>",
      cover: img("uts"),
      daysAgo: 30,
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
      title: "Persiapan Festival Seni Budaya Akhir Tahun (Draf)",
      slug: slugify("Persiapan Festival Seni Budaya Akhir Tahun") + "-draft",
      excerpt:
        "Rencana kegiatan festival seni budaya yang akan digelar akhir tahun ajaran.",
      content:
        "<p>Artikel ini masih dalam tahap draf dan belum dipublikasikan.</p>",
      coverImage: img("festival-draft"),
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
      title: "Pengumuman Libur Hari Raya",
      content:
        "Diberitahukan kepada seluruh siswa dan guru, kegiatan belajar mengajar diliburkan mulai 10-18 April 2025 dalam rangka Hari Raya Idul Fitri. Kegiatan kembali normal pada 21 April 2025.",
      isPinned: true,
      expiresAt: new Date(now + 1000 * 60 * 60 * 24 * 30),
      isActive: true,
    },
  });
  await db.announcement.create({
    data: {
      title: "Pengumuman Hasil Seleksi OSN Tingkat Sekolah",
      content:
        "Hasil seleksi Olimpiade Sains Nasional tingkat sekolah telah diumumkan. Silakan cek papan pengumuman atau hubungi wali kelas masing-masing.",
      isPinned: false,
      expiresAt: new Date(now + 1000 * 60 * 60 * 24 * 14),
      isActive: true,
    },
  });
  await db.announcement.create({
    data: {
      title: "Pengumuman Jadwal Ujian Tengah Semester",
      content:
        "Jadwal UTS Ganjil 2025/2026 dapat diunduh pada halaman beranda. Mohon siswa mempersiapkan diri dengan baik.",
      isPinned: false,
      expiresAt: new Date(now + 1000 * 60 * 60 * 24 * 21),
      isActive: true,
    },
  });
  await db.announcement.create({
    data: {
      title: "Pengumuman Pendaftaran Ekstrakurikuler",
      content:
        "Pendaftaran ekskul dibuka mulai 1 September 2025. Tersedia 18 jenis ekstrakurikuler. Daftar melalui portal siswa.",
      isPinned: false,
      expiresAt: new Date(now + 1000 * 60 * 60 * 24 * 10),
      isActive: true,
    },
  });
  await db.announcement.create({
    data: {
      title: "Pengumuman Rapat Komite Sekolah",
      content:
        "Rapat komite sekolah dengan orang tua siswa akan diadakan pada 15 September 2025 pukul 09.00 WIB di aula.",
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
      time: "07.00 - 08.00 WIB",
      location: "Lapangan Utama",
      category: "Kegiatan",
      description: "Upacara bendera rutin setiap Senin pagi.",
    },
    {
      title: "Pelaksanaan Ujian Tengah Semester",
      date: new Date(agendaBase + 10 * 86400000),
      time: "07.30 - 12.00 WIB",
      location: "Ruang Kelas",
      category: "Akademik",
      description: "UTS untuk seluruh tingkatan.",
    },
    {
      title: "Lomba Kebersihan Kelas",
      date: new Date(agendaBase + 15 * 86400000),
      time: "13.00 - 15.00 WIB",
      location: "Seluruh Ruang Kelas",
      category: "Kegiatan",
      description: "Penilaian kebersihan dan kerapian kelas.",
    },
    {
      title: "Workshop Guru: Asesmen Autentik",
      date: new Date(agendaBase + 20 * 86400000),
      time: "09.00 - 12.00 WIB",
      location: "Aula Sekolah",
      category: "Akademik",
      description: "Pelatihan asesmen autentik untuk guru.",
    },
    {
      title: "Libur Hari Sumpah Pemuda",
      date: new Date(agendaBase + 35 * 86400000),
      time: "Sepanjang Hari",
      location: "-",
      category: "Libur",
      description: "Libur memperingati Hari Sumpah Pemuda.",
    },
    {
      title: "Pentas Seni Akhir Tahun",
      date: new Date(agendaBase + 60 * 86400000),
      time: "18.00 - 21.00 WIB",
      location: "Auditorium",
      category: "Kegiatan",
      description: "Pertunjukan seni siswa dan guru.",
    },
  ];
  for (const a of agenda) {
    await db.agenda.create({ data: a });
  }

  // ---------- TEACHERS ----------
  const teachers = [
    { name: "Dr. Bambang Sutrisno, M.Pd.", position: "Kepala Sekolah", subject: "Leadership", education: "S3 Manajemen Pendidikan", img: 60 },
    { name: "Hj. Siti Aminah, M.Pd.", position: "Wakil Kepala Sekolah Bidang Kurikulum", subject: "Matematika", education: "S2 Pendidikan Matematika", img: 45 },
    { name: "Drs. Suparman", position: "Wakil Kepala Sekolah Bidang Kesiswaan", subject: "Sejarah", education: "S1 Pendidikan Sejarah", img: 12 },
    { name: "Rina Marlina, S.Pd.", position: "Guru Bahasa Indonesia", subject: "Bahasa Indonesia", education: "S1 Pendidikan Bahasa Indonesia", img: 5 },
    { name: "Agus Salim, S.Pd., M.Pd.", position: "Guru Fisika", subject: "Fisika", education: "S2 Pendidikan Fisika", img: 33 },
    { name: "Maya Sari, S.Pd.", position: "Guru Bahasa Inggris", subject: "Bahasa Inggris", education: "S1 Pendidikan Bahasa Inggris", img: 20 },
    { name: " Hendra Gunawan, S.Kom.", position: "Guru Informatika", subject: "Informatika", education: "S1 Teknik Informatika", img: 15 },
    { name: "Dewi Anggraini, S.Pd.", position: "Guru Biologi", subject: "Biologi", education: "S1 Pendidikan Biologi", img: 25 },
    { name: "Joko Widodo, S.Pd.", position: "Guru Ekonomi", subject: "Ekonomi", education: "S1 Pendidikan Ekonomi", img: 8 },
    { name: "Nurul Hidayah, S.Pd.", position: "Guru Kimia", subject: "Kimia", education: "S1 Pendidikan Kimia", img: 16 },
    { name: "Budi Santoso, S.Pd.", position: "Pembina OSIS", subject: "PKn", education: "S1 Pendidikan PKn", img: 51 },
    { name: "Ratna Dewi, S.E.", position: "Bendahara Sekolah", subject: "-", education: "S1 Akuntansi", img: 48 },
  ];
  teachers.forEach(async (t, i) => {
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
  });

  // ---------- GALLERY ----------
  const gallery = [
    { title: "Upacara Bendera", category: "Upacara", seed: "upacara" },
    { title: "Laboratorium Komputer", category: "Fasilitas", seed: "lab-komputer" },
    { title: "Juara OSN Fisika", category: "Prestasi", seed: "juara-osn" },
    { title: "Kegiatan Pramuka", category: "Kegiatan", seed: "pramuka" },
    { title: "Perpustakaan", category: "Fasilitas", seed: "perpustakaan" },
    { title: "Lomba Marching Band", category: "Prestasi", seed: "marching" },
    { title: "Class Meeting", category: "Kegiatan", seed: "class-meeting" },
    { title: "Pentas Seni", category: "Kegiatan", seed: "pentas-seni" },
    { title: "Lapangan Olahraga", category: "Fasilitas", seed: "lapangan" },
    { title: "Wisuda Akbar", category: "Kegiatan", seed: "wisuda" },
    { title: "Olimpiade Matematika", category: "Prestasi", seed: "olim-mtk" },
    { title: "Ekstrakurikuler Robotik", category: "Kegiatan", seed: "robotik-gal" },
  ];
  for (const g of gallery) {
    await db.galleryItem.create({
      data: {
        title: g.title,
        description: `Dokumentasi ${g.title.toLowerCase()} SMA Negeri 1 Nusantara.`,
        type: "PHOTO",
        url: img(g.seed, 1280, 800),
        thumbnail: img(g.seed, 600, 400),
        category: g.category,
      },
    });
  }
  // A couple of "video" items (use a thumbnail + youtube url)
  await db.galleryItem.create({
    data: {
      title: "Profil Sekolah 2024 (Video)",
      description: "Video profil SMA Negeri 1 Nusantara.",
      type: "VIDEO",
      url: "https://www.youtube.com/embed/aqz-KE-bpKQ",
      thumbnail: img("profil-video", 1280, 800),
      category: "Kegiatan",
    },
  });
  await db.galleryItem.create({
    data: {
      title: "Cinematic Graduation 2024",
      description: "Dokumentasi wisuda dalam bentuk video.",
      type: "VIDEO",
      url: "https://www.youtube.com/embed/ScMzIvxBSi4",
      thumbnail: img("cinematic-grad", 1280, 800),
      category: "Kegiatan",
    },
  });

  // ---------- ACHIEVEMENTS ----------
  const ach = [
    { title: "Medali Emas OSN Fisika Nasional", studentName: "Anindya Putri Maharani", level: "Nasional", category: "Akademik", date: new Date(now - 7 * 86400000) },
    { title: "Juara 1 Kompetisi Robotik Provinsi", studentName: "Tim Nusantara Tech", level: "Provinsi", category: "Non-Akademik", date: new Date(now - 25 * 86400000) },
    { title: "Juara 2 Olimpiade Matematika Kabupaten", studentName: "Rizky Pratama", level: "Kabupaten", category: "Akademik", date: new Date(now - 40 * 86400000) },
    { title: "Juara 1 Lomba Cerdas Cermat Kimia", studentName: "Tim C3 Kimia", level: "Provinsi", category: "Akademik", date: new Date(now - 60 * 86400000) },
    { title: "Juara 1 Festival Film Pelajar", studentName: "Tim Sinema Nusantara", level: "Nasional", category: "Non-Akademik", date: new Date(now - 90 * 86400000) },
    { title: "Juara 3 Pidato Bahasa Inggris", studentName: "Sarah Wijaya", level: "Provinsi", category: "Non-Akademik", date: new Date(now - 120 * 86400000) },
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
      name: "Bapak Joko",
      email: "joko.parent@email.com",
      phone: "081234567890",
      subject: "Pertanyaan PPDB",
      message: "Apakah masih ada kuota jalur zonasi untuk tahun ajaran 2025/2026?",
      isRead: false,
    },
  });
  await db.contactMessage.create({
    data: {
      name: "Ibu Wati",
      email: "wati@email.com",
      phone: "081298765432",
      subject: "Informasi Beasiswa",
      message: "Mohon informasi mengenai program beasiswa prestasi untuk siswa baru.",
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
      detail: "Membuat berita baru: Upacara Bendera Peringatan HUT Kemerdekaan RI ke-79",
      createdAt: new Date(now - 3 * 86400000),
    },
  });
  await db.activityLog.create({
    data: {
      userId: op1.id,
      userName: op1.name,
      action: "CREATE",
      entity: "News",
      entityId: "-",
      detail: "Membuat berita baru: Siswa SMA Negeri 1 Nusantara Raih Medali Emas Olimpiade Sains Nasional",
      createdAt: new Date(now - 7 * 86400000),
    },
  });
  await db.activityLog.create({
    data: {
      userId: op2.id,
      userName: op2.name,
      action: "CREATE",
      entity: "Announcement",
      entityId: "-",
      detail: "Menerbitkan pengumuman: Pengumuman Libur Hari Raya",
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
      detail: "Memperbarui data guru: Agus Salim, S.Pd., M.Pd.",
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
  console.log("   Login Admin   : admin@smansara.sch.id / admin123");
  console.log("   Login Operator: operator@smansara.sch.id / operator123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
