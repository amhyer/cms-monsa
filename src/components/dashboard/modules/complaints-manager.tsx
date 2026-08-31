"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShieldAlert,
  Mail,
  Phone,
  MessageCircle,
  Send,
  Loader2,
  Trash2,
  ChevronDown,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { copyToClipboard } from "@/lib/clipboard";
import { formatDateTime, relativeTime } from "@/lib/format";
import { PageLoader, EmptyState } from "../_shared";
import { useSearch } from "../use-search";

type Complaint = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  category: string;
  subject: string;
  message: string;
  isAnonymous: boolean;
  status: string;
  priority: string;
  response: string | null;
  respondedAt: string | null;
  createdAt: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  BARU: { label: "Baru", color: "bg-blue-500 text-white", icon: AlertTriangle },
  DIPROSES: { label: "Diproses", color: "bg-amber-500 text-white", icon: Clock },
  SELESAI: { label: "Selesai", color: "bg-emerald-600 text-white", icon: CheckCircle2 },
  DITOLAK: { label: "Ditolak", color: "bg-muted text-muted-foreground", icon: XCircle },
};

const PRIORITAS_CONFIG: Record<string, string> = {
  TINGGI: "bg-red-500 text-white",
  NORMAL: "bg-muted text-muted-foreground",
  RENDAH: "bg-muted text-muted-foreground",
};

