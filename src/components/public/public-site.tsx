"use client";

import { GraduationCap } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/app";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { HomeView } from "./home-view";
import { ProfileView } from "./profile-view";
import { AcademicView } from "./academic-view";
import { NewsView } from "./news-view";
import { NewsDetailView } from "./news-detail-view";
import { GalleryView } from "./gallery-view";
import { ContactView } from "./contact-view";
import { ComplaintView } from "./complaint-view";
import { TeacherPortfolioView } from "./teacher-portfolio-view";
import { StrukturOrganisasiView } from "./struktur-organisasi-view";
import { TransparansiView } from "./transparansi-view";

interface PublicSiteProps {
  initialView?: string;
  initialSlug?: string;
  initialGuruId?: string;
}

export function PublicSite({
  initialView,
  initialSlug,
  initialGuruId,
}: PublicSiteProps) {
  const pathname = usePathname();
  const settings = useAppStore((s) => s.settings);

  if (!settings) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-muted-foreground">
        <div className="flex flex-col items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-sidebar-accent text-sidebar-foreground ring-2 ring-gold/40">
            <GraduationCap className="size-7 text-gold" />
          </span>
          <div className="mx-auto size-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm font-medium">Memuat…</p>
        </div>
      </div>
    );
  }

  // Use initialView if provided (for App Router), otherwise fall back to the
  // real pathname (the hash router was removed in the App Router migration).
  const currentView = initialView || pathname;

  let view: React.ReactNode;
  if (currentView === "/" || currentView === "" || currentView === "home") {
    view = <HomeView />;
  } else if (currentView === "profile" || currentView === "/profile") {
    view = <ProfileView />;
  } else if (currentView === "academic" || currentView === "/academic") {
    view = <AcademicView />;
  } else if (currentView === "news" || currentView === "/news") {
    if (initialSlug) {
      view = <NewsDetailView slug={initialSlug} />;
    } else {
      view = <NewsView />;
    }
  } else if (currentView.startsWith("/news/")) {
    view = <NewsDetailView />;
  } else if (currentView === "teacher" || currentView === "/teacher") {
    view = <TeacherPortfolioView guruId={initialGuruId} />;
  } else if (currentView === "gallery" || currentView === "/gallery") {
    view = <GalleryView />;
  } else if (
    currentView === "struktur-organisasi" ||
    currentView === "/struktur-organisasi"
  ) {
    view = <StrukturOrganisasiView />;
  } else if (currentView === "transparansi" || currentView === "/transparansi") {
    view = <TransparansiView />;
  } else if (currentView === "contact" || currentView === "/contact") {
    view = <ContactView />;
  } else if (currentView === "complaint" || currentView === "/complaint") {
    view = <ComplaintView />;
  } else {
    view = <HomeView />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">{view}</main>
      <SiteFooter />
    </div>
  );
}

export default PublicSite;
