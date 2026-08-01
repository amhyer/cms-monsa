"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Lock,
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

const ADMIN_DEMO = {
  email: "admin@mongisidi1.sch.id",
  password: "admin123",
};

export function AdminLoginView() {
  const navigate = useAppStore((s) => s.navigate);
  const user = useAppStore((s) => s.user);
  const login = useAppStore((s) => s.login);
  const logout = useAppStore((s) => s.logout);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If a Super Admin is already logged in, go straight to dashboard.
  useEffect(() => {
    if (user?.role === "SUPER_ADMIN") navigate("/dashboard");
  }, [user, navigate]);

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
    // Role gate: this portal is for Super Admin only.
    const loggedIn = useAppStore.getState().user;
    if (loggedIn && loggedIn.role !== "SUPER_ADMIN") {
      toast.error("Portal ini khusus untuk Super Admin.");
      setError(
        "Akun Anda berperan sebagai Operator. Portal ini dikhususkan untuk Super Admin. Anda akan dialihkan ke login umum."
      );
      // sign out so the operator session isn't dangling on the admin portal
      await logout();
      setTimeout(() => navigate("/login"), 2200);
      return;
    }
    toast.success("Selamat datang, Administrator!");
    navigate("/dashboard");
  }

  function autofillAdmin() {
    setEmail(ADMIN_DEMO.email);
    setPassword(ADMIN_DEMO.password);
    setError(null);
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-primary via-primary to-background px-4 py-10 text-primary-foreground">
      {/* Subtle shield watermark */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.05]"
      >
        <ShieldCheck className="size-[min(80vw,560px)]" strokeWidth={1} />
      </div>

      <button
        type="button"
        onClick={() => navigate("/")}
        className="group absolute left-5 top-5 inline-flex items-center gap-2 text-sm font-medium text-primary-foreground/80 transition hover:text-primary-foreground"
      >
        <ArrowLeft className="size-4 transition group-hover:-translate-x-0.5" />
        Kembali ke Beranda
      </button>

      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex size-16 items-center justify-center rounded-2xl bg-gold text-gold-foreground shadow-lg ring-4 ring-gold/20">
            <ShieldCheck className="size-9" />
          </div>
          <span className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-gold/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gold">
            <Lock className="size-3" /> Portal Administrator
          </span>
          <h1 className="text-2xl font-bold leading-tight tracking-tight">
            Login Super Admin
          </h1>
          <p className="mt-1 text-sm text-primary-foreground/70">
            Khusus Kepala Sekolah & Administrator Sistem
          </p>
        </div>

        <Card className="border-0 shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck className="size-5 text-primary" />
              Akses Aman
            </CardTitle>
            <CardDescription>
              Portal ini hanya menerima akun Super Admin. Operator silakan
              menggunakan login umum.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <Lock className="size-4" />
                  <AlertTitle>Akses Ditolak</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="admin-email">Email Administrator</Label>
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@mongisidi1.sch.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="admin-password">Password</Label>
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
                    id="admin-password"
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
                    <Loader2 className="size-4 animate-spin" /> Memverifikasi…
                  </>
                ) : (
                  <>
                    <LogIn className="size-4" /> Masuk sebagai Admin
                  </>
                )}
              </Button>
            </form>

            <div className="mt-5 rounded-lg border border-gold/40 bg-gold/10 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gold-foreground">
                Akun Demo Super Admin
              </p>
              <div className="flex items-center justify-between gap-2 rounded-md bg-background/80 px-3 py-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <span className="text-sm font-semibold text-foreground">
                      Super Admin
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {ADMIN_DEMO.email} · {ADMIN_DEMO.password}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Akses penuh — pengaturan, operator, log aktivitas
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={autofillAdmin}
                  disabled={submitting}
                >
                  Isi Otomatis
                </Button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="mt-4 flex w-full items-center justify-center gap-1.5 text-center text-xs text-muted-foreground transition hover:text-foreground"
            >
              Login sebagai Operator?
              <ArrowRight className="size-3" /> Ke login umum
            </button>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} SD Negeri Unggulan Mongisidi 1 · Portal
          Administrator
        </p>
      </div>
    </div>
  );
}

export default AdminLoginView;
