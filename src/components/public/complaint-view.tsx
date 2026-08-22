"use client";

import { useState, useId, type FormEvent } from "react";
import {
  AlertTriangle,
  Send,
  Loader2,
  CheckCircle2,
  Shield,
  Phone,
  Mail,
  Lock,
} from "lucide-react";
import { useAppStore } from "@/store/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionHeading } from "@/components/shared/section-heading";
import { PageBanner, SectionShell } from "./_shared";
import { toast } from "sonner";

const ROLES = ["Orang Tua", "Siswa", "Masyarakat", "Alumni"];
const CATEGORIES = ["Akademik", "Fasilitas", "Tata Tertib", "Tenaga Pendidik", "Lainnya"];

export function ComplaintView() {
  const settings = useAppStore((s) => s.settings);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "Orang Tua",
    category: "Akademik",
    subject: "",
    message: "",
    priority: "NORMAL" as "NORMAL" | "TINGGI",
  });
  const id = useId();

  const update = (k: keyof typeof form, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!form.subject.trim() || !form.message.trim()) {
      toast.error("Subjek dan pesan wajib diisi.");
      return;
    }
    if (!isAnonymous && !form.email && !form.phone) {
      toast.error("Email atau telepon wajib diisi agar sekolah dapat menanggapi.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, isAnonymous }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim pengaduan.");
      setSubmitted(true);
      toast.success("Pengaduan berhasil dikirim. Sekolah akan menindaklanjuti sesegera mungkin.");
      setForm({ name: "", email: "", phone: "", role: "Orang Tua", category: "Akademik", subject: "", message: "", priority: "NORMAL" });
      setIsAnonymous(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim pengaduan.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <>
        <PageBanner
          eyebrow="Layanan Publik"
          title="Pengaduan"
          description="Sampaikan pengaduan, aspirasi, atau kritik membangun untuk sekolah kami."
        />
        <SectionShell>
          <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border bg-card p-8 text-center shadow-sm">
            <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="size-8" />
            </div>
            <h2 className="text-xl font-bold">Pengaduan Terkirim</h2>
            <p className="text-sm text-muted-foreground">
              Terima kasih atas pengaduan Anda. Tim sekolah akan meninjau dan
              menindaklanjuti sesegera mungkin. Jika Anda meninggalkan kontak,
              sekolah akan menghubungi Anda via email atau WhatsApp.
            </p>
            <Button onClick={() => setSubmitted(false)} className="mt-2">
              Kirim Pengaduan Lain
            </Button>
          </div>
        </SectionShell>
      </>
    );
  }

  return (
    <>
      <PageBanner
        eyebrow="Layanan Publik"
        title="Pengaduan & Aspirasi"
        description="Sampaikan pengaduan, kritik, atau saran membangun. Identitas Anda akan dijaga kerahasiaannya."
      />
      <SectionShell>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Form */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
              <SectionHeading
                eyebrow="Formulir Pengaduan"
                title="Sampaikan Pengaduan Anda"
                description="Isi formulir di bawah dengan lengkap. Semua pengaduan akan ditindaklanjuti."
              />
              <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
                {/* Anonymous toggle */}
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center gap-2">
                    <Lock className="size-4 text-muted-foreground" />
                    <div>
                      <Label className="cursor-pointer">Kirim sebagai Anonim</Label>
                      <p className="text-xs text-muted-foreground">Identitas tidak akan ditampilkan</p>
                    </div>
                  </div>
                  <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                </div>

                {!isAnonymous && (
                  <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Nama Lengkap" htmlFor={`${id}-name`}>
                        <Input id={`${id}-name`} value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Nama Anda" disabled={submitting} />
                      </Field>
                      <Field label="Status" htmlFor={`${id}-role`}>
                        <Select value={form.role} onValueChange={(v) => update("role", v)}>
                          <SelectTrigger id={`${id}-role`}><SelectValue /></SelectTrigger>
                          <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Email" htmlFor={`${id}-email`}>
                        <Input id={`${id}-email`} type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="email@contoh.com" disabled={submitting} />
                      </Field>
                      <Field label="WhatsApp / Telepon" htmlFor={`${id}-phone`}>
                        <Input id={`${id}-phone`} type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="08xxxxxxxxxx" disabled={submitting} />
                      </Field>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Kategori Pengaduan" htmlFor={`${id}-cat`}>
                    <Select value={form.category} onValueChange={(v) => update("category", v)}>
                      <SelectTrigger id={`${id}-cat`}><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Prioritas" htmlFor={`${id}-prio`}>
                    <Select value={form.priority} onValueChange={(v) => update("priority", v)}>
                      <SelectTrigger id={`${id}-prio`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NORMAL">Normal</SelectItem>
                        <SelectItem value="TINGGI">Tinggi / Mendesak</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <Field label="Subjek Pengaduan" htmlFor={`${id}-subj`} required>
                  <Input id={`${id}-subj`} value={form.subject} onChange={(e) => update("subject", e.target.value)} placeholder="Ringkasan pengaduan Anda" disabled={submitting} required />
                </Field>
                <Field label="Detail Pengaduan" htmlFor={`${id}-msg`} required>
                  <Textarea id={`${id}-msg`} rows={5} value={form.message} onChange={(e) => update("message", e.target.value)} placeholder="Jelaskan pengaduan Anda secara detail…" disabled={submitting} required />
                </Field>

                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                  <Shield className="size-4 shrink-0" />
                  <span>Pengaduan Anda akan diteruskan ke pihak sekolah dan ditangani secara rahasia. Penyalahgunaan sistem dapat dikenakan sanksi.</span>
                </div>

                <Button type="submit" disabled={submitting} className="w-full bg-gold text-gold-foreground hover:bg-gold/90">
                  {submitting ? (<><Loader2 className="size-4 animate-spin" /> Mengirim…</>) : (<><Send className="size-4" /> Kirim Pengaduan</>)}
                </Button>
              </form>
            </div>
          </div>

          {/* Info sidebar */}
          <div className="flex flex-col gap-6">
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <SectionHeading eyebrow="Informasi" title="Kontak Sekolah" />
              <ul className="mt-4 flex flex-col gap-3 text-sm">
                <li className="flex items-start gap-2"><Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span>{settings?.email ?? "-"}</span></li>
                <li className="flex items-start gap-2"><Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span>{settings?.phone ?? "-"}</span></li>
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                Atau hubungi langsung sekolah pada jam kerja (Senin–Jumat, 07.00–15.00 WITA).
              </p>
            </div>
            <div className="rounded-2xl border border-gold/30 bg-gold/5 p-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-gold-foreground" />
                <h3 className="font-bold">Pengaduan Mendesak?</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Untuk pengaduan yang membutuhkan penanganan segera, hubungi langsung
                sekolah via telepon atau WhatsApp. Tim sekolah siap membantu.
              </p>
            </div>
          </div>
        </div>
      </SectionShell>
    </>
  );
}

function Field({ label, htmlFor, required, error, children }: { label: string; htmlFor: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}{required && <span className="text-destructive">*</span>}</Label>
      {children}
      {error && <p className="text-xs font-medium text-destructive" role="alert">{error}</p>}
    </div>
  );
}

export default ComplaintView;
