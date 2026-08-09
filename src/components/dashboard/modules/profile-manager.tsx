"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageUpload } from "@/components/shared/image-upload";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/store/app";
import { ExternalLink, KeyRound, Save, UserCircle2 } from "lucide-react";

type TeacherProfile = {
  id: string;
  name: string;
  position: string;
  subject: string | null;
  education: string | null;
  photo: string | null;
  phone: string | null;
  email: string | null;
  motto: string | null;
  riwayat: string | null;
  sertifikasi: string | null;
  prestasi: string | null;
  badges: string | null;
  homeroomClasses: { id: string; name: string; academicYear: string }[];
};

const EMPTY_TEACHER: TeacherProfile = {
  id: "",
  name: "",
  position: "",
  subject: null,
  education: null,
  photo: null,
  phone: null,
  email: null,
  motto: null,
  riwayat: null,
  sertifikasi: null,
  prestasi: null,
  badges: null,
  homeroomClasses: [],
};

export function ProfileManager() {
  const fetchMe = useAppStore((s) => s.fetchMe);

  const [loading, setLoading] = useState(true);
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [teacherMissing, setTeacherMissing] = useState(false);

  // Akun
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Profil guru
  const [form, setForm] = useState<TeacherProfile>(EMPTY_TEACHER);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [meRes, teaRes] = await Promise.all([
          fetch("/api/auth/profile", { cache: "no-store" }),
          fetch("/api/me/teacher", { cache: "no-store" }),
        ]);
        if (meRes.ok) {
          const me = await meRes.json();
          setName(me.name ?? "");
          setEmail(me.email ?? "");
        }
        if (teaRes.ok) {
          const t: TeacherProfile = await teaRes.json();
          setTeacher(t);
          setForm({ ...EMPTY_TEACHER, ...t });
        } else {
          setTeacherMissing(true);
        }
      } catch {
        toast.error("Gagal memuat profil.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveAccount = useCallback(async () => {
    if (!name.trim()) return toast.error("Nama tidak boleh kosong.");
    setSavingAccount(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Gagal menyimpan.");
      await fetchMe();
      toast.success("Data akun tersimpan.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingAccount(false);
    }
  }, [name, email, fetchMe]);

  const savePassword = useCallback(async () => {
    if (!currentPassword || !newPassword) {
      return toast.error("Password lama dan baru wajib diisi.");
    }
    if (newPassword.length < 8) {
      return toast.error("Password baru minimal 8 karakter.");
    }
    if (newPassword !== confirmPassword) {
      return toast.error("Konfirmasi password tidak cocok.");
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Gagal mengubah password.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password berhasil diubah.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingPassword(false);
    }
  }, [currentPassword, newPassword, confirmPassword]);

  const saveProfile = useCallback(async () => {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/me/teacher", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photo: form.photo,
          phone: form.phone,
          email: form.email,
          subject: form.subject,
          education: form.education,
          motto: form.motto,
          riwayat: form.riwayat,
          sertifikasi: form.sertifikasi,
          prestasi: form.prestasi,
          badges: form.badges,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Gagal menyimpan.");
      setTeacher(data);
      setForm({ ...EMPTY_TEACHER, ...data });
      toast.success("Profil tersimpan — langsung tampil di website.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingProfile(false);
    }
  }, [form]);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="account">
      <TabsList>
        <TabsTrigger value="account">
          <UserCircle2 className="size-4" /> Akun Login
        </TabsTrigger>
        {teacher && (
          <TabsTrigger value="teacher">
            Profil di Website ({teacher.position || "Guru"})
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="account" className="mt-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Data Akun</CardTitle>
            <CardDescription>
              Nama dan email yang digunakan untuk masuk ke CMS.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:max-w-md">
            <div className="grid gap-2">
              <Label htmlFor="p-name">Nama lengkap</Label>
              <Input
                id="p-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama lengkap"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-email">Email</Label>
              <Input
                id="p-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
              />
            </div>
            <div>
              <Button onClick={saveAccount} disabled={savingAccount}>
                <Save className="size-4" />
                {savingAccount ? "Menyimpan…" : "Simpan Data Akun"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ganti Password</CardTitle>
            <CardDescription>Minimal 8 karakter, wajib konfirmasi.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:max-w-md">
            <div className="grid gap-2">
              <Label htmlFor="p-cur">Password saat ini</Label>
              <Input
                id="p-cur"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-new">Password baru</Label>
              <Input
                id="p-new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-confirm">Ulangi password baru</Label>
              <Input
                id="p-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div>
              <Button
                variant="outline"
                onClick={savePassword}
                disabled={savingPassword}
              >
                <KeyRound className="size-4" />
                {savingPassword ? "Mengubah…" : "Ubah Password"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {teacher && (
        <TabsContent value="teacher" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              Wali kelas:{" "}
              {teacher.homeroomClasses
                .map((c) => `${c.name} (${c.academicYear})`)
                .join(", ") || "—"}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(`/academic/guru/${teacher.id}`, "_blank")}
            >
              <ExternalLink className="size-4" /> Lihat portofolio di website
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Foto Profil</CardTitle>
              <CardDescription>
                Ditampilkan di direktori guru & portofolio (akun berperan Guru).
              </CardDescription>
            </CardHeader>
            <CardContent className="sm:max-w-md">
              <ImageUpload
                label="Foto guru (opsional)"
                aspect="square"
                value={form.photo}
                onChange={(url) => setForm((f) => ({ ...f, photo: url }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informasi Publik</CardTitle>
              <CardDescription>
                Data ini tampil di halaman Akademik & portofolio guru website CMS Monsa.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Bidang / mapel</Label>
                <Input
                  value={form.subject ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="mis. Guru Kelas, Matematika"
                />
              </div>
              <div className="grid gap-2">
                <Label>Pendidikan terakhir</Label>
                <Input
                  value={form.education ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, education: e.target.value }))}
                  placeholder="mis. S1 PGSD"
                />
              </div>
              <div className="grid gap-2">
                <Label>Nomor HP / WhatsApp</Label>
                <Input
                  value={form.phone ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="08xxxxxxxxxx — aktifkan tombol WA"
                />
              </div>
              <div className="grid gap-2">
                <Label>Email kontak</Label>
                <Input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="nama@email.com"
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Motto</Label>
                <Input
                  value={form.motto ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, motto: e.target.value }))}
                  placeholder="Kutipan singkat (opsional)"
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Riwayat / bio singkat</Label>
                <Textarea
                  rows={4}
                  value={form.riwayat ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, riwayat: e.target.value }))}
                  placeholder="Riwayat pendidikan & pengalaman mengajar…"
                />
              </div>
              <div className="grid gap-2">
                <Label>Sertifikasi / diklat</Label>
                <Textarea
                  rows={3}
                  value={form.sertifikasi ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, sertifikasi: e.target.value }))}
                  placeholder="Sertifikat pendidik, diklat, dll."
                />
              </div>
              <div className="grid gap-2">
                <Label>Prestasi / penghargaan</Label>
                <Textarea
                  rows={3}
                  value={form.prestasi ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, prestasi: e.target.value }))}
                  placeholder="Penghargaan & prestasi mengajar"
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Badge (dipisah koma)</Label>
                <Input
                  value={form.badges ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, badges: e.target.value }))}
                  placeholder="mis. Sertifikasi, Guru Penggerak, Inklusi"
                />
              </div>
              <div className="sm:col-span-2">
                <Button onClick={saveProfile} disabled={savingProfile}>
                  <Save className="size-4" />
                  {savingProfile ? "Menyimpan…" : "Simpan Profil"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      )}

      {teacherMissing && !loading && (
        <p className="mt-4 text-sm text-muted-foreground">
          Akun Anda belum tertaut ke data guru. Hubungi operator untuk pemautan.
        </p>
      )}
    </Tabs>
  );
}
