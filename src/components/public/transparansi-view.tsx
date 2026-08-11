"use client";

import { useEffect, useMemo, useState } from "react";
import { Landmark, FileText } from "lucide-react";
import { PageBanner, SectionShell } from "./_shared";
import { ErrorState } from "@/components/shared/error-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import type { BosExpenditureItem } from "@/lib/types";

export function TransparansiView() {
  const [items, setItems] = useState<BosExpenditureItem[] | null>(null);
  const [error, setError] = useState(false);
  const [year, setYear] = useState<string>("all");

  const load = () => {
    let cancelled = false;
    setError(false);
    (async () => {
      try {
        const res = await fetch("/api/bos-expenditures", { cache: "no-store" });
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        if (cancelled) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch {
        if (!cancelled) {
          setItems([]);
          setError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  };

  useEffect(() => load(), []);

  const years = useMemo(
    () => Array.from(new Set((items ?? []).map((i) => i.year))).sort((a, b) => b - a),
    [items]
  );

  const visible = useMemo(
    () =>
      year === "all"
        ? (items ?? [])
        : (items ?? []).filter((i) => i.year === Number(year)),
    [items, year]
  );

  const totalAmount = useMemo(
    () => visible.reduce((acc, i) => acc + i.amount, 0),
    [visible]
  );

  const bySource = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of visible) map.set(i.source, (map.get(i.source) ?? 0) + i.amount);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [visible]);

  return (
    <>
      <PageBanner
        eyebrow="Transparansi"
        title="Transparansi Anggaran Sekolah"
        description="Publikasi belanja dana Bantuan Operasional Sekolah (BOS) dan ARKAS — komitmen kami terhadap keterbukaan dan akuntabilitas penggunaan dana."
      />

      <SectionShell>
        {error ? (
          <ErrorState
            title="Gagal memuat data anggaran"
            description="Terjadi kesalahan saat memuat data. Periksa koneksi Anda lalu coba lagi."
            onRetry={load}
          />
        ) : items === null ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-muted-foreground">Memuat data anggaran…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-12 text-center">
            <Landmark className="size-10 text-muted-foreground" />
            <p className="font-semibold text-foreground">
              Data anggaran belum tersedia
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              Publikasi belanja dana BOS akan segera ditampilkan di halaman ini.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold tracking-tight">
                  Belanja Dana BOS
                </h2>
                <p className="text-sm text-muted-foreground">
                  Sumber: ARKAS (Aplikasi Rencana Kegiatan dan Anggaran Sekolah).
                </p>
              </div>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                aria-label="Filter tahun anggaran"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">Semua Tahun</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="py-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Total Belanja
                  </p>
                  <p className="mt-1 text-2xl font-bold tracking-tight">
                    {formatCurrency(totalAmount)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Jumlah Item
                  </p>
                  <p className="mt-1 text-2xl font-bold tracking-tight">
                    {visible.length}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Sumber Dana
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {bySource.map(([src, total]) => (
                      <Badge key={src} variant="secondary">
                        {src}: {formatCurrency(total)}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="rounded-xl border bg-card">
              <div className="table-scroll">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tahun</TableHead>
                      <TableHead>Sumber Dana</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Uraian Belanja</TableHead>
                      <TableHead className="text-center">Triwulan</TableHead>
                      <TableHead className="text-right">Nominal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">{i.year}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{i.source}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {i.category}
                        </TableCell>
                        <TableCell>{i.item}</TableCell>
                        <TableCell className="text-center">
                          {i.quarter ? `TW ${i.quarter}` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(i.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2">
                      <TableCell
                        colSpan={5}
                        className="font-semibold"
                      >
                        Total
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(totalAmount)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            <p className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
              <FileText className="mt-0.5 size-4 shrink-0" />
              <span>
                Data belanja ini bersumber dari ARKAS dan dapat berubah sesuai
                perencanaan sekolah. Untuk pertanyaan seputar anggaran, silakan
                hubungi kami melalui halaman Kontak.
              </span>
            </p>
          </div>
        )}
      </SectionShell>
    </>
  );
}
