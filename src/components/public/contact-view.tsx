"use client";

import { useState, useId, type FormEvent } from "react";
import * as React from "react";
import {
  MapPin,
  Phone,
  Mail,
  Send,
  Loader2,
  Facebook,
  Instagram,
  Youtube,
  Music2,
  Clock,
  MapPinned,
  Globe,
  ShieldCheck,
  Award,
  Building2,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { useAppStore } from "@/store/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SectionHeading } from "@/components/shared/section-heading";
import { PageBanner, SectionShell } from "./_shared";
import { toast } from "sonner";

const SPMB_PATHS = [
  {
    icon: MapPinned,
    name: "Zonasi",
    quota: "50%",
    desc: "Berdasarkan jarak tempat tinggal terdekat dengan sekolah.",
  },
  {
    icon: ShieldCheck,
    name: "Afirmasi",
    quota: "15%",
    desc: "Khusus siswa dari keluarga ekonomi tidak mampu.",
  },
  {
    icon: Award,
    name: "Prestasi",
    quota: "30%",
    desc: "Berdasarkan prestasi akademik dan non-akademik siswa.",
  },
  {
    icon: Building2,
    name: "Perpindahan Tugas",
    quota: "5%",
    desc: "Untuk anak perpindahan tugas orang tua/aset negara.",
  },
];

export function ContactView() {
  const settings = useAppStore((s) => s.settings);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    // clear error for this field on edit
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Nama wajib diisi.";
    if (!form.email.trim()) next.email = "Email wajib diisi.";
    else if (!EMAIL_RE.test(form.email.trim()))
      next.email = "Format email tidak valid (contoh: nama@contoh.com).";
    if (!form.subject.trim()) next.subject = "Subjek wajib diisi.";
    if (!form.message.trim()) next.message = "Pesan wajib diisi.";
    else if (form.message.trim().length < 10)
      next.message = "Pesan terlalu singkat (minimal 10 karakter).";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) {
      toast.error("Mohon perbaiki isian yang belum sesuai.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Gagal mengirim pesan.");
      }
      toast.success("Pesan berhasil dikirim. Tim kami akan segera menghubungi Anda.");
      setForm({ name: "", email: "", phone: "", subject: "", message: "" });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Terjadi kesalahan tak terduga.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const socials = [
    { icon: Facebook, label: "Facebook", url: settings?.facebook },
    { icon: Instagram, label: "Instagram", url: settings?.instagram },
    { icon: Youtube, label: "YouTube", url: settings?.youtube },
    { icon: Music2, label: "TikTok", url: settings?.tiktok },
  ].filter((s) => s.url);

  return (
    <>
      <PageBanner
        eyebrow="Hubungi & SPMB"
        title="Hubungi Kami & SPMB"
        description="Sampaikan pertanyaan, saran, atau daftar SPMB 2025/2026 melalui informasi di bawah ini."
      />

      <SectionShell>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Form */}
          <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
            <SectionHeading
              eyebrow="Kirim Pesan"
              title="Formulir Kontak"
              description="Isi formulir berikut, tim kami akan menanggapi pesan Anda."
            />
            <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Nama Lengkap" required>
                  <Input
                    required
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Nama Anda"
                    autoComplete="name"
                  />
                </Field>
                <Field label="Email" required error={errors.email}>
                  <Input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    onBlur={() =>
                      form.email &&
                      !EMAIL_RE.test(form.email.trim()) &&
                      setErrors((e) => ({
                        ...e,
                        email: "Format email tidak valid (contoh: nama@contoh.com).",
                      }))
                    }
                    placeholder="email@contoh.com"
                    autoComplete="email"
                    aria-invalid={!!errors.email}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Telepon">
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    autoComplete="tel"
                  />
                </Field>
                <Field label="Subjek" required error={errors.subject}>
                  <Input
                    required
                    value={form.subject}
                    onChange={(e) => update("subject", e.target.value)}
                    placeholder="Subjek pesan"
                    aria-invalid={!!errors.subject}
                  />
                </Field>
              </div>
              <Field label="Pesan" required error={errors.message}>
                <Textarea
                  required
                  value={form.message}
                  onChange={(e) => update("message", e.target.value)}
                  placeholder="Tulis pesan Anda di sini…"
                  className="min-h-32"
                  aria-invalid={!!errors.message}
                />
              </Field>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-gold text-gold-foreground hover:bg-gold/90"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Mengirim…
                  </>
                ) : (
                  <>
                    <Send className="size-4" />
                    Kirim Pesan
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Contact info */}
          <div className="flex flex-col gap-6">
            <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
              <SectionHeading
                eyebrow="Informasi"
                title="Kontak Sekolah"
              />
              <ul className="mt-6 flex flex-col gap-4 text-sm">
                <InfoRow icon={MapPin} label="Alamat" value={settings?.address ?? "-"} />
                <InfoRow
                  icon={Phone}
                  label="Telepon"
                  value={settings?.phone ?? "-"}
                />
                <InfoRow
                  icon={Mail}
                  label="Email"
                  value={settings?.email ?? "-"}
                />
                <InfoRow
                  icon={Clock}
                  label="Jam Operasional"
                  value="Senin – Jumat, 07.00 – 16.00 WIB"
                />
              </ul>

              {socials.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Ikuti Kami
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {socials.map(({ icon: Icon, label, url }) => (
                      <a
                        key={label}
                        href={url as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={label}
                        className="flex size-10 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-foreground transition-colors hover:bg-gold hover:text-gold-foreground"
                      >
                        <Icon className="size-5" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {settings?.mapEmbed && (
              <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="relative aspect-video w-full">
                  <iframe
                    title="Lokasi sekolah"
                    src={settings.mapEmbed}
                    className="size-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </SectionShell>

      {/* SPMB section */}
      <section
        id="spmb"
        className="scroll-mt-20 bg-sidebar text-sidebar-foreground"
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold">
                <span className="h-px w-6 bg-gold" />
                SPMB 2025/2026
              </span>
              <h2 className="mt-3 font-sans text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
                Info SPMB 2025/2026
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-sidebar-foreground/80 sm:text-base">
                {settings?.spmbInfo}
              </p>
              <div className="mt-6 flex flex-col gap-3">
                {settings?.spmbLink ? (
                  <a
                    href={settings.spmbLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-gold px-6 text-sm font-medium text-gold-foreground shadow-sm transition-colors hover:bg-gold/90"
                  >
                    <Globe className="size-4" />
                    Daftar SPMB Online
                    <ExternalLink className="size-3.5 opacity-80" />
                  </a>
                ) : (
                  <span className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-sidebar-foreground/10 px-6 text-sm font-medium text-sidebar-foreground/60">
                    <Globe className="size-4" />
                    Link SPMB belum diatur
                  </span>
                )}
                <p className="text-xs text-sidebar-foreground/70">
                  *Pendaftaran dilakukan melalui portal SPMB resmi Kota Makassar
                  yang diseragamkan untuk seluruh sekolah.
                </p>
              </div>
            </div>

            <div className="lg:col-span-2">
              <h3 className="font-sans text-lg font-bold">
                Jalur & Kuota SPMB
              </h3>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {SPMB_PATHS.map((p) => {
                  const Icon = p.icon;
                  return (
                    <div
                      key={p.name}
                      className="flex flex-col gap-3 rounded-xl border border-sidebar-foreground/15 bg-sidebar-foreground/5 p-5 backdrop-blur transition-colors hover:bg-sidebar-foreground/10"
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex size-11 items-center justify-center rounded-lg bg-sidebar-foreground/10 text-gold ring-1 ring-gold/40">
                          <Icon className="size-5 text-gold" />
                        </span>
                        <span className="rounded-full bg-gold px-3 py-1 text-xs font-bold text-gold-foreground">
                          {p.quota}
                        </span>
                      </div>
                      <h4 className="font-sans text-base font-bold">
                        {p.name}
                      </h4>
                      <p className="text-xs leading-relaxed text-sidebar-foreground/75">
                        {p.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center gap-3 border-t border-sidebar-foreground/15 pt-8 text-center">
            <ArrowRight className="size-6 text-gold" />
            <p className="text-sm text-sidebar-foreground/80">
              Butuh bantuan? Hubungi kami melalui formulir di atas.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{ id?: string }>, { id })
        : children}
      {error && (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-foreground">
        <Icon className="size-4 text-gold" />
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-sm text-foreground">{value}</span>
      </div>
    </li>
  );
}
