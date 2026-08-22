"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Landmark, FileText, Download, DownloadCloud } from "lucide-react";
import { PageBanner, SectionShell } from "./_shared";
import { ErrorState } from "@/components/shared/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCurrency,
  formatCompactCurrency,
  formatBytes,
} from "@/lib/format";
import { exportToCsv } from "@/lib/export";
import type { BosExpenditureItem, BosDocumentItem } from "@/lib/types";

const EXP_LIMIT = 20;
const DOC_LIMIT = 20;

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 pt-3">
      <p className="text-xs text-muted-foreground">
        Halaman {page} dari {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Sebelumnya
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Berikutnya
        </Button>
      </div>
    </div>
  );
}

export function TransparansiView() {
  const [items, setItems] = useState<BosExpenditureItem[] | null>(null);
  const [docs, setDocs] = useState<BosDocumentItem[] | null>(null);
  const [error, setError] = useState(false);
  const [year, setYear] = useState<string>("all");
  const [expPage, setExpPage] = useState(1);
  const [docPage, setDocPage] = useState(1);

  // Meta dari API (dihitung server-side untuk rentang tahun yang dipilih).
  const [expMeta, setExpMeta] = useState({
    total: 0,
    totalAmount: 0,
    bySource: [] as { source: string; total: number }[],
    years: [] as number[],
    totalPages: 1,
    // Ringkasan per tahun (jumlah item + total nominal) — dipakai dropdown
    // tahun agar pengunjung melihat total tiap tahun SEBELUM memilih, sama
    // seperti dropdown admin (yearStats API, SELALU lengkap — tidak
    // terpotong pagination/filter tahun).
    yearStats: [] as { year: number; count: number; docs: number; amount: number }[],
  });
  const [docMeta, setDocMeta] = useState({
    total: 0,
    years: [] as number[],
    totalPages: 1,
  });

  const load = useCallback(() => {
    let cancelled = false;
    setError(false);
    void (async () => {
      try {
        const expParams = new URLSearchParams({
          page: String(expPage),
          limit: String(EXP_LIMIT),
        });
        const docParams = new URLSearchParams({
          page: String(docPage),
          limit: String(DOC_LIMIT),
        });
        if (year !== "all") {
          expParams.set("year", year);
          docParams.set("year", year);
        }
        const [itemsRes, docsRes] = await Promise.all([
          fetch(`/api/bos-expenditures?${expParams}`, { cache: "no-store" }),
          fetch(`/api/bos-documents?${docParams}`, { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (!itemsRes.ok) throw new Error("fetch items failed");
        const itemsData = await itemsRes.json();
        const docsData = docsRes.ok ? await docsRes.json() : { items: [] };
        setItems(Array.isArray(itemsData?.items) ? itemsData.items : []);
        setDocs(Array.isArray(docsData?.items) ? docsData.items : []);
        setExpMeta({
          total: itemsData?.total ?? 0,
          totalAmount: itemsData?.totalAmount ?? 0,
          bySource: Array.isArray(itemsData?.bySource)
            ? itemsData.bySource
            : [],
          years: Array.isArray(itemsData?.years) ? itemsData.years : [],
          totalPages: itemsData?.totalPages ?? 1,
          yearStats: Array.isArray(itemsData?.yearStats)
            ? itemsData.yearStats
            : [],
        });
        setDocMeta({
          total: docsData?.total ?? 0,
          years: Array.isArray(docsData?.years) ? docsData.years : [],
          totalPages: docsData?.totalPages ?? 1,
        });
      } catch {
        if (!cancelled) {
          setItems([]);
          setDocs([]);
          setError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [year, expPage, docPage]);

  useEffect(() => load(), [load]);

  const years = useMemo(() => {
    const set = new Set<number>([...expMeta.years, ...docMeta.years]);
    return Array.from(set).sort((a, b) => b - a);
  }, [expMeta.years, docMeta.years]);

  function changeYear(v: string) {
    setYear(v);
    setExpPage(1);
    setDocPage(1);
  }

  // Ringkasan per tahun untuk label opsi dropdown (native <select> hanya
  // mendukung teks — ringkasan disisipkan ke label, bukan chip kaya seperti
  // dropdown admin). YearStats API kini memuat UNION tahun belanja + dokumen
  // (tahun yang cuma punya dokumen pun ikut, dengan count belanja 0).
  const yearSummary = useMemo(() => {
    const map = new Map<number, { count: number; docs: number; amount: number }>();
    for (const s of expMeta.yearStats) {
      map.set(s.year, { count: s.count, docs: s.docs, amount: s.amount });
    }
    return map;
  }, [expMeta.yearStats]);

  function yearOptionLabel(y: number): string {
    const s = yearSummary.get(y);
    if (!s) return String(y);
    return `${y} — ${s.count} item · ${s.docs} dokumen · ${formatCompactCurrency(s.amount)}`;
  }

  const hasAnyData =
    expMeta.years.length > 0 ||
    docMeta.years.length > 0 ||
    (items?.length ?? 0) > 0 ||
    (docs?.length ?? 0) > 0;

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
        ) : items === null || docs === null ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-muted-foreground">Memuat data anggaran…</p>
          </div>
        ) : !hasAnyData ? (
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
            {expMeta.years.length > 0 || (items?.length ?? 0) > 0 ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">
                      Belanja Dana BOS
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Sumber: ARKAS (Aplikasi Rencana Kegiatan dan Anggaran
                      Sekolah).
                    </p>
                  </div>
                  <select
                    value={year}
                    onChange={(e) => changeYear(e.target.value)}
                    aria-label="Filter tahun anggaran"
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="all">Semua Tahun</option>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {yearOptionLabel(y)}
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
                        {formatCurrency(expMeta.totalAmount)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="py-5">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Jumlah Item
                      </p>
                      <p className="mt-1 text-2xl font-bold tracking-tight">
                        {expMeta.total}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="py-5">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Sumber Dana
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {expMeta.bySource.length === 0 ? (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
                        ) : (
                          expMeta.bySource.map((b) => (
                            <Badge key={b.source} variant="secondary">
                              {b.source}: {formatCurrency(b.total)}
                            </Badge>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {items.length === 0 ? (
                  <p className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
                    Belum ada data belanja untuk tahun ini.
                  </p>
                ) : (
                  <>
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          exportToCsv(
                            `belanja-bos-${year === "all" ? "semua" : year}`,
                            items.map((i) => ({
                              Tahun: i.year,
                              "Sumber Dana": i.source,
                              Kategori: i.category,
                              Uraian: i.item,
                              Triwulan: i.quarter ? `TW ${i.quarter}` : "",
                              Nominal: i.amount,
                            })),
                            [
                              { key: "Tahun", label: "Tahun" },
                              { key: "Sumber Dana", label: "Sumber Dana" },
                              { key: "Kategori", label: "Kategori" },
                              { key: "Uraian", label: "Uraian Belanja" },
                              { key: "Triwulan", label: "Triwulan" },
                              { key: "Nominal", label: "Nominal" },
                            ]
                          );
                        }}
                        disabled={items.length === 0}
                      >
                        <DownloadCloud className="size-4" /> Export CSV
                      </Button>
                    </div>

                    {/* Desktop: Table view */}
                    <div className="hidden rounded-xl border bg-card md:block">
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
                            {items.map((i) => (
                              <TableRow key={i.id}>
                                <TableCell className="font-medium">
                                  {i.year}
                                </TableCell>
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
                              <TableCell colSpan={5} className="font-semibold">
                                Total
                              </TableCell>
                              <TableCell className="text-right font-bold">
                                {formatCurrency(expMeta.totalAmount)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    {/* Mobile: Card view */}
                    <div className="space-y-3 md:hidden">
                      {items.map((i) => (
                        <div
                          key={i.id}
                          className="rounded-xl border bg-card p-4"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-foreground">
                                {i.item}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                <Badge variant="outline" className="text-[10px]">
                                  {i.year}
                                </Badge>
                                <Badge variant="secondary" className="text-[10px]">
                                  {i.source}
                                </Badge>
                                {i.quarter && (
                                  <Badge variant="outline" className="text-[10px]">
                                    TW {i.quarter}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <p className="shrink-0 text-sm font-bold text-foreground">
                              {formatCurrency(i.amount)}
                            </p>
                          </div>
                          {i.category && (
                            <p className="mt-1.5 text-xs text-muted-foreground">
                              {i.category}
                            </p>
                          )}
                        </div>
                      ))}
                      <div className="rounded-xl border bg-muted/40 p-3 text-right">
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="text-lg font-bold">
                          {formatCurrency(expMeta.totalAmount)}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                <Pagination
                  page={expPage}
                  totalPages={expMeta.totalPages}
                  onPage={setExpPage}
                />
              </>
            ) : null}

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="size-5 text-primary" />
                <h2 className="text-xl font-bold tracking-tight">
                  Dokumen Pendukung (PDF)
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Output ARKAS dan bukti belanja dana BOS dapat diunduh langsung
                oleh masyarakat.
              </p>

              {docs.length === 0 ? (
                <p className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
                  Belum ada dokumen pendukung yang diunggah untuk tahun ini.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {docs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-start gap-3 rounded-xl border bg-card p-4"
                      >
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <FileText className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold">
                              {doc.title}
                            </p>
                            <Badge variant="secondary">{doc.year}</Badge>
                          </div>
                          {doc.description && (
                            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                              {doc.description}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {doc.fileName} · {formatBytes(doc.fileSize)}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          {/* Unduh via endpoint (Content-Disposition: attachment,
                              nama file asli) — bukan file statis yang dibuka
                              inline di tab baru. */}
                          <a href={`/api/bos-documents/${doc.id}`}>
                            <Download className="size-4" />
                            Unduh PDF
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Pagination
                    page={docPage}
                    totalPages={docMeta.totalPages}
                    onPage={setDocPage}
                  />
                </>
              )}
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
