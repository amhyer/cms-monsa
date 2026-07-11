import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SMA Negeri 1 Nusantara — Website Resmi Sekolah",
  description:
    "Website resmi SMA Negeri 1 Nusantara. Beranda, profil sekolah, berita, pengumuman, galeri, direktori guru, dan informasi PPDB.",
  keywords: [
    "SMA Negeri 1 Nusantara",
    "sekolah",
    "website sekolah",
    "PPDB",
    "berita sekolah",
    "CMS sekolah",
  ],
  authors: [{ name: "SMA Negeri 1 Nusantara" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "SMA Negeri 1 Nusantara",
    description: "Website resmi SMA Negeri 1 Nusantara",
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
        {children}
        <Toaster />
        <SonnerToaster richColors position="top-right" />
      </body>
    </html>
  );
}
