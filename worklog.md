# SMA Negeri 1 Nusantara — Worklog

This file is the shared worklog for all agents building the School Website + CMS.
Each agent MUST read this before starting and append a new `---` section after finishing.

---
Task ID: 1-6 (Foundation)
Agent: main (orchestrator)
Task: Set up theme, Prisma schema, auth/helpers, seed data, all API routes, Zustand store + hash router, shared components.

Work Log:
- Created Navy (#1e2a78-ish via oklch) + Gold accent theme in `src/app/globals.css`. Tokens: `--navy`, `--gold`, `--gold-foreground`. Sidebar uses navy bg. Also added `.custom-scroll`, `.animate-marquee`, `.animate-fade-in-up`, `.news-content` helpers.
- Updated `src/app/layout.tsx` metadata (lang="id"), added Sonner toaster.
- Defined full Prisma schema (`prisma/schema.prisma`): User, News, Announcement, Agenda, Teacher, GalleryItem, Achievement, SiteSetting (singleton), ActivityLog, ContactMessage. Ran `bun run db:push`.
- Created `src/lib/types.ts` (all item types + ROLES), `src/lib/auth.ts` (cookie session `smansara_session`, getSession/requireAuth/requireRole/hasRole/switch role), `src/lib/log.ts` (logActivity), `src/lib/format.ts` (slugify, formatDate, formatDateTime, relativeTime, readingTime, truncate), `src/lib/nav.ts` (PUBLIC_NAV, DASHBOARD_NAV, category constants).
- Seed script `prisma/seed.ts` with realistic Indonesian data. Ran it. Login accounts:
  - Super Admin: `admin@smansara.sch.id` / `admin123`
  - Operator: `operator@smansara.sch.id` / `operator123`
  - (extra operators incl. 1 disabled)
- Built ALL API routes under `src/app/api/`:
  - auth: login, logout, me, switch-role (mock role switch)
  - upload (multipart -> /uploads/<uuid>.ext, requires auth)
  - site-settings (GET public, PUT admin)
  - news (list w/ filters+pagination scope=public|admin, create) + [id] (GET by id|slug, PUT, DELETE)
  - announcements (public active / admin all, POST) + [id] (PUT, DELETE)
  - agenda (list, POST) + [id] (PUT, DELETE)
  - teachers (public active / admin all, POST) + [id] (PUT, DELETE)
  - gallery (list w/ filters, POST) + [id] (PUT, DELETE)
  - achievements (list, POST) + [id] (PUT, DELETE)
  - users (admin list + create) + [id] (admin PUT/DELETE)
  - activity-logs (admin list)
  - contact (public POST) + contact-messages (admin list) + [id] (PUT read / DELETE)
  - stats (dashboard overview counts + recentLogs + recentMessages + mock visits)
- Created Zustand store `src/store/app.ts`: route (hash-based), navigate(), user/auth (fetchMe/login/logout/switchRole), settings cache (fetchSettings), initHashRouter().
- Shared components: `src/components/shared/image-upload.tsx` (file->/api/upload OR url), `confirm-dialog.tsx`, `section-heading.tsx`.

Stage Summary:
- Foundation is COMPLETE and self-consistent. DB seeded. API contracts fixed (see below).
- Routing: SINGLE ROUTE only (`/`). All navigation is hash-based via `useAppStore`. Routes:
  Public: `/`, `/profile`, `/academic`, `/news`, `/news/:slugOrId`, `/gallery`, `/contact`
  Auth: `/login`
  Dashboard (auth required): `/dashboard`, `/dashboard/news`, `/dashboard/announcements`, `/dashboard/agenda`, `/dashboard/gallery`, `/dashboard/achievements`, `/dashboard/teachers`, `/dashboard/messages`
  Admin-only dashboard: `/dashboard/users`, `/dashboard/settings`, `/dashboard/logs`
- IMPORTANT for UI agents: use `useAppStore` for navigation (`navigate`, `route`, `user`) and settings (`settings`, `fetchSettings`). Never use Next `<Link href>` for internal nav (only for anchor/external). Use plain `<button onClick={()=>navigate('/path')}>` or a helper. External images: use plain `<img>` (NOT next/image) to avoid domain config issues.
- Color usage: primary = navy (use `bg-primary text-primary-foreground`), gold accent = `bg-gold text-gold-foreground` / `text-gold-foreground`. Sidebar already navy-styled via tokens.
- API CONTRACTS (consume these exact endpoints):
  - GET `/api/site-settings` -> SiteSettingItem
  - GET `/api/news?scope=public&category=&search=&page=&limit=` -> {items, total, page, limit, totalPages}; scope=admin requires auth & shows all incl drafts (optional &status=)
  - GET `/api/news/:idOrSlug` -> NewsItem (with authorName)
  - POST/PUT `/api/news[/:id]` body {title, excerpt, content, coverImage, category, status}
  - GET `/api/announcements?scope=public|admin` -> {items}
  - POST/PUT `/api/announcements[/:id]` {title, content, isPinned, expiresAt(ISO), isActive}
  - GET `/api/agenda?upcoming=true&category=` -> {items}; POST/PUT {title, description, date(ISO), time, location, category}
  - GET `/api/teachers?scope=public|admin` -> {items}; POST/PUT {name, position, subject, education, photo, order, isActive}
  - GET `/api/gallery?category=&type=` -> {items}; POST/PUT {title, description, type PHOTO|VIDEO, url, thumbnail, category}
  - GET `/api/achievements?limit=` -> {items}; POST/PUT {title, description, studentName, level, category, date}
  - GET `/api/users` (admin) -> {items}; POST {name,email,password,role}; PUT [id] {name,email,role,isActive,password?}; DELETE [id]
  - GET `/api/activity-logs?limit=&entity=` (admin) -> {items}
  - POST `/api/contact` {name,email,phone,subject,message}
  - GET `/api/contact-messages` (auth) -> {items}; PUT `/api/contact-messages/:id` {isRead}; DELETE
  - GET `/api/stats` (auth) -> {counts:{...}, recentLogs, recentMessages}
  - POST `/api/upload` FormData(file) -> {url}  (use ImageUpload component)
  - POST `/api/auth/switch-role` {role} -> {role}
- Types are in `src/lib/types.ts` — import as needed.
- Next.js 16 + React 19 + Tailwind v4 (CSS-first via globals.css; tailwind.config.ts also present). shadcn/ui components all exist in `src/components/ui/`. Use them.
- DO NOT create new routes in `src/app/` (no new page.tsx). Only the main `src/app/page.tsx` exists and will be assembled by main agent.
- Available category constants in `src/lib/nav.ts`: NEWS_CATEGORIES, GALLERY_CATEGORIES, AGENDA_CATEGORIES, ACHIEVEMENT_LEVELS, ACHIEVEMENT_CATEGORIES.

---

---
Task ID: 7
Agent: public-ui
Task: Build the public-facing school website UI.

Work Log:
- Read worklog.md and inspected all foundation files (types, format, nav, store, shared components, globals.css, seed data, UI primitives).
- Created 11 files under `src/components/public/` plus one small `_shared.tsx` helper module (CategoryBadge, SectionShell, PageBanner) — all marked `"use client"`.
- site-header: sticky white header with navy/gold crest (GraduationCap in gold), school name + NPSN, desktop PUBLIC_NAV with gold underline active state, gold "PPDB" + ghost "Login" buttons, mobile Sheet with stacked nav.
- site-footer: navy bg + white text, identity column (address/phone/email from settings), tautan cepat (PUBLIC_NAV), sosial media icon buttons (Facebook/Instagram/Youtube/Music2-for-TikTok), bottom copyright row. Uses `mt-auto` to stick to bottom.
- running-announcements: thin navy bar with gold Megaphone + marquee of active announcements (duplicated twice for seamless loop, `.animate-marquee`, pause on hover). Hides if empty.
- home-view: Framer Motion hero carousel (5s auto-rotate, dot indicators, full-bleed img + navy gradient overlay + gold "Baca Selengkapnya" button), running announcements bar, Sambutan Kepala Sekolah (gold-ring principal photo + welcome text + name), Statistik Cepat (4 stat cards: Siswa/Guru/Fasilitas/Prestasi), Berita Terbaru (3 cards + "Lihat semua"), Agenda Mendatang (4 rows with date chip + title + location + time), Prestasi Terbaru (3 cards with Trophy + level badge), navy CTA band ("PPDB 2025/2026 Dibuka!" + gold "Daftar Sekarang").
- profile-view: navy PageBanner "Profil Sekolah", Sejarah Singkat card, Visi (gold-bordered) + Misi (numbered list split by newline) two-column, Struktur Organisasi (filtered teachers where position contains "Kepala"/"Wakil"), Fasilitas Sekolah static 8-card grid (Lab IPA, Lab Komputer, Perpustakaan, Lapangan, Aula, Masjid, Kantin, UKS), quote band, mini-stats band.
- academic-view: navy PageBanner "Akademik & Direktori", Direktori Guru with live search input + responsive card grid, Kalender Akademik grouped by month with date chips, Ekstrakurikuler 12-card grid (Pramuka/OSIS/PMR/Paskibra/Robotik/KIR/English Club/Futsal/Basket/Voli/Tari/Paduan Suara).
- news-view: navy PageBanner "Berita & Pengumuman", debounced search input (~400ms), category pills (Semua + NEWS_CATEGORIES), 9-per-page grid with skeletons + empty state, prev/next + numbered pagination.
- news-detail-view: reads slug from `route.split("/")[2]`, fetches `/api/news/:slug`, loading skeleton + 404 state, 2/3 article (cover, badge, title, meta with authorName + formatDate + readingTime, content via dangerouslySetInnerHTML in `.news-content`, "Kembali ke Berita" button, Web Share API + clipboard fallback), 1/3 sidebar (Berita Terkait — same category, exclude current, max 3) + gold PPDB CTA card.
- gallery-view: navy PageBanner "Galeri Kegiatan", type tabs (Semua/Foto/Video) + category chips (Semua + GALLERY_CATEGORIES), CSS-columns masonry grid with thumbnail + hover overlay (title + type icon — Play for VIDEO, Image for PHOTO), Dialog lightbox: PHOTO → centered `<img>`, VIDEO → `<iframe>` of youtube embed; prev/next navigation between items.
- contact-view: navy PageBanner "Hubungi Kami & PPDB", two-column LEFT form (name/email/phone/subject/message) → POST `/api/contact` with loading + sonner toast + reset; RIGHT info card (address/phone/email/hours + social icon buttons + Google Maps iframe via settings.mapEmbed). PPDB section with `id="ppdb"`, navy bg, settings.ppdbInfo text, "Daftar Online" button, 4-card grid of jalur + quotas (Zonasi 50%, Afirmasi 15%, Prestasi 30%, Perpindahan Tugas 5%).
- public-site: DEFAULT + named export `PublicSite`. Full-screen centered loader (navy crest + spinner + "Memuat…") when `!settings`. Route switch on `route` from store: `/` → HomeView, `/profile` → ProfileView, `/academic` → AcademicView, `/news` → NewsView, `startsWith("/news/")` → NewsDetailView, `/gallery` → GalleryView, `/contact` → ContactView, default → HomeView. Shell `<div className="flex min-h-screen flex-col bg-background">` + `<SiteHeader />` + `<main className="flex-1">` + `<SiteFooter />` (footer has mt-auto so it sticks on short pages and pushes down on long pages). RunningAnnouncements rendered inside HomeView, not the shell, per spec.
- Used `text-gold` for actual gold-colored text/icons (CSS `--gold-foreground` is dark navy, intended for text ON gold backgrounds). All category badges use a CategoryBadge helper with category-specific color map (Prestasi=gold, Akademik=navy, Kegiatan=emerald, etc.).
- All cards use `rounded-xl border bg-card shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all`. Section padding `py-12 sm:py-16`, container `mx-auto w-full max-w-7xl px-4 sm:px-6`.
- All images use plain `<img>` with alt text + loading="lazy" (no next/image, no Next Link for internal nav — only `useAppStore.navigate`).
- Ran `bun run lint`: 0 errors in public files. Ran `bunx tsc --noEmit`: 0 type errors in `src/components/public/`. Dev server compiles cleanly (verified via `dev.log`).

Stage Summary:
- Files created (all under `src/components/public/`):
  - `_shared.tsx` (CategoryBadge, SectionShell, PageBanner helpers)
  - `site-header.tsx`, `site-footer.tsx`, `running-announcements.tsx`
  - `home-view.tsx`, `profile-view.tsx`, `academic-view.tsx`
  - `news-view.tsx`, `news-detail-view.tsx`, `gallery-view.tsx`, `contact-view.tsx`
  - `public-site.tsx` (DEFAULT + named export `PublicSite`)
- Agent work record: `/agent-ctx/7-public-ui.md`
- Integration note: `src/app/page.tsx` (NOT modified by me — out of scope) should render `<PublicSite />` after the existing `initHashRouter() + fetchMe() + fetchSettings()` bootstrap. Both `import PublicSite from "@/components/public/public-site"` and `import { PublicSite } from "@/components/public/public-site"` work.
- Public UI is complete and self-contained; ready for the orchestrator to wire into `src/app/page.tsx`.

---
Task ID: 8
Agent: dashboard-ui
Task: Build the CMS dashboard + login UI.

Work Log:
- Read worklog.md fully and inspected all foundation files (types, format, nav, store, shared components, ui primitives, API route handlers) to align with exact contracts.
- Created 13 files under `src/components/auth/` and `src/components/dashboard/` plus one small `_shared.tsx` helper module (actionBadgeClass, actionLabel, PageLoader, EmptyState, toDateInputValue, fromDateInputValue) — all marked `"use client"`.
- login-view.tsx: Full-screen navy gradient (`from-primary via-primary to-primary/80`) with subtle GraduationCap watermark. Centered Card with crest + "SMA Negeri 1 Nusantara" + "Portal CMS Sekolah". Form: email, password (Eye/EyeOff toggle), gold submit button w/ Loader2 spinner. `useEffect` redirect to `/dashboard` if `user` already set. Gold-tinted demo-credentials box with two rows (admin@smansara.sch.id/admin123 Super Admin, operator@smansara.sch.id/operator123 Operator), each row has an "Isi Otomatis" button. Inline Alert + sonner toast on error. "← Kembali ke Beranda" links to `/`.
- dashboard-shell.tsx: Auth guard (`!user && !authLoading` → useEffect navigate("/login"), return null; `authLoading` → full-screen loader). Layout `min-h-screen flex flex-col bg-muted/30`. Desktop sidebar (~260px, `bg-sidebar text-sidebar-foreground`) with crest + "SMA Negeri 1 · Panel CMS"; nav grouped into "Ringkasan", "Manajemen Konten", "Administrasi" — adminOnly items filtered out for operators. Active item gets `bg-sidebar-accent text-sidebar-accent-foreground` + gold left-border bar. Mobile sidebar hidden, replaced by Sheet (left side) opened from topbar hamburger. Sticky white topbar: page title derived from DASHBOARD_NAV matching `route` + mobile hamburger (left), gold/navy role badge + outline "Switch Role (Mock)" w/ Repeat icon + Tooltip + ghost "Lihat Situs" w/ ExternalLink + DropdownMenu user menu w/ name/email + destructive Logout (right). Route → module switch; admin-only routes when user is operator → "Akses Ditolak" card (Lock icon + back button). Sticky footer `mt-auto` with `© year SMA Negeri 1 Nusantara — CMS v1.0`.
- overview.tsx: Fetches `/api/stats`. 4 primary cards (Total Berita/Pengumuman Aktif/Jumlah Guru/Total Kunjungan) with colored icon circles. Secondary 6-pill row (publishedNews, draftNews, galleryCount, achievementCount, unreadMessages, userCount). "Aksi Cepat" buttons (Tambah Berita/Buat Pengumuman/Jadwalkan Agenda/Tambah Galeri/Tambah Prestasi) → navigate. Two-column cards: "Aktivitas Terakhir" (recentLogs with actionBadgeClass color-coded badges [CREATE=emerald, UPDATE=primary navy, DELETE=destructive red, LOGIN/LOGOUT=muted], entity, detail, userName, relativeTime) AND "Pesan Masuk Terbaru" (recentMessages, unread bold with gold dot, subject + snippet). All lists wrapped in `max-h-[60vh] overflow-y-auto custom-scroll`.
- news-manager.tsx: Toolbar (Tambah Berita Dialog button, search input, status filter Select, category filter Select). Table with Judul (thumbnail + title), Kategori badge, Status badge (Published=emerald-600, Draft=muted), Penulis (authorName), Tanggal (formatDate of publishedAt or createdAt), Aksi (Edit → Dialog, Delete → ConfirmDialog). Fetches `/api/news?scope=admin&status=&category=&page=1&limit=10` with debounced search (350ms); refetch on filter/page change & after mutations; prev/next pagination. Create/Edit Dialog: title Input, category Select (NEWS_CATEGORIES), status Select (Draft/Published), excerpt Textarea, coverImage ImageUpload (aspect video), and a simple rich text editor. Save → POST or PUT → toast → close dialog → refetch.
  - **Simple rich text editor** (inline `RichTextEditor` component in this file): toolbar of 9 ghost-icon buttons (Bold, Italic, Underline, H2, H3, Bullet list, Numbered list, Link, Image-by-URL) + a "Paragraf" button, operating on a `contentEditable` div. A single `useCallback` `runTool(action)` switch dispatches `document.execCommand('bold'|'italic'|'underline'|'formatBlock'('<h2>'|'<h3>'|'<p>')|'insertUnorderedList'|'insertOrderedList'|'createLink'|'insertImage')`; createLink/insertImage use `window.prompt`. `onInput`/`onBlur` read `el.innerHTML` and propagate up via `onChange`. Initial content is set once via `useEffect([])` (the parent passes a `key={editing?.id ?? "new"}` so the editor remounts fresh when the dialog opens on a different item — this avoids the cursor-reset issue that would happen if we synced props→DOM after mount). The editable area uses `.news-content` (existing globals.css) so headings/lists render with proper typography.
- announcements-manager.tsx: Card grid of announcements. Each card: pinned gold pin icon, title, content snippet, badges (Aktif/Nonaktif emerald/muted + Disematkan gold with Star), expiry (formatDate), Edit + Delete (ConfirmDialog). "Buat Pengumuman" Dialog: title Input, content Textarea, expiresAt `<input type="date">`, isPinned Switch, isActive Switch. Create/Update via POST/PUT. Refetch after mutations.
- agenda-manager.tsx: Table sorted by date asc (server already sorts asc) — columns Tanggal/Waktu/Kegiatan/Lokasi/Kategori badge/Aksi. Dialog form: title, date `<input type="date">`, time text input ("07.00 - 08.00 WIB"), location, category Select (AGENDA_CATEGORIES), description Textarea. Uses `toDateInputValue`/`fromDateInputValue` helpers from `_shared`.
- gallery-manager.tsx: Responsive grid (2/3/4 cols) of media cards — thumbnail `<img>`, type badge (PHOTO=gold / VIDEO=navy with PlayCircle icon), title, category; Edit + Delete on hover overlay. Dialog form: title, type Select (PHOTO/VIDEO), category Select (GALLERY_CATEGORIES), description. PHOTO → `ImageUpload` (value→url). VIDEO → URL input (YouTube embed URL) + optional `ImageUpload` for thumbnail.
- achievements-manager.tsx: Table with Judul, Siswa, Jenjang (level badge colored by level — Internasional/Nasional=gold, Provinsi=navy, others=muted), Kategori, Tanggal, Aksi. Dialog form: title, studentName, level Select (ACHIEVEMENT_LEVELS), category Select (ACHIEVEMENT_CATEGORIES), date `<input type="date">`, description Textarea.
- teachers-manager.tsx: Card grid with rounded photo avatar (or UserCircle2 fallback), nama, jabatan, subject badge, education, status badge (Aktif emerald / Nonaktif muted), Edit + Delete. Dialog form: name, position, subject, education, photo `ImageUpload` (aspect square), isActive Switch.
- messages-manager.tsx: Accordion list of contact messages inside `max-h-[65vh] overflow-y-auto custom-scroll`. Unread messages get a gold dot + bold subject + "Baru" gold badge; read get muted "Dibaca" badge. Header shows unread count badge. Expanding a row marks it read via PUT (`onValueChange` on the Accordion, fires once per open). Expanded panel shows email/phone/datetime + full message + "Tandai Belum Dibaca"/"Tandai Dibaca" toggle + Delete (ConfirmDialog).
- users-manager.tsx (ADMIN ONLY): Header "Manajemen Operator" + "Tambah Operator" button. Table: Nama (with "Anda" badge if `me.id === u.id`), Email, Peran badge (Admin=gold, Operator=navy), Status (Aktif=emerald, Nonaktif=muted), Dibuat (formatDate), Aksi (Edit, Disable/Enable toggle, Delete via ConfirmDialog). Delete-self button is disabled + wrapped in a Tooltip ("Anda tidak dapat menghapus akun sendiri."). Add Dialog: name, email, password (min 6), role Select (OPERATOR/SUPER_ADMIN). Edit Dialog: name, email, role, isActive Switch, optional new password (label notes "kosongkan jika tidak diubah"). After mutations refetch. 403 handled with toast.
- settings-manager.tsx (ADMIN ONLY): Loads `/api/site-settings` fresh on mount. Stacked cards grouped into 8 sections: Identitas Sekolah (schoolName, npsn, logo ImageUpload square), Kontak (address Textarea, phone, email, mapEmbed Textarea), Media Sosial (facebook/instagram/youtube/tiktok URL inputs), Kepala Sekolah (principalName, principalPhoto ImageUpload, principalWelcome Textarea), Visi & Misi (vision, mission Textareas), Sejarah (history Textarea), Statistik (studentCount/teacherCount/facilityCount/achievementCount number inputs), Info PPDB (ppdbInfo Textarea). Single sticky bottom save bar (`fixed inset-x-0 bottom-0`) with "Simpan Perubahan" → `PUT /api/site-settings` with all fields → sonner toast + invalidates store cache via `useAppStore.setState({ settings: null })` then `useAppStore.getState().fetchSettings()` so the public site picks up changes. 403 handled gracefully with friendly message.
- logs-view.tsx (ADMIN ONLY): Filter-by-entity Select (Semua + News/Announcement/Agenda/Teacher/Gallery/Achievement/User/SiteSetting/Auth). Table inside `max-h-[65vh] overflow-y-auto custom-scroll` with sticky header: Waktu (formatDateTime), Pengguna (userName), Aksi (badge color-coded via actionBadgeClass), Entitas (outline badge), Detail. Read-only. Note at top: "Catatan ini merekam semua aktivitas Create/Update/Delete oleh operator & admin."
- General patterns: simple `useCallback`+`useEffect`+`useState` per module (no react-query / no react-hook-form to reduce risk). After every successful create/update/delete: `toast.success`, refetch list, close any open dialog. On non-ok response: `toast.error(data.error || "Gagal menyimpan.")`. `ConfirmDialog` used for all deletes. Plain controlled state for all forms. Badges via shadcn Badge with className overrides for colors. Lucide icons throughout.
- Ran `bun run lint`: 0 errors / 0 warnings in my files (only a pre-existing warning in `src/components/shared/image-upload.tsx` which is NOT my file). Ran `bunx tsc --noEmit`: 0 type errors in `src/components/auth/` and `src/components/dashboard/`. Dev server compiles all files cleanly (verified via `dev.log`).

Stage Summary:
- Files created (all under `src/components/auth/` and `src/components/dashboard/`):
  - `auth/login-view.tsx` (DEFAULT + named export `LoginView`)
  - `dashboard/dashboard-shell.tsx` (DEFAULT + named export `DashboardShell`)
  - `dashboard/_shared.tsx` (actionBadgeClass, actionLabel, PageLoader, EmptyState, toDateInputValue, fromDateInputValue)
  - `dashboard/modules/overview.tsx`
  - `dashboard/modules/news-manager.tsx` (incl. inline `RichTextEditor`)
  - `dashboard/modules/announcements-manager.tsx`
  - `dashboard/modules/agenda-manager.tsx`
  - `dashboard/modules/gallery-manager.tsx`
  - `dashboard/modules/achievements-manager.tsx`
  - `dashboard/modules/teachers-manager.tsx`
  - `dashboard/modules/messages-manager.tsx`
  - `dashboard/modules/users-manager.tsx` (ADMIN ONLY)
  - `dashboard/modules/settings-manager.tsx` (ADMIN ONLY)
  - `dashboard/modules/logs-view.tsx` (ADMIN ONLY)
- All modules export both named (e.g. `export function NewsManager`) and default (e.g. `export default NewsManager`) — the shell uses named imports.
- Integration note for orchestrator: `src/app/page.tsx` (NOT modified by me — out of scope) should branch on `useAppStore(s => s.route)` to render `<LoginView />` for `route === "/login"`, `<DashboardShell />` for any `route.startsWith("/dashboard")` (when `user` is present), and `<PublicSite />` for public routes. The auth redirect inside DashboardShell already handles the unauthenticated case (it `navigate("/login")`s and renders null), but routing into DashboardShell only when authenticated avoids a flash. Both `import LoginView from "@/components/auth/login-view"` and `import { LoginView } from "@/components/auth/login-view"` work (same for DashboardShell).
- Notable decision — simple rich text editor: built as an inline `RichTextEditor` component (in news-manager.tsx) using a `contentEditable` div + `document.execCommand`. Toolbar buttons call a single `useCallback` `runTool(action)` switch that focuses the editor, dispatches the appropriate execCommand, then reads `el.innerHTML` via `onInput`/`onBlur` to propagate the HTML up through `onChange`. Initial content is seeded via a mount-only `useEffect`, and the parent passes a `key={editing?.id ?? "new"}` so the editor remounts when the dialog opens on a different item — this sidesteps the cursor-jump problem that would occur if we synced props→innerHTML after mount. execCommand is deprecated but works fine for this prototype and matches the spec exactly.
- Dashboard + login UI is complete, lint-clean, type-clean, and self-contained; ready for the orchestrator to wire into `src/app/page.tsx`.
Task ID: 9-10 (Integration & Verification)
Agent: main (orchestrator)
Task: Assemble main page.tsx shell, lint, browser-verify the golden path.

Work Log:
- Wrote `src/app/page.tsx` as the single-route shell: on mount runs initHashRouter + fetchMe + fetchSettings; shows branded loader while authLoading; resolves route — `/login` -> LoginView (auto-redirect to /dashboard if already authed), `/dashboard*` -> DashboardShell (handles own guard), everything else -> PublicSite.
- Removed stray eslint-disable in shared/image-upload.tsx.
- Verified dev server stays up (double-detach `( setsid bash -c 'next dev ...' & )` avoids the tee-pipe SIGPIPE that killed `bun run dev`).
- Lint: `bun run lint` -> 0 errors, 0 warnings.

Browser verification (agent-browser) — all golden paths pass:
- Public home renders: hero carousel (3 slides, auto-rotate), running-announcement marquee, principal welcome, quick stats, latest news, upcoming agenda, latest achievements, PPDB CTA, footer with socials.
- Hash routing works: `/` -> home, click Berita -> `/#/news` (6 articles + search + pagination), click article -> `/#/news/<slug>` detail with related news + share.
- Gallery `/#/gallery`: 14 items, click opens Dialog lightbox with prev/next + close.
- Login `/#/login`: auto-fill admin creds -> submit -> redirect `/#/dashboard`.
- Dashboard overview: 4 stat cards + secondary stats + quick actions + recent activity + recent messages. Role badge shows "Login sebagai: Admin". Sidebar shows ALL nav incl. admin-only items.
- News manager: table (title/category/status/author/date/actions). "Tambah Berita" dialog has full rich-text editor toolbar (Bold/Italic/H2/H3/UL/OL/Link/Image) + ImageUpload + category/status selects. Created a test article -> appeared in table + recorded in ActivityLog (verified via API). Deleted it via API.
- Switch Role (Mock): toggled Admin -> Operator. Badge changed to "Login sebagai: Operator"; admin-only nav items (Manajemen Operator, Pengaturan Sekolah, Log Aktivitas) disappeared. Navigating operator to `/#/dashboard/users` shows "Akses Ditolak" card. Switched back to Admin.
- Admin modules verified: Users manager (table w/ role badges, active/disabled, edit/enable/delete), Activity Logs (table w/ color-coded action badges, entity filter, captured the SWITCH actions), Site Settings (form pre-filled with seeded data — name/NPSN/principal/vision/history/etc.).
- Mobile (390x844): hamburger "Buka menu navigasi" opens Sheet with full nav + Login.
- Sticky footer: wrapper confirmed `min-h-screen flex-col`; on long home page footer bottom (900) == viewport (900) — flush, pushed down naturally (and sticks on short pages via mt-auto).
- No console errors, no runtime errors in dev.log across all interactions.

Stage Summary:
- Project COMPLETE and browser-verified end-to-end. Single `/` route with hash-based SPA navigation. Navy+Gold theme, fully responsive, RBAC enforced (Operator vs Super Admin) with mock role switcher for testing. Realistic Indonesian school mock data seeded. All CRUD modules functional. Sticky footer correct.
- Login accounts: admin@smansara.sch.id / admin123 (Super Admin), operator@smansara.sch.id / operator123 (Operator).
