# Task 7 — public-ui agent

## Scope
Build the public-facing UI for SMA Negeri 1 Nusantara under `src/components/public/`.

## Files created
- `src/components/public/_shared.tsx` — small shared helpers: `CategoryBadge`, `SectionShell`, `PageBanner` (all `"use client"`).
- `src/components/public/site-header.tsx` — sticky header with crest + school name + NPSN, desktop nav with gold underline active state, gold PPDB + ghost Login buttons, mobile Sheet menu.
- `src/components/public/site-footer.tsx` — navy footer (`bg-primary text-primary-foreground`) with identity column, quick links, social icons, copyright; uses `mt-auto` to stick to bottom.
- `src/components/public/running-announcements.tsx` — thin navy marquee bar (gold megaphone + duplicated titles using `.animate-marquee`); hides when empty.
- `src/components/public/home-view.tsx` — Framer Motion hero carousel (5s auto-rotate, dot indicators), running announcements bar, Sambutan Kepala Sekolah (gold-ring principal photo), Statistik Cepat (4 stat cards), Berita Terbaru (3 cards), Agenda Mendatang (date-chip rows), Prestasi Terbaru (3 cards), navy CTA band.
- `src/components/public/profile-view.tsx` — navy PageBanner, Sejarah card, Visi (gold-bordered) + Misi (numbered) two-column, Struktur Organisasi (filtered teachers where position contains "Kepala"/"Wakil"), static 8-facility grid, quote band, mini-stats band.
- `src/components/public/academic-view.tsx` — Direktori Guru with live search filter, Kalender Akademik grouped by month, 12-item Ekstrakurikuler grid.
- `src/components/public/news-view.tsx` — debounced search (~400ms), category pills (Semua/Akademik/Kegiatan/Prestasi), 9-per-page grid, prev/next + numbered pagination, empty state, skeletons.
- `src/components/public/news-detail-view.tsx` — reads slug from `route.split("/")[2]`, fetches `/api/news/:slug`, 2/3 article + 1/3 sidebar, related news (same category, exclude current, max 3), share button (Web Share API + clipboard fallback with sonner toast), 404 + loading states.
- `src/components/public/gallery-view.tsx` — masonry-style CSS columns grid, type tabs (Semua/Foto/Video) + category chips (Semua + GALLERY_CATEGORIES), Dialog lightbox with iframe for VIDEO / full `<img>` for PHOTO, prev/next navigation, thumbnail overlay with title/type icon.
- `src/components/public/contact-view.tsx` — two-column: LEFT form (name/email/phone/subject/message) → POST `/api/contact` with loading state + sonner toast + reset; RIGHT info card with address/phone/email/hours + social links + Google Maps iframe (settings.mapEmbed). PPDB section (`id="ppdb"`) with navy bg, info text, "Daftar Online" button, 4 jalur quota cards (Zonasi 50% / Afirmasi 15% / Prestasi 30% / Perpindahan Tugas 5%).
- `src/components/public/public-site.tsx` — DEFAULT EXPORT `PublicSite` + named export. Full-screen loader when `!settings`. Route switch (`/`, `/profile`, `/academic`, `/news`, `/news/:slug`, `/gallery`, `/contact`, default → HomeView). Shell: `min-h-screen flex flex-col` + `mt-auto` footer. `RunningAnnouncements` is rendered inside HomeView, not the shell (per task spec).

## Decisions / notes
- Used `text-gold` for actual gold-colored text/icons/lines (the CSS var `--gold-foreground` is dark navy, used for text ON gold backgrounds). Followed the existing `SectionHeading` shared component pattern (eyebrow with thin gold line).
- All `"use client"` directives added; no `next/image`, no Next `<Link>` for internal nav (only `useAppStore.navigate`).
- HomeView fetches hero/latest-news/agenda/achievements in a single `useEffect` with `Promise.all` to satisfy the `react-hooks/set-state-in-effect` lint rule (state setters are only called inside the async callback, not synchronously in the effect body).
- Gallery uses CSS columns for masonry effect + Dialog for lightbox (not a custom modal).
- News detail uses Web Share API when available, falls back to clipboard with sonner toast.
- All views render gracefully without settings (loader) and have loading skeletons + empty states.
- Verified: `bun run lint` → 0 errors in my files. `bunx tsc --noEmit` → 0 type errors in `src/components/public/`.

## Integration note for orchestrator
`src/app/page.tsx` should be updated (by the orchestrator, not me — I'm not allowed to modify it) to render `<PublicSite />` after the existing `initHashRouter()` / `fetchMe()` / `fetchSettings()` bootstrap. Import as `import PublicSite from "@/components/public/public-site"` (default export) or `import { PublicSite } from "@/components/public/public-site"` (named) — both work.
