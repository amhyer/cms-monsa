"use client";

import { RefreshCw, Database, Users, GraduationCap, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "../../_shared";
import type { DapodikData } from "./types";

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value || "-"}</span>
    </div>
  );
}

export function DapodikDataTabs({ data, loading, onFetch }: {
  data: DapodikData | null; loading: boolean; onFetch: (endpoint: string) => void;
}) {
  return (
    <Tabs defaultValue="siswa">
      <TabsList>
        <TabsTrigger value="siswa">Peserta Didik</TabsTrigger>
        <TabsTrigger value="guru">GTK / Guru</TabsTrigger>
        <TabsTrigger value="rombel">Rombongan Belajar</TabsTrigger>
        <TabsTrigger value="sekolah">Data Sekolah</TabsTrigger>
      </TabsList>

      <TabsContent value="siswa">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Peserta Didik</CardTitle>
            <Button variant="outline" size="sm" onClick={() => onFetch("siswa")} disabled={loading}>
              <RefreshCw className={`mr-1 size-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {!data?.peserta_didik?.length ? (
              <EmptyState title="Belum ada data" description='Klik "Tarik Data" untuk mengambil data dari Dapodik.' icon={GraduationCap} />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead rowSpan={2}>No</TableHead>
                      <TableHead rowSpan={2}>Nama</TableHead>
                      <TableHead rowSpan={2}>NIPD</TableHead>
                      <TableHead rowSpan={2}>JK</TableHead>
                      <TableHead rowSpan={2}>NISN</TableHead>
                      <TableHead rowSpan={2}>Tempat, Tanggal Lahir</TableHead>
                      <TableHead rowSpan={2}>NIK</TableHead>
                      <TableHead rowSpan={2}>Alamat</TableHead>
                      <TableHead rowSpan={2}>HP</TableHead>
                      <TableHead rowSpan={2}>E-Mail</TableHead>
                      <TableHead colSpan={2}>Data Ayah</TableHead>
                      <TableHead colSpan={2}>Data Ibu</TableHead>
                      <TableHead colSpan={2}>Data Wali</TableHead>
                      <TableHead rowSpan={2}>Rombel Saat Ini</TableHead>
                      <TableHead rowSpan={2}>Sekolah Asal</TableHead>
                      <TableHead rowSpan={2}>Anak Ke-</TableHead>
                      <TableHead rowSpan={2}>BB</TableHead>
                      <TableHead rowSpan={2}>TB</TableHead>
                      <TableHead rowSpan={2}>Kebutuhan Khusus</TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Pekerjaan</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Pekerjaan</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Pekerjaan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.peserta_didik.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium whitespace-nowrap">{s.nama ?? "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{s.nipd ?? "-"}</TableCell>
                        <TableCell>
                          <Badge variant={s.jenis_kelamin === "L" ? "default" : "secondary"}>
                            {s.jenis_kelamin === "L" ? "L" : s.jenis_kelamin === "P" ? "P" : s.jenis_kelamin ?? "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{s.nisn ?? "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {[s.tempat_lahir, s.tanggal_lahir].filter(Boolean).join(", ") || "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{s.nik ?? "-"}</TableCell>
                        <TableCell className="max-w-[220px] truncate">{s.alamat_jalan ?? "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {s.nomor_telepon_seluler || s.nomor_telepon_rumah || "-"}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate">{s.email ?? "-"}</TableCell>
                        <TableCell>{s.nama_ayah ?? "-"}</TableCell>
                        <TableCell>{s.pekerjaan_ayah_id_str ?? "-"}</TableCell>
                        <TableCell>{s.nama_ibu ?? "-"}</TableCell>
                        <TableCell>{s.pekerjaan_ibu_id_str ?? "-"}</TableCell>
                        <TableCell>{s.nama_wali ?? "-"}</TableCell>
                        <TableCell>{s.pekerjaan_wali_id_str ?? "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{s.nama_rombel ?? "-"}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{s.sekolah_asal ?? "-"}</TableCell>
                        <TableCell>{s.anak_keberapa ?? "-"}</TableCell>
                        <TableCell>{s.berat_badan ?? "-"}</TableCell>
                        <TableCell>{s.tinggi_badan ?? "-"}</TableCell>
                        <TableCell>{s.kebutuhan_khusus ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="guru">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">GTK / Guru</CardTitle>
            <Button variant="outline" size="sm" onClick={() => onFetch("guru")} disabled={loading}>
              <RefreshCw className={`mr-1 size-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {!data?.gtk?.length ? (
              <EmptyState title="Belum ada data" description='Klik "Tarik Data" untuk mengambil data dari Dapodik.' icon={Users} />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>NUPTK</TableHead>
                      <TableHead>JK</TableHead>
                      <TableHead>Tempat, Tanggal Lahir</TableHead>
                      <TableHead>NIP</TableHead>
                      <TableHead>Status Kepegawaian</TableHead>
                      <TableHead>Jenis PTK</TableHead>
                      <TableHead>Agama</TableHead>
                      <TableHead>Tugas / Jabatan</TableHead>
                      <TableHead>Pangkat Golongan</TableHead>
                      <TableHead>Pendidikan Terakhir</TableHead>
                      <TableHead>Bidang Studi</TableHead>
                      <TableHead>NIK</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.gtk.map((g, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium whitespace-nowrap">{g.nama ?? "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{g.nuptk ?? "-"}</TableCell>
                        <TableCell>
                          <Badge variant={g.jenis_kelamin === "L" ? "default" : "secondary"}>
                            {g.jenis_kelamin === "L" ? "L" : g.jenis_kelamin === "P" ? "P" : g.jenis_kelamin ?? "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {[g.tempat_lahir, g.tanggal_lahir].filter(Boolean).join(", ") || "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{g.nip ?? "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{g.status_kepegawaian_id_str ?? "-"}</TableCell>
                        <TableCell>{g.jenis_ptk_id_str ?? "-"}</TableCell>
                        <TableCell>{g.agama_id_str ?? "-"}</TableCell>
                        <TableCell>{g.jabatan_ptk_id_str ?? "-"}</TableCell>
                        <TableCell>{g.pangkat_golongan_terakhir ?? "-"}</TableCell>
                        <TableCell>{g.pendidikan_terakhir ?? "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{g.bidang_studi_terakhir ?? "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{g.nik ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="rombel">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Rombongan Belajar</CardTitle>
            <Button variant="outline" size="sm" onClick={() => onFetch("rombel")} disabled={loading}>
              <RefreshCw className={`mr-1 size-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {!data?.rombel?.length ? (
              <EmptyState title="Belum ada data" description='Klik "Tarik Data" untuk mengambil data dari Dapodik.' icon={Database} />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Rombel</TableHead>
                      <TableHead>Tingkat</TableHead>
                      <TableHead>Wali Kelas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rombel.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{r.nama ?? "-"}</TableCell>
                        <TableCell>{r.tingkat_pendidikan_id_str ?? "-"}</TableCell>
                        <TableCell>{r.ptk_id_str ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="sekolah">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data Sekolah</CardTitle>
          </CardHeader>
          <CardContent>
            {!data?.sekolah ? (
              <EmptyState title="Belum ada data" description='Klik "Tarik Data" untuk mengambil data dari Dapodik.' icon={Building2} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <InfoRow label="Nama" value={data.sekolah.nama} />
                <InfoRow label="NPSN" value={data.sekolah.npsn} />
                <InfoRow label="Alamat" value={data.sekolah.alamat_jalan || data.sekolah.alamat} />
                <InfoRow label="Provinsi" value={data.sekolah.provinsi} />
                <InfoRow label="Kabupaten" value={data.sekolah.kabupaten_kota || data.sekolah.kabupaten} />
                <InfoRow label="Kecamatan" value={data.sekolah.kecamatan} />
                <InfoRow label="Kelurahan" value={data.sekolah.desa_kelurahan || data.sekolah.kelurahan} />
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
