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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://cms-monsa-l7qg.vercel.app";
  
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
    creator: "UPT SPF SD Negeri Unggulan Mongisidi 1",
    publisher: "UPT SPF SD Negeri Unggulan Mongisidi 1",
    icons: {
      icon: "/logo.svg",
    },
    metadataBase: new URL(siteUrl),
    openGraph: {
      title: "UPT SPF SD Negeri Unggulan Mongisidi 1",
      description: "Website resmi SD Negeri Unggulan Mongisidi 1 Makassar",
      url: siteUrl,
      siteName: "SD Negeri Unggulan Mongisidi 1",
      images: [
        {
          url: `${siteUrl}/og-default.png`,
          width: 1200,
          height: 630,
          alt: "SD Negeri Unggulan Mongisidi 1",
        },
      ],
      locale: "id_ID",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "UPT SPF SD Negeri Unggulan Mongisidi 1",
      description: "Website resmi SD Negeri Unggulan Mongisidi 1 Makassar",
      images: [`${siteUrl}/og-default.png`],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    verification: {
      google: "your-google-verification-code", // Ganti dengan kode verifikasi Google Search Console
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
      <head>
        <meta name="theme-color" content="#1e40af" />
        <meta name="msapplication-TileColor" content="#1e40af" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
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
