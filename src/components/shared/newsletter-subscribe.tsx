"use client";

import { useState } from "react";
import { Mail, Send, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface NewsletterSubscribeProps {
  variant?: "default" | "inline" | "footer";
}

export function NewsletterSubscribe({ variant = "default" }: NewsletterSubscribeProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  async function handleSubscribe() {
    if (!email.trim()) {
      toast.error("Email wajib diisi!");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal berlangganan");

      toast.success(data.message || "Berlangganan berhasil!");
      setSubscribed(true);
      setEmail("");
      setName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal berlangganan");
    } finally {
      setSubmitting(false);
    }
  }

  if (subscribed) {
    return (
      <div className="flex items-center gap-2 text-emerald-600">
        <Check className="size-5" />
        <span className="text-sm font-medium">Terima kasih telah berlangganan!</span>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="email"
          placeholder="Email Anda"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="max-w-xs"
        />
        <Button onClick={handleSubscribe} disabled={submitting}>
          {submitting ? "..." : <Mail className="size-4" />}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2">
        <Mail className="size-5 text-primary" />
        <h3 className="font-sans text-base font-bold">Newsletter</h3>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Berlangganan untuk mendapatkan berita dan info terbaru dari sekolah.
      </p>
      <div className="mt-4 space-y-3">
        <Input
          type="text"
          placeholder="Nama (opsional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          type="email"
          placeholder="Email Anda *"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button onClick={handleSubscribe} disabled={submitting} className="w-full">
          {submitting ? (
            "Mengirim..."
          ) : (
            <>
              <Send className="mr-2 size-4" /> Berlangganan
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