export function ComplaintsManager() {
  const [items, setItems] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [respondOpen, setRespondOpen] = useState<Complaint | null>(null);
  const [responseText, setResponseText] = useState("");
  const [savingResponse, setSavingResponse] = useState(false);
  const { search, setSearch, filtered } = useSearch(items, (c) =>
    `${c.subject} ${c.message} ${c.name} ${c.category} ${c.status}`.toLowerCase()
  );

  // Auto-expand accordion dari URL ?highlight=<id>
  const highlightId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("highlight");
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "50" });
      if (statusFilter !== "all") qs.set("status", statusFilter);
      const res = await fetch(`/api/complaints?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items || []);
    } catch (e) {
      console.error("[complaints] Failed to load complaints:", e);
      toast.error("Gagal memuat pengaduan.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchList(); }, [fetchList]);

  async function updateStatus(c: Complaint, status: string) {
    setBusy(c.id);
    try {
      const res = await fetch(`/api/complaints/${c.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Status diubah menjadi "${STATUS_CONFIG[status]?.label || status}".`);
      fetchList();
    } catch {
      toast.error("Gagal mengubah status.");
    } finally {
      setBusy(null);
    }
  }

  async function handleResponse() {
    if (!respondOpen) return;
    if (!responseText.trim()) {
      toast.error("Tanggapan tidak boleh kosong.");
      return;
    }
    setSavingResponse(true);
    try {
      const res = await fetch(`/api/complaints/${respondOpen.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: responseText, status: "DIPROSES" }),
      });
      if (!res.ok) throw new Error();
      toast.success("Tanggapan disimpan.");
      setRespondOpen(null);
      setResponseText("");
      fetchList();
    } catch {
      toast.error("Gagal menyimpan tanggapan.");
    } finally {
      setSavingResponse(false);
    }
  }

  async function handleDelete(c: Complaint) {
    setBusy(c.id);
    try {
      const res = await fetch(`/api/complaints/${c.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Pengaduan dihapus.");
      fetchList();
    } catch {
      toast.error("Gagal menghapus.");
    } finally {
      setBusy(null);
    }
  }

  function replyEmail(c: Complaint) {
    const subject = encodeURIComponent(`Re: Pengaduan — ${c.subject}`);
    const body = encodeURIComponent(
      `Yth. ${c.name},\n\nTerima kasih atas pengaduan Anda.\n\n${responseText || "(Tulis tanggapan di sini)"}\n\nHormat kami,\nSD Negeri Unggulan Mongisidi 1`
    );
    window.open(`mailto:${c.email}?subject=${subject}&body=${body}`, "_blank");
    toast.success("Membuka aplikasi email…");
  }

  function replyWhatsApp(c: Complaint) {
    const phone = c.phone.replace(/[^0-9]/g, "").replace(/^0/, "62");
    const msg = encodeURIComponent(
      `Halo ${c.name},\n\nTerkait pengaduan Anda: "${c.subject}"\n\n${responseText || "Pengaduan Anda sedang kami proses. Terima kasih."}\n\n— SD Negeri Unggulan Mongisidi 1`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
    toast.success("Membuka WhatsApp…");
  }

  function copyContact(c: Complaint) {
    copyToClipboard(`${c.name} | ${c.email} | ${c.phone}`);
  }

  const newCount = items.filter((c) => c.status === "BARU").length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <ShieldAlert className="size-5 text-gold-foreground" />
          Pengaduan
        </h2>
        <p className="text-sm text-muted-foreground">
          Kelola pengaduan dari orang tua, siswa, dan masyarakat.
          {newCount > 0 && (
            <>
              {" "}
              <Badge className="bg-blue-500 text-white">{newCount} baru</Badge>
            </>
          )}
        </p>
      </div>

      <Card>
        <CardContent>
          {/* Filter bar */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="BARU">Baru</SelectItem>
                <SelectItem value="DIPROSES">Diproses</SelectItem>
                <SelectItem value="SELESAI">Selesai</SelectItem>
                <SelectItem value="DITOLAK">Ditolak</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Search className="size-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari pengaduan…"
                className="h-9 w-48 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <span className="ml-auto text-xs text-muted-foreground">
              {filtered.length} dari {items.length} pengaduan
            </span>
          </div>

          {loading ? (
            <PageLoader />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ShieldAlert}
              title="Belum ada pengaduan"
              description="Pengaduan dari orang tua, siswa, dan masyarakat akan tampil di sini."
            />
          ) : (
            <div className="max-h-[65vh] space-y-2 overflow-y-auto custom-scroll">
              <Accordion type="single" collapsible defaultValue={highlightId ?? undefined} className="space-y-2">
                {filtered.map((c) => {
                  const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.BARU;
                  const SIcon = sc.icon;
                  return (
                    <AccordionItem
                      key={c.id}
                      value={c.id}
                      className="rounded-md border bg-background px-3 data-[state=open]:bg-muted/30"
                    >
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex flex-1 items-center gap-3 pr-2 text-left">
                          {c.status === "BARU" && (
                            <span aria-hidden className="size-2 shrink-0 rounded-full bg-blue-500" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className={`line-clamp-1 text-sm ${c.status === "BARU" ? "font-bold" : "font-medium"}`}>
                              {c.subject}
                            </p>
                            <p className="line-clamp-1 text-xs text-muted-foreground">
                              {c.isAnonymous ? "Anonim" : c.name} · {c.category} · {relativeTime(c.createdAt)}
                            </p>
                          </div>
                          <Badge className={PRIORITAS_CONFIG[c.priority] || "bg-muted"}>
                            {c.priority === "TINGGI" ? "Mendesak" : "Normal"}
                          </Badge>
                          <Badge className={sc.color}>
                            <SIcon className="mr-1 size-3" />
                            {sc.label}
                          </Badge>
                          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3">
                        {/* Detail */}
                        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-4">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <ShieldAlert className="size-3.5" /> {c.role}
                          </span>
                          {!c.isAnonymous && (
                            <>
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <Mail className="size-3.5" /> {c.email}
                              </span>
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <Phone className="size-3.5" /> {c.phone}
                              </span>
                            </>
                          )}
                          <span className="text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                        </div>

                        {/* Message */}
                        <div className="rounded-md border bg-background p-3 text-sm whitespace-pre-wrap leading-relaxed">
                          {c.message}
                        </div>

                        {/* Previous response */}
                        {c.response && (
                          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/20">
                            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="size-3.5" /> Tanggapan Sekolah
                            </p>
                            <p className="whitespace-pre-wrap text-foreground">{c.response}</p>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex flex-wrap justify-end gap-2">
                          {/* Quick status */}
                          <Select
                            value={c.status}
                            onValueChange={(v) => updateStatus(c, v)}
                          >
                            <SelectTrigger className="h-8 w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="BARU">Baru</SelectItem>
                              <SelectItem value="DIPROSES">Diproses</SelectItem>
                              <SelectItem value="SELESAI">Selesai</SelectItem>
                              <SelectItem value="DITOLAK">Ditolak</SelectItem>
                            </SelectContent>
                          </Select>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setRespondOpen(c);
                              setResponseText(c.response || "");
                            }}
                          >
                            <Send className="size-3.5" /> Tanggapi
                          </Button>

                          {!c.isAnonymous && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                                onClick={() => replyWhatsApp(c)}
                              >
                                <MessageCircle className="size-3.5" /> WhatsApp
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => replyEmail(c)}
                              >
                                <Mail className="size-3.5" /> Email
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyContact(c)}
                              >
                                Salin Kontak
                              </Button>
                            </>
                          )}

                          <ConfirmDialog
                            trigger={
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={busy === c.id}>
                                <Trash2 className="size-3.5" /> Hapus
                              </Button>
                            }
                            title="Hapus Pengaduan"
                            description={`Hapus "${c.subject}"? Tindakan ini tidak dapat dibatalkan.`}
                            confirmText="Hapus"
                            onConfirm={() => handleDelete(c)}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Response Dialog */}
      <Dialog open={!!respondOpen} onOpenChange={(v) => { if (!v) { setRespondOpen(null); setResponseText(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tanggapi Pengaduan</DialogTitle>
            <DialogDescription>
              Tulis tanggapan untuk: "{respondOpen?.subject}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">Pengaduan dari {respondOpen?.isAnonymous ? "Anonim" : respondOpen?.name}:</p>
              <p className="line-clamp-3 text-foreground">{respondOpen?.message}</p>
            </div>
            <Textarea
              rows={6}
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder="Tulis tanggapan Anda di sini…"
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-emerald-600"
                onClick={() => respondOpen && replyWhatsApp(respondOpen)}
                disabled={respondOpen?.isAnonymous}
              >
                <MessageCircle className="size-3.5" /> Kirim via WhatsApp
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => respondOpen && replyEmail(respondOpen)}
                disabled={respondOpen?.isAnonymous}
              >
                <Mail className="size-3.5" /> Kirim via Email
              </Button>
              <Button onClick={handleResponse} disabled={savingResponse}>
                {savingResponse ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Simpan & Tutup
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ComplaintsManager;
