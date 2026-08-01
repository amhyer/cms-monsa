"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Wallet,
  Loader2,
  Save,
  Pencil,
  Trash2,
  Printer,
  Download,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAppStore } from "@/store/app";
import type { PaymentItem, ClassItem } from "@/lib/types";
import { exportToCsv } from "@/lib/export";
import { formatCurrency } from "@/lib/format";
import { PageLoader, EmptyState } from "../_shared";

type UnpaidStudent = {
  id: string;
  nis: string;
  nisn: string | null;
  name: string;
  className: string;
};

type Summary = {
  totalStudents: number;
  paidCount: number;
  unpaidCount: number;
  totalAmount: number;
};

function currentMonthInput(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mm}`;
}

export function PaymentsManager() {
  const settings = useAppStore((s) => s.settings);

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classFilter, setClassFilter] = useState<string>("all");
  const [monthPeriod, setMonthPeriod] = useState<string>(currentMonthInput);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [paid, setPaid] = useState<PaymentItem[]>([]);
  const [unpaid, setUnpaid] = useState<UnpaidStudent[]>([]);
  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState<UnpaidStudent | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [payNote, setPayNote] = useState("");

  const [editing, setEditing] = useState<PaymentItem | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch("/api/classes?scope=admin", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setClasses(data.items || []);
    } catch {
      // non-critical
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ monthPeriod });
      if (classFilter !== "all") qs.set("classId", classFilter);
      const res = await fetch(`/api/payments?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSummary(data.summary || null);
      setPaid(data.paid || []);
      setUnpaid(data.unpaid || []);
    } catch {
      toast.error("Gagal memuat data pembayaran.");
    } finally {
      setLoading(false);
    }
  }, [monthPeriod, classFilter]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openPay(u: UnpaidStudent) {
    setPaying(u);
    setPayAmount("");
    setPayNote("");
    setPayDate(new Date().toISOString().slice(0, 10));
  }

  async function handlePay() {
    if (!paying) return;
    const amount = Number(payAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error("Masukkan nominal pembayaran yang valid.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: paying.id,
          amount,
          monthPeriod,
          paymentDate: payDate,
          note: payNote.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success(`Pembayaran ${paying.name} periode ${monthPeriod} tercatat.`);
      setPaying(null);
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan pembayaran.");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(p: PaymentItem) {
    setEditing(p);
    setEditAmount(String(p.amount));
    setEditNote(p.note ?? "");
  }

  async function handleEditSave() {
    if (!editing) return;
    const amount = Number(editAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error("Masukkan nominal yang valid.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/payments/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, note: editNote.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success("Data pembayaran diperbarui.");
      setEditing(null);
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: PaymentItem) {
    try {
      const res = await fetch(`/api/payments/${p.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");
      toast.success("Data pembayaran dihapus.");
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
    }
  }

  function printReceipt(p: PaymentItem) {
    const school = settings?.schoolName ?? "UPT SPF SD Negeri Unggulan Mongisidi 1";
    const address = settings?.address ?? "";
    const w = window.open("", "_blank", "width=420,height=600");
    if (!w) {
      toast.error("Popup diblokir. Izinkan popup untuk mencetak kuitansi.");
      return;
    }
    const d = new Date(p.paymentDate);
    const dateLabel = d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const monthLabel = monthLabelOf(p.monthPeriod);
    w.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>Kuitansi</title>
<style>
  body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
  h2 { text-align: center; margin: 4px 0; font-size: 16px; }
  .sub { text-align: center; font-size: 11px; color: #444; margin-bottom: 16px; }
  .title { text-align: center; font-weight: bold; font-size: 13px; margin: 12px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  td { padding: 4px 6px; vertical-align: top; }
  .line { border-top: 1px solid #999; margin: 12px 0; }
  .footer { font-size: 11px; color: #555; margin-top: 24px; }
</style></head><body>
<h2>${school}</h2>
<div class="sub">${address}</div>
<div class="title">KUITANSI PEMBAYARAN SPP</div>
<table>
  <tr><td>No. Kuitansi</td><td>: ${p.id.slice(0, 8).toUpperCase()}</td></tr>
  <tr><td>Nama Siswa</td><td>: ${p.studentName}</td></tr>
  <tr><td>NIS</td><td>: ${p.studentNis}</td></tr>
  <tr><td>Periode Bulan</td><td>: ${monthLabel}</td></tr>
  <tr><td>Tanggal Bayar</td><td>: ${dateLabel}</td></tr>
  <tr><td>Keterangan</td><td>: ${p.note ? escapeHtml(p.note) : "Pembayaran SPP"}</td></tr>
</table>
<div class="line"></div>
<table>
  <tr><td><b>Jumlah Dibayar</b></td><td style="text-align:right"><b>${formatCurrency(p.amount)}</b></td></tr>
</table>
<div class="line"></div>
<div class="footer">
  <p>Terima kasih. Kuitansi ini dicetak otomatis dari CMS Sekolah.</p>
  <p style="margin-top:48px">Bendahara / Petugas TU</p>
  <p style="margin-top:32px">(____________________)</p>
</div>
<script>window.onload = function () { window.focus(); window.print(); };</script>
</body></html>`);
    w.document.close();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Pembayaran (SPP)</h2>
          <p className="text-sm text-muted-foreground">
            Catat pembayaran dan lihat rekap siswa yang belum bayar per bulan.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            exportToCsv(
              `rekap-belum-bayar-${monthPeriod}`,
              unpaid,
              [
                { key: "nis", label: "NIS" },
                { key: "name", label: "Nama" },
                { key: "className", label: "Kelas" },
              ]
            );
            toast.success("Rekap siswa belum bayar diekspor ke CSV.");
          }}
          disabled={unpaid.length === 0}
        >
          <Download className="size-4" /> Export Belum Bayar
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="space-y-2">
            <Label htmlFor="pay-month">Periode Bulan</Label>
            <Input
              id="pay-month"
              type="month"
              value={monthPeriod}
              onChange={(e) => setMonthPeriod(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="space-y-2">
            <Label>Kelas</Label>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Semua kelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading && !summary ? (
        <PageLoader />
      ) : summary ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Total Siswa</p>
              <p className="mt-1 text-2xl font-bold">{summary.totalStudents}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-600" /> Sudah Bayar
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{summary.paidCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <AlertCircle className="size-3.5 text-rose-600" /> Belum Bayar
              </p>
              <p className="mt-1 text-2xl font-bold text-rose-600">{summary.unpaidCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Total Terkumpul</p>
              <p className="mt-1 text-2xl font-bold">{formatCurrency(summary.totalAmount)}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-base font-semibold">
          <AlertCircle className="size-4 text-rose-600" />
          Belum Bayar ({unpaid.length})
        </h3>
        {unpaid.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Semua siswa sudah bayar"
            description={`Semua siswa telah tercatat membayar periode ${monthLabelOf(monthPeriod)}.`}
          />
        ) : (
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">No</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>NIS</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unpaid.map((u, idx) => (
                    <TableRow key={u.id}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-muted-foreground">{u.nis}</TableCell>
                      <TableCell className="text-muted-foreground">{u.className}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openPay(u)}
                          className="h-7 gap-1 text-xs"
                        >
                          <Wallet className="size-3.5" /> Catat Bayar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-base font-semibold">
          <CheckCircle2 className="size-4 text-emerald-600" />
          Sudah Bayar ({paid.length})
        </h3>
        {paid.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Belum ada pembayaran"
            description="Catat pembayaran pertama untuk periode ini."
          />
        ) : (
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">No</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>NIS</TableHead>
                    <TableHead className="text-right">Nominal</TableHead>
                    <TableHead>Tanggal Bayar</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paid.map((p, idx) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{p.studentName}</TableCell>
                      <TableCell className="text-muted-foreground">{p.studentNis}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(p.amount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(p.paymentDate).toLocaleDateString("id-ID")}
                      </TableCell>
                      <TableCell className="max-w-40 truncate text-muted-foreground">
                        {p.note || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => printReceipt(p)}
                            aria-label="Cetak kuitansi"
                            title="Cetak kuitansi"
                          >
                            <Printer className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => openEdit(p)}
                            aria-label="Edit pembayaran"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <ConfirmDialog
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-destructive hover:text-destructive"
                                aria-label="Hapus pembayaran"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            }
                            title="Hapus Pembayaran"
                            description={`Hapus catatan pembayaran ${p.studentName} periode ${monthLabelOf(p.monthPeriod)}?`}
                            confirmText="Hapus"
                            onConfirm={() => handleDelete(p)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={paying !== null} onOpenChange={(v) => !v && setPaying(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Catat Pembayaran</DialogTitle>
            <DialogDescription>
              {paying ? `${paying.name} (NIS ${paying.nis}) — ${paying.className}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pay-amount">Nominal (Rp) *</Label>
              <Input
                id="pay-amount"
                type="number"
                inputMode="numeric"
                min={1}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Mis. 50000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-date">Tanggal Bayar</Label>
              <Input
                id="pay-date"
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-note">Catatan</Label>
              <Input
                id="pay-note"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="Mis. Bayar tunai / transfer (opsional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={handlePay} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Menyimpan…
                </>
              ) : (
                <>
                  <Save className="size-4" /> Simpan
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Pembayaran</DialogTitle>
            <DialogDescription>
              {editing ? `${editing.studentName} — ${monthLabelOf(editing.monthPeriod)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Nominal (Rp) *</Label>
              <Input
                id="edit-amount"
                type="number"
                inputMode="numeric"
                min={1}
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-note">Catatan</Label>
              <Input
                id="edit-note"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={handleEditSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Menyimpan…
                </>
              ) : (
                <>
                  <Save className="size-4" /> Simpan
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** "2026-07" → "Juli 2026" */
function monthLabelOf(period: string): string {
  const [y, m] = period.split("-");
  const names = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const idx = Number(m) - 1;
  return idx >= 0 && idx < 12 ? `${names[idx]} ${y}` : period;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default PaymentsManager;
