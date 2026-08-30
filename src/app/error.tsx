"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("[GlobalError]", error);
    // Send error to Sentry for tracking
    Sentry.captureException(error);
  }, [error]);

  function handleGoHome() {
    router.push("/");
  }

  return (
    <html lang="id">
      <body>
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className="max-w-md text-center">
            <CardHeader className="items-center">
              <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="size-7" />
              </div>
              <CardTitle className="text-xl">Terjadi Kesalahan</CardTitle>
              <CardDescription>
                Aplikasi mengalami kesalahan yang tidak terduga. Silakan coba
                lagi atau muat ulang halaman.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button onClick={reset} variant="outline">
                <RefreshCw className="size-4" />
                Coba Lagi
              </Button>
              <Button onClick={handleGoHome}>
                <Home className="size-4" />
                Kembali ke Beranda
              </Button>
            </CardContent>
          </Card>
        </div>
      </body>
    </html>
  );
}
