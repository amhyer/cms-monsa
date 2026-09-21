"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  ShieldCheck,
  LogIn,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store/app";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Keamanan: kredensial akun TIDAK pernah di-hardcode di sini —
// string apa pun di komponen client ikut ter-bundle ke JavaScript publik.
// Lihat prisma/seed.ts untuk kredensial seed & docs untuk panduan ganti
// password setelah deploy.

export function LoginView() {
  const router = useRouter();
  const login = useAppStore((s) => s.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // NOTE: post-login redirect is handled by src/app/login/page.tsx
  // (router.push("/dashboard") when `user` becomes set).

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Email dan password wajib diisi.");
      return;
    }
    setSubmitting(true);
    const res = await login(email.trim(), password);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || "Login gagal.");
      toast.error(res.error || "Login gagal.");
      return;
    }
    toast.success("Selamat datang kembali!");
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 px-4 py-10 text-primary-foreground">
      {/* Subtle school crest watermark */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.06]"
      >
        <GraduationCap className="size-[min(80vw,560px)]" strokeWidth={1} />
      </div>

      <button
        type="button"
        onClick={() => router.push("/")}
        className="group absolute left-5 top-5 inline-flex items-center gap-2 text-sm font-medium text-primary-foreground/80 transition hover:text-primary-foreground"
      >
        <ArrowLeft className="size-4 transition group-hover:-translate-x-0.5" />
        Kembali ke Beranda
      </button>

      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex size-16 items-center justify-center rounded-2xl bg-gold text-gold-foreground shadow-lg">
            <GraduationCap className="size-9" />
          </div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight">
            SDN Unggulan Mongisidi 1
          </h1>
          <p className="mt-1 text-sm text-primary-foreground/70">
            Portal CMS Sekolah
          </p>
        </div>

        <Card className="border-0 shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Masuk ke Akun</CardTitle>
            <CardDescription>
              Gunakan kredensial operator atau administrator sekolah.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <ShieldCheck className="size-4" />
                  <AlertTitle>Login Gagal</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nama@mongisidi1.sch.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
                  >
                    {showPwd ? (
                      <>
                        <EyeOff className="size-3.5" /> Sembunyikan
                      </>
                    ) : (
                      <>
                        <Eye className="size-3.5" /> Tampilkan
                      </>
                    )}
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    className="pr-10"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gold text-gold-foreground hover:bg-gold/90"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Memproses…
                  </>
                ) : (
                  <>
                    <LogIn className="size-4" /> Masuk
                  </>
                )}
              </Button>
            </form>

          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} SD Negeri Unggulan Mongisidi 1 · Sistem
          Manajemen Konten Sekolah
        </p>
      </div>
    </div>
  );
}

export default LoginView;
