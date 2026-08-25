import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { SeoManager } from "@/components/shared/seo-manager";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { ClientHooks } from "@/components/client-hooks";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "UPT SPF SD Negeri Unggulan Mongisidi 1 — Website Resmi Sekolah",
    description:
      "Website resmi UPT SPF SD Negeri Unggulan Mongisidi 1 Makassar. Beranda, profil sekolah, berita, pengumuman, galeri, direktori guru, dan informasi SPMB.",
    keywords: [
      "SD Negeri Unggulan Mongisidi 1",
      "SDN Mongisidi 1",
      "Mongisidi Makassar",
      "sekolah dasar",
      "website sekolah",
      "SPMB SD",
      "sekolah inklusi Makassar",
    ],
    authors: [{ name: "UPT SPF SD Negeri Unggulan Mongisidi 1" }],
    icons: {
      icon: "/logo.svg",
    },
    openGraph: {
      title: "UPT SPF SD Negeri Unggulan Mongisidi 1",
      description: "Website resmi SD Negeri Unggulan Mongisidi 1 Makassar",
      type: "website",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider>
            <ClientHooks />
            <SeoManager />
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
            <SonnerToaster richColors position="top-right" />
          </NextIntlClientProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
