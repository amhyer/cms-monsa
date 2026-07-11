import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <SonnerToaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
