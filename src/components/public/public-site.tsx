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

export function PublicSite() {
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

  let view: React.ReactNode;
  if (route === "/" || route === "") {
    view = <HomeView />;
  } else if (route === "/profile") {
    view = <ProfileView />;
  } else if (route === "/academic") {
    view = <AcademicView />;
  } else if (route === "/news") {
    view = <NewsView />;
  } else if (route.startsWith("/news/")) {
    view = <NewsDetailView />;
  } else if (route === "/gallery") {
    view = <GalleryView />;
  } else if (route === "/contact") {
    view = <ContactView />;
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
