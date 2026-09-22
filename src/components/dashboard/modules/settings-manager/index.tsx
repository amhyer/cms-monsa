"use client";

import { useCallback, useEffect, useState } from "react";
import { Save, Loader2, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/app";
import type { SiteSettingItem } from "@/lib/types";
import { PageLoader } from "../../_shared";
import { TwoFactorSettings } from "../two-factor-settings";
import { EMPTY, type FormState, type HealthStatus } from "./types";
import {
  SchoolIdentityCard,
  ContactCard,
  SocialMediaCard,
  PrincipalCard,
  VisionMissionCard,
  HistoryCard,
  StatisticsCard,
  SpmbCard,
} from "./school-profile-cards";
import { NotificationHealthCard } from "./notification-health-card";
import {
  WhatsAppTestCard,
  TelegramTestCard,
  AdminAlertCard,
  EmailTestCard,
} from "./notification-test-cards";

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
  const [testingAlert, setTestingAlert] = useState(false);
  const [alertResult, setAlertResult] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);

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

  // Fetch notification health status (independent dari site-settings).
  // Diekstrak ke callback agar bisa dipanggil ulang setelah uji kirim —
  // chip hasil kirim terakhir di kartu Alert Admin ikut ter-update.
  const loadHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/health");
      if (!res.ok) return;
      const data = (await res.json()) as HealthStatus;
      setHealthStatus(data);
    } catch {
      // health bersifat tambahan — kegagalan fetch diabaikan diam-diam.
    }
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

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

  // Uji jalur alert admin (notifyAdmin) — jalur persis yang dipakai cron
  // alert kuota storage: satu pesan ke SEMUA kanal terkonfigurasi sekaligus.
  async function handleAlertTest() {
    setTestingAlert(true);
    setAlertResult(null);
    setAlertError(null);
    try {
      const res = await fetch("/api/notifications/test-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal mengirim alert uji");
      }
      setAlertResult(json.message);
      toast.success(json.message);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Gagal mengirim alert uji";
      setAlertError(msg);
      toast.error(msg);
    } finally {
      setTestingAlert(false);
      // Refresh kesehatan — chip "hasil kirim terakhir" di kartu ini
      // mencerminkan attempt terbaru (test-alert tidak menulis ke
      // StorageAlertState; itu catatan kirim cron).
      void loadHealth();
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
      <SchoolIdentityCard form={form} set={set} />

      {/* Kontak */}
      <ContactCard form={form} set={set} />

      {/* Media Sosial */}
      <SocialMediaCard form={form} set={set} />

      {/* Kepala Sekolah */}
      <PrincipalCard form={form} set={set} />

      {/* Visi & Misi */}
      <VisionMissionCard form={form} set={set} />

      {/* Sejarah */}
      <HistoryCard form={form} set={set} />

      {/* Statistik */}
      <StatisticsCard form={form} set={set} />

      {/* SPMB */}
      <SpmbCard form={form} set={set} />

      {/* Indikator Kesehatan Notifikasi */}
      {healthStatus && (
        <NotificationHealthCard healthStatus={healthStatus} />
      )}

      {/* Notifikasi WhatsApp — uji kirim Fonnte tanpa membuat pengaduan */}
      <WhatsAppTestCard
        waPhone={waPhone}
        setWaPhone={setWaPhone}
        testingWhatsApp={testingWhatsApp}
        waResult={waResult}
        waError={waError}
        handleWhatsAppTest={handleWhatsAppTest}
      />

      {/* Notifikasi Telegram — uji kirim Bot API tanpa membuat pengaduan */}
      <TelegramTestCard
        tgChatId={tgChatId}
        setTgChatId={setTgChatId}
        testingTelegram={testingTelegram}
        tgResult={tgResult}
        tgError={tgError}
        handleTelegramTest={handleTelegramTest}
      />

      {/* Alert Admin — uji jalur cron alert (notifyAdmin) ke semua kanal */}
      <AdminAlertCard
        healthStatus={healthStatus}
        testingAlert={testingAlert}
        alertResult={alertResult}
        alertError={alertError}
        handleAlertTest={handleAlertTest}
      />

      {/* Notifikasi Email — uji kirim SMTP tanpa membuat pengaduan */}
      <EmailTestCard
        healthStatus={healthStatus}
        testRecipient={testRecipient}
        setTestRecipient={setTestRecipient}
        testingEmail={testingEmail}
        testResult={testResult}
        testError={testError}
        handleEmailTest={handleEmailTest}
      />

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
