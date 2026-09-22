"use client";

import { CircleCheck, CircleX } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { HealthStatus } from "./types";

export function NotificationHealthCard({
  healthStatus,
}: {
  healthStatus: HealthStatus;
}) {
  return (
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
  );
}
