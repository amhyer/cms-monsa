"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Mail,
  MailOpen,
  Trash2,
  Loader2,
  Phone,
  Mailbox,
  ChevronDown,
  Reply,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { relativeTime, formatDateTime } from "@/lib/format";
import type { ContactMessageItem } from "@/lib/types";
import { PageLoader, EmptyState } from "../_shared";

export function MessagesManager() {
  const [items, setItems] = useState<ContactMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/contact-messages", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      toast.error("Gagal memuat pesan masuk.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  async function toggleRead(m: ContactMessageItem) {
    setBusy(m.id);
    try {
      const res = await fetch(`/api/contact-messages/${m.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: !m.isRead }),
      });
      if (!res.ok) throw new Error();
      toast.success(
        m.isRead ? "Pesan ditandai belum dibaca." : "Pesan ditandai dibaca."
      );
      fetchList();
    } catch {
      toast.error("Gagal memperbarui status.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(m: ContactMessageItem) {
    setBusy(m.id);
    try {
      const res = await fetch(`/api/contact-messages/${m.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Pesan dihapus.");
      fetchList();
    } catch {
      toast.error("Gagal menghapus pesan.");
    } finally {
      setBusy(null);
    }
  }

  async function handleOpen(value: string) {
    if (!value) return;
    const m = items.find((x) => x.id === value);
    if (m && !m.isRead) {
      try {
        await fetch(`/api/contact-messages/${m.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isRead: true }),
        });
        fetchList();
      } catch {
        // ignore — UI still expands
      }
    }
  }

  const unreadCount = items.filter((m) => !m.isRead).length;
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function replyViaEmail(m: ContactMessageItem) {
    const subject = encodeURIComponent(`Re: ${m.subject}`);
    const body = encodeURIComponent(
      `\n\n---\nPesan asli dari ${m.name} (${m.email}) pada ${formatDateTime(
        m.createdAt
      )}):\n${m.message}`
    );
    window.location.href = `mailto:${m.email}?subject=${subject}&body=${body}`;
    toast.success("Membuka aplikasi email Anda…");
  }

  async function copyEmail(m: ContactMessageItem) {
    try {
      await navigator.clipboard.writeText(m.email);
      setCopiedId(m.id);
      toast.success("Email disalin ke clipboard.");
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error("Gagal menyalin email.");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Pesan Masuk</h2>
        <p className="text-sm text-muted-foreground">
          Pesan dari pengunjung melalui formulir kontak publik.
          {unreadCount > 0 && (
            <>
              {" "}
              <Badge className="bg-gold text-gold-foreground">
                {unreadCount} belum dibaca
              </Badge>
            </>
          )}
        </p>
      </div>

      <Card>
        <CardContent>
          {loading ? (
            <PageLoader />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="Tidak ada pesan"
              description="Pesan dari pengunjung akan muncul di sini."
            />
          ) : (
            <div className="max-h-[65vh] overflow-y-auto custom-scroll pr-1">
              <Accordion
                type="single"
                collapsible
                onValueChange={handleOpen}
                className="space-y-2"
              >
                {items.map((m) => (
                  <AccordionItem
                    key={m.id}
                    value={m.id}
                    className="rounded-md border bg-background px-3 data-[state=open]:bg-muted/30"
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex flex-1 items-center gap-3 pr-2 text-left">
                        {!m.isRead && (
                          <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full bg-gold"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p
                            className={`line-clamp-1 text-sm ${
                              m.isRead ? "font-medium" : "font-bold"
                            }`}
                          >
                            {m.subject}
                          </p>
                          <p className="line-clamp-1 text-xs text-muted-foreground">
                            {m.name} · {m.email} · {relativeTime(m.createdAt)}
                          </p>
                        </div>
                        <Badge
                          className={
                            m.isRead
                              ? "bg-muted text-muted-foreground"
                              : "bg-gold text-gold-foreground"
                          }
                        >
                          {m.isRead ? "Dibaca" : "Baru"}
                        </Badge>
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Mailbox className="size-3.5" /> {m.email}
                        </span>
                        {m.phone && (
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Phone className="size-3.5" /> {m.phone}
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          {formatDateTime(m.createdAt)}
                        </span>
                      </div>
                      <div className="rounded-md border bg-background p-3 text-sm whitespace-pre-wrap leading-relaxed">
                        {m.message}
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          className="bg-gold text-gold-foreground hover:bg-gold/90"
                          onClick={() => replyViaEmail(m)}
                        >
                          <Reply className="size-3.5" /> Balas via Email
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyEmail(m)}
                        >
                          {copiedId === m.id ? (
                            <>
                              <Check className="size-3.5" /> Tersalin
                            </>
                          ) : (
                            <>
                              <Copy className="size-3.5" /> Salin Email
                            </>
                          )}
                        </Button>
                        {m.phone && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a href={`tel:${m.phone}`}>
                              <Phone className="size-3.5" /> Telepon
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleRead(m)}
                          disabled={busy === m.id}
                        >
                          {m.isRead ? (
                            <>
                              <Mail className="size-3.5" /> Tandai Belum Dibaca
                            </>
                          ) : (
                            <>
                              <MailOpen className="size-3.5" /> Tandai Dibaca
                            </>
                          )}
                        </Button>
                        <ConfirmDialog
                          trigger={
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={busy === m.id}
                            >
                              <Trash2 className="size-3.5" /> Hapus
                            </Button>
                          }
                          title="Hapus Pesan"
                          description="Pesan akan dihapus permanen."
                          confirmText="Hapus"
                          onConfirm={() => handleDelete(m)}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default MessagesManager;
