"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  Bold,
  Italic,
  Underline,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/* ------------------------------------------------------------------ */
/* Simple rich text editor (contentEditable + execCommand)            */
/* ------------------------------------------------------------------ */

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  label?: string;
};

function exec(command: string, value?: string) {
  // focus ensures command applies to the editor, not the toolbar button
  document.execCommand(command, false, value);
}

export function RichTextEditor({ value, onChange, label = "Konten" }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Set initial HTML once on mount. Using `key` from the parent
  // (editing.id ?? "new") guarantees a fresh mount whenever the dialog
  // opens on a different item, so we never need to sync props -> DOM
  // after mount (which would reset the cursor).
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value) {
      el.innerHTML = value || "";
    }
    // intentionally run once on mount; the parent passes a `key` prop so a
    // fresh mount happens whenever the dialog opens on a different item,
    // which avoids the need to sync props -> DOM after mount (that would
    // reset the user's caret position).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount (see comment above)
  }, []);

  const handleInput = useCallback(() => {
    const el = ref.current;
    if (el) onChange(el.innerHTML);
  }, [onChange]);

  const runTool = useCallback(
    (action: "bold" | "italic" | "underline" | "h2" | "h3" | "p" | "ul" | "ol" | "link" | "image") => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      switch (action) {
        case "bold":
          exec("bold");
          break;
        case "italic":
          exec("italic");
          break;
        case "underline":
          exec("underline");
          break;
        case "h2":
          exec("formatBlock", "<h2>");
          break;
        case "h3":
          exec("formatBlock", "<h3>");
          break;
        case "p":
          exec("formatBlock", "<p>");
          break;
        case "ul":
          exec("insertUnorderedList");
          break;
        case "ol":
          exec("insertOrderedList");
          break;
        case "link": {
          const url = window.prompt("Masukkan URL tautan:", "https://");
          if (url) exec("createLink", url);
          break;
        }
        case "image": {
          const url = window.prompt("Masukkan URL gambar:", "https://");
          if (url) exec("insertImage", url);
          break;
        }
      }
      handleInput();
    },
    [handleInput]
  );

  const tools: { icon: LucideIcon; title: string; action: Parameters<typeof runTool>[0] }[] = [
    { icon: Bold, title: "Tebal", action: "bold" },
    { icon: Italic, title: "Miring", action: "italic" },
    { icon: Underline, title: "Garis Bawah", action: "underline" },
    { icon: Heading2, title: "Judul H2", action: "h2" },
    { icon: Heading3, title: "Sub Judul H3", action: "h3" },
    { icon: List, title: "Daftar Poin", action: "ul" },
    { icon: ListOrdered, title: "Daftar Nomor", action: "ol" },
    { icon: LinkIcon, title: "Sisipkan Tautan", action: "link" },
    { icon: ImageIcon, title: "Sisipkan Gambar (URL)", action: "image" },
  ];

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="overflow-hidden rounded-md border">
        <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-1.5">
          {tools.map((t) => {
            const Icon = t.icon;
            return (
              <Button
                key={t.action}
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                title={t.title}
                aria-label={t.title}
                onClick={() => runTool(t.action)}
                tabIndex={-1}
              >
                <Icon className="size-4" />
              </Button>
            );
          })}
          <span className="mx-1 h-5 w-px bg-border" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => runTool("p")}
            tabIndex={-1}
          >
            Paragraf
          </Button>
        </div>
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onBlur={handleInput}
          className="news-content min-h-[240px] max-h-[55vh] overflow-y-auto custom-scroll bg-background px-4 py-3 text-sm outline-none"
          role="textbox"
          aria-multiline="true"
          aria-label="Konten berita"
          data-placeholder="Tulis konten berita di sini…"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Editor sederhana berbasis contentEditable. Teks disimpan sebagai HTML.
      </p>
    </div>
  );
}
