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
  Mail,
  Send,
  MessageCircle,
  Smartphone,
  CircleCheck,
  CircleX,
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
import { TwoFactorSettings } from "./two-factor-settings";
import { useAppStore } from "@/store/app";
import type { SiteSettingItem } from "@/lib/types";
import { PageLoader } from "../_shared";

type FormState = Omit<SiteSettingItem, "id" | "updatedAt">;

const EMPTY: FormState = {
  schoolName: "",
  npsn: "",
  logo: "",
  faviconUrl: "",
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
  spmbInfo: "",
  spmbLink: "",
};

export function SettingsManager() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testRecipient, setTestRecipient] = useState("");
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);
  const [waResult, setWaResult] = useState<string | null>(null);
  const [waError, setWaError] = useState<string | null>(null);
  const [waPhone, setWaPhone] = useState("");
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [tgResult, setTgResult] = useState<string | null>(null);
  const [tgError, setTgError] = useState<string | null>(null);
  const [tgChatId, setTgChatId] = useState("");
  const [healthStatus, setHealthStatus] = useState<{
    smtp: { configured: boolean; host: string; port: number; userPreview: string | null };
    whatsapp: { configured: boolean; hasAdminPhone: boolean };
    telegram: { configured: boolean };
    lastLogs: Record<string, { action: string; detail: string; at: string } | null>;
  } | null>(null);

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
          faviconUrl: data.faviconUrl ?? "",
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
          spmbInfo: data.spmbInfo ?? "",
          spmbLink: data.spmbLink ?? "",
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

  // Fetch notification health status (independent dari site-settings)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/notifications/health");
        if (!res.ok) return;
        const data = (await res.json()) as typeof healthStatus;
        if (alive) setHealthStatus(data);
      } catch (e) {
        console.error("[settings] Failed to load notification health:", e);
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
      // Force re-fetch settings so the public site picks up changes immediately.
      void useAppStore.getState().fetchSettings(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEmailTest() {
    setTestingEmail(true);
    setTestResult(null);
    setTestError(null);
    try {
      const res = await fetch("/api/notifications/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: testRecipient.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal mengirim email uji");
      }
      setTestResult(json.message);
      toast.success(json.message);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Gagal mengirim email uji";
      setTestError(msg);
      toast.error(msg);
    } finally {
      setTestingEmail(false);
    }
  }

  async function handleWhatsAppTest() {
    setTestingWhatsApp(true);
    setWaResult(null);
    setWaError(null);
    try {
      const res = await fetch("/api/notifications/test-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: waPhone.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal mengirim WhatsApp uji");
      }
      setWaResult(json.message);
      toast.success(json.message);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Gagal mengirim WhatsApp uji";
      setWaError(msg);
      toast.error(msg);
    } finally {
      setTestingWhatsApp(false);
    }
  }

  async function handleTelegramTest() {
    setTestingTelegram(true);
    setTgResult(null);
    setTgError(null);
    try {
      const res = await fetch("/api/notifications/test-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: tgChatId.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal mengirim Telegram uji");
      }
      setTgResult(json.message);
      toast.success(json.message);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Gagal mengirim Telegram uji";
      setTgError(msg);
      toast.error(msg);
    } finally {
      setTestingTelegram(false);
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
          <div className="space-y-4">
            <ImageUpload
              label="Logo"
              aspect="square"
              value={form.logo}
              onChange={(url) => set("logo", url)}
              helperText="Logo sekolah, rasio kotak."
            />
            <ImageUpload
              label="Favicon"
              aspect="square"
              value={form.faviconUrl}
              onChange={(url) => set("faviconUrl", url)}
              helperText="Ikon browser tab (favicon). Disarankan ukuran 32x32 atau 64x64 px."
            />
          </div>
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

      {/* SPMB */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="size-4 text-gold-foreground" /> Info SPMB
          </CardTitle>
          <CardDescription>
            Sistem Penerimaan Murid Baru (SPMB) — diseragamkan Dinas Pendidikan Kota Makassar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="s-spmb-link">Link Portal SPMB</Label>
            <Input
              id="s-spmb-link"
              type="url"
              value={form.spmbLink ?? ""}
              onChange={(e) => set("spmbLink", e.target.value)}
              placeholder="https://spmb.makassarkota.go.id"
            />
            <p className="text-xs text-muted-foreground">
              Tautan portal SPMB resmi Kota Makassar. Tombol “Daftar SPMB” di
              beranda dan halaman kontak akan mengarah ke link ini.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-spmb">Informasi SPMB</Label>
            <Textarea
              id="s-spmb"
              rows={5}
              value={form.spmbInfo}
              onChange={(e) => set("spmbInfo", e.target.value)}
              placeholder="Jadwal, syarat, jalur, dan tata cara SPMB…"
            />
          </div>
        </CardContent>
      </Card>

      {/* Indikator Kesehatan Notifikasi */}
      {healthStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleCheck className="size-4 text-gold-foreground" /> Kesehatan
              Notifikasi
            </CardTitle>
            <CardDescription>
              Status konfigurasi channel notifikasi dan aktivitas terakhir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* SMTP */}
              <div
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                  healthStatus.smtp.configured
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                }`}
              >
                {healthStatus.smtp.configured ? (
                  <CircleCheck className="size-3.5 shrink-0" />
                ) : (
                  <CircleX className="size-3.5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Email (SMTP)</p>
                  <p className="truncate text-[10px] opacity-70">
                    {healthStatus.smtp.configured
                      ? `${healthStatus.smtp.host}:${healthStatus.smtp.port}${healthStatus.smtp.userPreview ? ` · ${healthStatus.smtp.userPreview}` : ""}`
                      : "Belum dikonfigurasi"}
                  </p>
                  {healthStatus.lastLogs.email && (
                    <p className="truncate text-[10px] opacity-60">
                      Terakhir: {new Date(healthStatus.lastLogs.email.at).toLocaleString("id-ID", { timeZone: "Asia/Makassar" })}
                    </p>
                  )}
                </div>
              </div>
              {/* WhatsApp */}
              <div
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                  healthStatus.whatsapp.configured
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                }`}
              >
                {healthStatus.whatsapp.configured ? (
                  <CircleCheck className="size-3.5 shrink-0" />
                ) : (
                  <CircleX className="size-3.5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">WhatsApp (Fonnte)</p>
                  <p className="truncate text-[10px] opacity-70">
                    {healthStatus.whatsapp.configured
                      ? healthStatus.whatsapp.hasAdminPhone
                        ? "Terkonfigurasi"
                        : "Token OK · ADMIN_PHONE belum di-set"
                      : "Belum dikonfigurasi"}
                  </p>
                  {healthStatus.lastLogs.whatsapp && (
                    <p className="truncate text-[10px] opacity-60">
                      Terakhir: {new Date(healthStatus.lastLogs.whatsapp.at).toLocaleString("id-ID", { timeZone: "Asia/Makassar" })}
                    </p>
                  )}
                </div>
              </div>
              {/* Telegram */}
              <div
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                  healthStatus.telegram.configured
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                }`}
              >
                {healthStatus.telegram.configured ? (
                  <CircleCheck className="size-3.5 shrink-0" />
                ) : (
                  <CircleX className="size-3.5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Telegram Bot</p>
                  <p className="truncate text-[10px] opacity-70">
                    {healthStatus.telegram.configured
                      ? "Terkonfigurasi"
                      : "Belum dikonfigurasi"}
                  </p>
                  {healthStatus.lastLogs.telegram && (
                    <p className="truncate text-[10px] opacity-60">
                      Terakhir: {new Date(healthStatus.lastLogs.telegram.at).toLocaleString("id-ID", { timeZone: "Asia/Makassar" })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notifikasi WhatsApp — uji kirim Fonnte tanpa membuat pengaduan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="size-4 text-gold-foreground" /> Notifikasi
            WhatsApp
          </CardTitle>
          <CardDescription>
            Verifikasi konfigurasi Fonnte dengan mengirim WhatsApp uji — tidak
            perlu membuat pengaduan sungguhan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="s-test-wa-phone">Nomor HP Penerima (opsional)</Label>
            <Input
              id="s-test-wa-phone"
              type="tel"
              value={waPhone}
              onChange={(e) => setWaPhone(e.target.value)}
              placeholder="08xxxxxxxxxx atau 628xxxxxxxxxx"
            />
            <p className="text-xs text-muted-foreground">
              Jika dikosongkan, WhatsApp dikirim ke{}
              <code>ADMIN_PHONE</code>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleWhatsAppTest}
              disabled={testingWhatsApp}
            >
              {testingWhatsApp ? (
                <Loader2 className="mr-1 size-3 animate-spin" />
              ) : (
                <Send className="mr-1 size-3" />
              )}
              Uji Kirim WhatsApp
            </Button>
            {waResult && (
              <span className="text-xs font-medium text-emerald-600">
                {waResult}
              </span>
            )}
            {waError && (
              <span className="text-xs font-medium text-destructive">
                {waError}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notifikasi Telegram — uji kirim Bot API tanpa membuat pengaduan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="size-4 text-gold-foreground" /> Notifikasi
            Telegram
          </CardTitle>
          <CardDescription>
            Verifikasi konfigurasi Telegram Bot API dengan mengirim pesan uji —
            tidak perlu membuat pengaduan sungguhan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="s-test-tg-chat">Chat ID (opsional)</Label>
            <Input
              id="s-test-tg-chat"
              type="text"
              value={tgChatId}
              onChange={(e) => setTgChatId(e.target.value)}
              placeholder="-100xxxxxxxxxx atau 123456789"
            />
            <p className="text-xs text-muted-foreground">
              Jika dikosongkan, pesan dikirim ke{}
              <code>TELEGRAM_CHAT_ID</code>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTelegramTest}
              disabled={testingTelegram}
            >
              {testingTelegram ? (
                <Loader2 className="mr-1 size-3 animate-spin" />
              ) : (
                <Send className="mr-1 size-3" />
              )}
              Uji Kirim Telegram
            </Button>
            {tgResult && (
              <span className="text-xs font-medium text-emerald-600">
                {tgResult}
              </span>
            )}
            {tgError && (
              <span className="text-xs font-medium text-destructive">
                {tgError}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notifikasi Email — uji kirim SMTP tanpa membuat pengaduan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="size-4 text-gold-foreground" /> Notifikasi Email
          </CardTitle>
          <CardDescription>
            Verifikasi konfigurasi SMTP dengan mengirim email uji — tidak perlu
            membuat pengaduan sungguhan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Status konfigurasi SMTP */}
          {healthStatus && (
            <div
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                healthStatus.smtp.configured
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
              }`}
            >
              {healthStatus.smtp.configured ? (
                <CircleCheck className="size-3.5 shrink-0" />
              ) : (
                <CircleX className="size-3.5 shrink-0" />
              )}
              <span className="font-medium">
                {healthStatus.smtp.configured ? "Terkonfigurasi" : "Belum dikonfigurasi"}
              </span>
              <span className="text-muted-foreground">·</span>
              <span>
                <code>{healthStatus.smtp.host}</code>:{healthStatus.smtp.port}
              </span>
              {healthStatus.smtp.userPreview && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span>{healthStatus.smtp.userPreview}</span>
                </>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="s-test-recipient">Email Penerima (opsional)</Label>
            <Input
              id="s-test-recipient"
              type="email"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              placeholder="Kosongkan untuk memakai ADMIN_EMAIL"
            />
            <p className="text-xs text-muted-foreground">
              Jika dikosongkan, email dikirim ke{" "}
              <code>ADMIN_EMAIL</code> (fallback: email akun Anda).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEmailTest}
              disabled={testingEmail}
            >
              {testingEmail ? (
                <Loader2 className="mr-1 size-3 animate-spin" />
              ) : (
                <Send className="mr-1 size-3" />
              )}
              Uji Kirim Email
            </Button>
            {testResult && (
              <span className="text-xs font-medium text-emerald-600">
                {testResult}
              </span>
            )}
            {testError && (
              <span className="text-xs font-medium text-destructive">
                {testError}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2FA Settings — only visible to SUPER_ADMIN */}
      <TwoFactorSettings />

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
