"use client";

import { FileQuestion, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NotFound() {
  function handleGoHome() {
    window.location.href = "/";
  }

  function handleGoBack() {
    window.history.back();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="max-w-md text-center">
        <CardHeader className="items-center">
          <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FileQuestion className="size-7" />
          </div>
          <CardTitle className="text-xl">Halaman Tidak Ditemukan</CardTitle>
          <CardDescription>
            Maaf, halaman yang Anda cari tidak tersedia atau mungkin telah
            dipindahkan.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={handleGoBack} variant="outline">
            <ArrowLeft className="size-4" />
            Kembali
          </Button>
          <Button onClick={handleGoHome}>
            <Home className="size-4" />
            Ke Beranda
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
