"use client";

import { GraduationCap } from "lucide-react";
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

interface PublicSiteProps {
  initialView?: string;
  initialSlug?: string;
}

export function PublicSite({ initialView, initialSlug }: PublicSiteProps) {
  const route = useAppStore((s) => s.route);
  const settings = useAppStore((s) => s.settings);

  if (!settings) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-muted-foreground">
        <div className="flex flex-col items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground ring-2 ring-gold/40">
            <GraduationCap className="size-7 text-gold" />
          </span>
          <div className="mx-auto size-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm font-medium">Memuat…</p>
        </div>
      </div>
    );
  }

  // Use initialView if provided (for App Router), otherwise use hash-based route
  const currentView = initialView || route;

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
  } else if (currentView === "gallery" || currentView === "/gallery") {
    view = <GalleryView />;
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
