# Task 18-A — UI/UX Audit Fix

Agent: ui-audit-fix (main orchestrator)
Date: 2025

## Goal
Fix the four UI/UX audit gaps on the homepage: sr-only H1, gallery skeleton verification, home sections skeleton loading, and section spacing standardization.

## Files Edited
- `src/components/public/home-view.tsx` (only file actually edited)
- `src/components/public/gallery-view.tsx` (verified only — skeleton already good)
- `src/components/public/_shared.tsx` (verified only — SectionShell already `py-12 sm:py-16`)

## Changes Made in home-view.tsx

### 1. sr-only H1
Added as the very first child of the HomeView returned fragment (before Hero section):
```tsx
<h1 className="sr-only">
  {settings?.schoolName ?? "SD Negeri Unggulan Mongisidi 1"}
</h1>
```

### 2. isLoading derived state
```tsx
const isLoading = hero === null && !loadError;
```
- `hero === null` = initial load (before any fetch result)
- `!loadError` = fetch has not failed (the catch block sets hero=`[]`, not null, so after an error isLoading=false and ErrorState takes over)

### 3. Agenda Mendatang skeleton (4 rows)
Each row: `size-14` rounded-lg date chip skeleton + 2 text lines (h-4 w-3/4, h-3 w-1/2).
Layout matches AgendaRow visual (bordered card, p-4, gap-4, date chip on left + text on right).

### 4. Prestasi Terbaru skeleton (3 rows)
Each row: `size-10` rounded-full icon-circle skeleton + 2 text lines (h-4 w-full, h-3 w-2/3).
Layout matches the icon-circle hint from AchievementCard.

### 5. Berita Terbaru skeleton (already existed)
3 cards: `aspect-[16/10]` image skeleton + 5 text lines (date, title, title, excerpt, excerpt) inside p-5. Confirmed working via existing `latestNews === null` check. No change needed.

## Verified Untouched
- Gallery view already has 9-item masonry skeleton with varying aspect ratios (4/3 and 1/1).
- `SectionShell` already uses `py-12 sm:py-16`.

## Verification
- `bun run lint` → 0 errors, 0 warnings.
- Dev server healthy (GET / 200 in dev.log).
- Skeletons only render during initial load. Empty-state messages ("Belum ada agenda mendatang." / "Belum ada prestasi terbaru.") still appear after load completes with zero items. ErrorState still renders on fetch failure.
- sr-only H1 verified as first child of fragment via file read.

## Constraints Honored
- Only edited `home-view.tsx`.
- No API/auth/other components touched.
- Plain `<img>` retained (no next/image).
- Dark mode + error states + all existing functionality intact.
- shadcn `Skeleton` component used (already imported).

## Notes for Future Agents
- The sr-only H1 + visible hero `<motion.h1>` is intentional — sr-only establishes site identity for SEO, the visible H1 carries the page-specific news headline. This is a common pattern for content-driven sites.
- If you need to extend loading skeletons to other public views (news-view, news-detail-view, contact-view), the same `isLoading = state === null && !error` pattern works well.
