"use client";

import {
  Loader2,
  BellRing,
  Send,
  MessageCircle,
  Smartphone,
  Mail,
  CircleCheck,
  CircleX,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import type { HealthStatus } from "./types";

export function WhatsAppTestCard({
  waPhone,
  setWaPhone,
  testingWhatsApp,
  waResult,
  waError,
  handleWhatsAppTest,
}: {
  waPhone: string;
  setWaPhone: (value: string) => void;
  testingWhatsApp: boolean;
  waResult: string | null;
  waError: string | null;
  handleWhatsAppTest: () => void;
}) {
  return (
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
  );
}

export function TelegramTestCard({
  tgChatId,
  setTgChatId,
  testingTelegram,
  tgResult,
  tgError,
  handleTelegramTest,
}: {
  tgChatId: string;
  setTgChatId: (value: string) => void;
  testingTelegram: boolean;
  tgResult: string | null;
  tgError: string | null;
  handleTelegramTest: () => void;
}) {
  return (
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
  );
}

export function AdminAlertCard({
  healthStatus,
  testingAlert,
  alertResult,
  alertError,
  handleAlertTest,
}: {
  healthStatus: HealthStatus | null;
  testingAlert: boolean;
  alertResult: string | null;
  alertError: string | null;
  handleAlertTest: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="size-4 text-gold-foreground" /> Alert Admin
          (cron)
        </CardTitle>
        <CardDescription>
          Uji jalur alert yang dipakai cron (mis. peringatan kuota storage):
          satu pesan ke semua kanal terkonfigurasi sekaligus, dengan routing
          env yang sama — bukan uji per-kanal seperti kartu di bawah.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAlertTest}
            disabled={testingAlert}
          >
            {testingAlert ? (
              <Loader2 className="mr-1 size-3 animate-spin" />
            ) : (
              <BellRing className="mr-1 size-3" />
            )}
            Uji Kirim Alert
          </Button>
          {alertResult && (
            <span className="text-xs font-medium text-emerald-600">
              {alertResult}
            </span>
          )}
          {alertError && (
            <span className="text-xs font-medium text-destructive">
              {alertError}
            </span>
          )}
        </div>

        {/* Hasil kirim alert terakhir dari CRON (StorageAlertState) —
            terpisah dari hasil uji manual di chip kedua di bawah. */}
        {healthStatus?.storageAlert && (
          <div
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
              healthStatus.storageAlert.lastSendAt === null
                ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                : (healthStatus.storageAlert.lastChannelsWhatsapp ||
                    healthStatus.storageAlert.lastChannelsTelegram)
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {healthStatus.storageAlert.lastSendAt === null ? (
              <Info className="size-3.5 shrink-0" />
            ) : (healthStatus.storageAlert.lastChannelsWhatsapp ||
              healthStatus.storageAlert.lastChannelsTelegram) ? (
              <CircleCheck className="size-3.5 shrink-0" />
            ) : (
              <CircleX className="size-3.5 shrink-0" />
            )}
            <span className="font-medium">Kirim cron terakhir:</span>
            <span>
              {healthStatus.storageAlert.lastSendAt === null
                ? "belum pernah berjalan (cron alert belum mengirim)"
                : `${formatDateTime(healthStatus.storageAlert.lastSendAt)} · WhatsApp ${
                    healthStatus.storageAlert.lastChannelsWhatsapp
                      ? "ok"
                      : "gagal/lewati"
                  }, Telegram ${
                    healthStatus.storageAlert.lastChannelsTelegram
                      ? "ok"
                      : "gagal/lewati"
                  }`}
            </span>
          </div>
        )}

        {/* Uji manual terakhir (StorageAlertState.lastTest*) — dari tombol
            Uji Kirim Alert di atas, terpisah dari kirim cron. */}
        {healthStatus?.storageAlert &&
          healthStatus.storageAlert.lastTestSendAt !== null && (
            <div
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                healthStatus.storageAlert.lastTestChannelsWhatsapp ||
                healthStatus.storageAlert.lastTestChannelsTelegram
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              {healthStatus.storageAlert.lastTestChannelsWhatsapp ||
              healthStatus.storageAlert.lastTestChannelsTelegram ? (
                <CircleCheck className="size-3.5 shrink-0" />
              ) : (
                <CircleX className="size-3.5 shrink-0" />
              )}
              <span className="font-medium">Uji manual terakhir:</span>
              <span>
                {`${formatDateTime(
                  healthStatus.storageAlert.lastTestSendAt
                )} · WhatsApp ${
                  healthStatus.storageAlert.lastTestChannelsWhatsapp
                    ? "ok"
                    : "gagal"
                }, Telegram ${
                  healthStatus.storageAlert.lastTestChannelsTelegram
                    ? "ok"
                    : "gagal"
                }`}
              </span>
            </div>
          )}
      </CardContent>
    </Card>
  );
}

export function EmailTestCard({
  healthStatus,
  testRecipient,
  setTestRecipient,
  testingEmail,
  testResult,
  testError,
  handleEmailTest,
}: {
  healthStatus: HealthStatus | null;
  testRecipient: string;
  setTestRecipient: (value: string) => void;
  testingEmail: boolean;
  testResult: string | null;
  testError: string | null;
  handleEmailTest: () => void;
}) {
  return (
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
  );
}
