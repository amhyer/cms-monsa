"use client";

import { useEffect, useState } from "react";
import {
  Save,
  Loader2,
  Settings as SettingsIcon,
  Building2,
  Phone,
  Share2,
  GraduationCap,
  Eye,
  BookOpen,
  BarChart3,
  Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ImageUpload } from "@/components/shared/image-upload";
import { useAppStore } from "@/store/app";
import type { SiteSettingItem } from "@/lib/types";
import { PageLoader } from "../_shared";

type FormState = Omit<SiteSettingItem, "id" | "updatedAt">;

const EMPTY: FormState = {
  schoolName: "",
  npsn: "",
  logo: "",
  address: "",
  phone: "",
  email: "",
  mapEmbed: "",
  vision: "",
  mission: "",
  history: "",
  principalName: "",
  principalPhoto: "",
  principalWelcome: "",
  facebook: "",
  instagram: "",
  youtube: "",
  tiktok: "",
  studentCount: 0,
  teacherCount: 0,
  facilityCount: 0,
  achievementCount: 0,
  ppdbInfo: "",
};

export function SettingsManager() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/site-settings", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as SiteSettingItem;
        if (!alive) return;
        setForm({
          schoolName: data.schoolName ?? "",
          npsn: data.npsn ?? "",
          logo: data.logo ?? "",
          address: data.address ?? "",
          phone: data.phone ?? "",
          email: data.email ?? "",
          mapEmbed: data.mapEmbed ?? "",
          vision: data.vision ?? "",
          mission: data.mission ?? "",
          history: data.history ?? "",
          principalName: data.principalName ?? "",
          principalPhoto: data.principalPhoto ?? "",
          principalWelcome: data.principalWelcome ?? "",
          facebook: data.facebook ?? "",
          instagram: data.instagram ?? "",
          youtube: data.youtube ?? "",
          tiktok: data.tiktok ?? "",
          studentCount: data.studentCount ?? 0,
          teacherCount: data.teacherCount ?? 0,
          facilityCount: data.facilityCount ?? 0,
          achievementCount: data.achievementCount ?? 0,
          ppdbInfo: data.ppdbInfo ?? "",
        });
      } catch {
        toast.error("Gagal memuat pengaturan.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error(
            "Akses ditolak. Hanya Super Admin yang dapat mengubah pengaturan."
          );
        }
        throw new Error(data.error || "Gagal menyimpan");
      }
      toast.success("Pengaturan berhasil disimpan.");
      // invalidate store cache so the public site picks up changes
      useAppStore.setState({ settings: null });
      void useAppStore.getState().fetchSettings();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageLoader label="Memuat pengaturan…" />;

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <SettingsIcon className="size-5 text-gold-foreground" />
          Pengaturan Sekolah
        </h2>
        <p className="text-sm text-muted-foreground">
          Perbarui informasi identitas, kontak, dan konten profil sekolah.
        </p>
      </div>

      {/* Identitas Sekolah */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4 text-gold-foreground" /> Identitas
            Sekolah
          </CardTitle>
          <CardDescription>Informasi dasar sekolah dan logo.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="s-school">Nama Sekolah</Label>
              <Input
                id="s-school"
                value={form.schoolName}
                onChange={(e) => set("schoolName", e.target.value)}
                placeholder="SD Negeri Unggulan Mongisidi 1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-npsn">NPSN</Label>
              <Input
                id="s-npsn"
                value={form.npsn}
                onChange={(e) => set("npsn", e.target.value)}
                placeholder="Nomor Pokok Sekolah Nasional"
              />
            </div>
          </div>
          <ImageUpload
            label="Logo"
            aspect="square"
            value={form.logo}
            onChange={(url) => set("logo", url)}
            helperText="Logo sekolah, rasio kotak."
          />
        </CardContent>
      </Card>

      {/* Kontak */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="size-4 text-gold-foreground" /> Kontak
          </CardTitle>
          <CardDescription>Alamat, kontak, dan peta lokasi.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="s-address">Alamat</Label>
            <Textarea
              id="s-address"
              rows={2}
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Jln. Wr. Monginsidi No.13, Maricaya Baru, Makassar"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="s-phone">Telepon</Label>
              <Input
                id="s-phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="(021) 1234567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-email">Email</Label>
              <Input
                id="s-email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="info@mongisidi1.sch.id"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-map">Embed Google Maps (URL src)</Label>
            <Textarea
              id="s-map"
              rows={2}
              value={form.mapEmbed ?? ""}
              onChange={(e) => set("mapEmbed", e.target.value)}
              placeholder="https://www.google.com/maps/embed?pb=…"
            />
            <p className="text-xs text-muted-foreground">
              Salin atribut <code>src</code> dari embed Google Maps.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Media Sosial */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Share2 className="size-4 text-gold-foreground" /> Media Sosial
          </CardTitle>
          <CardDescription>Tautan profil sosial sekolah.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(
            [
              ["facebook", "Facebook URL"],
              ["instagram", "Instagram URL"],
              ["youtube", "YouTube URL"],
              ["tiktok", "TikTok URL"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`s-${key}`}>{label}</Label>
              <Input
                id={`s-${key}`}
                value={(form[key] as string) ?? ""}
                onChange={(e) => set(key, e.target.value)}
                placeholder="https://…"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Kepala Sekolah */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="size-4 text-gold-foreground" /> Kepala
            Sekolah
          </CardTitle>
          <CardDescription>Profil dan sambutan kepala sekolah.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="s-principal">Nama Kepala Sekolah</Label>
              <Input
                id="s-principal"
                value={form.principalName}
                onChange={(e) => set("principalName", e.target.value)}
                placeholder="Drs. Budi Santoso, M.Pd."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-welcome">Sambutan Kepala Sekolah</Label>
              <Textarea
                id="s-welcome"
                rows={5}
                value={form.principalWelcome}
                onChange={(e) => set("principalWelcome", e.target.value)}
                placeholder="Tulis sambutan…"
              />
            </div>
          </div>
          <ImageUpload
            label="Foto Kepala Sekolah"
            aspect="square"
            value={form.principalPhoto}
            onChange={(url) => set("principalPhoto", url)}
          />
        </CardContent>
      </Card>

      {/* Visi & Misi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="size-4 text-gold-foreground" /> Visi & Misi
          </CardTitle>
          <CardDescription>Pernyataan visi dan misi sekolah.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="s-vision">Visi</Label>
            <Textarea
              id="s-vision"
              rows={4}
              value={form.vision}
              onChange={(e) => set("vision", e.target.value)}
              placeholder="Visi sekolah…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-mission">Misi</Label>
            <Textarea
              id="s-mission"
              rows={4}
              value={form.mission}
              onChange={(e) => set("mission", e.target.value)}
              placeholder="Misi sekolah…"
            />
          </div>
        </CardContent>
      </Card>

      {/* Sejarah */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="size-4 text-gold-foreground" /> Sejarah
          </CardTitle>
          <CardDescription>Riwayat berdirinya sekolah.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="s-history">Sejarah Sekolah</Label>
            <Textarea
              id="s-history"
              rows={6}
              value={form.history}
              onChange={(e) => set("history", e.target.value)}
              placeholder="Tulis sejarah sekolah…"
            />
          </div>
        </CardContent>
      </Card>

      {/* Statistik */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="size-4 text-gold-foreground" /> Statistik
          </CardTitle>
          <CardDescription>
            Angka-angka yang ditampilkan di beranda.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["studentCount", "Jumlah Siswa"],
              ["teacherCount", "Jumlah Guru"],
              ["facilityCount", "Jumlah Fasilitas"],
              ["achievementCount", "Jumlah Prestasi"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`s-${key}`}>{label}</Label>
              <Input
                id={`s-${key}`}
                type="number"
                min={0}
                value={form[key] as number}
                onChange={(e) => set(key, Number(e.target.value) || 0)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* PPDB */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="size-4 text-gold-foreground" /> Info PPDB
          </CardTitle>
          <CardDescription>
            Pengumuman Penerimaan Peserta Didik Baru.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="s-ppdb">Informasi PPDB</Label>
            <Textarea
              id="s-ppdb"
              rows={5}
              value={form.ppdbInfo}
              onChange={(e) => set("ppdbInfo", e.target.value)}
              placeholder="Jadwal, syarat, dan tata cara PPDB…"
            />
          </div>
        </CardContent>
      </Card>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Perubahan diterapkan ke seluruh situs setelah disimpan.
          </p>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Menyimpan…
              </>
            ) : (
              <>
                <Save className="size-4" /> Simpan Perubahan
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SettingsManager;
