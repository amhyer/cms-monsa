"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  function handleGoHome() {
    window.location.hash = "/dashboard";
    window.location.reload();
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="max-w-md text-center">
        <CardHeader className="items-center">
          <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-7" />
          </div>
          <CardTitle className="text-xl">Kesalahan Dashboard</CardTitle>
          <CardDescription>
            Modul dashboard mengalami kesalahan. Silakan coba lagi atau kembali
            ke ringkasan dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={reset} variant="outline">
            <RefreshCw className="size-4" />
            Coba Lagi
          </Button>
          <Button onClick={handleGoHome}>
            <Home className="size-4" />
            Kembali ke Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
