"use client";

import { useState, useEffect } from "react";
import { FileText, Download, Search, Filter, Calendar, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Document {
  id: string;
  title: string;
  description: string | null;
  category: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  version: string | null;
  accessLevel: string;
  downloadCount: number;
  createdAt: string;
}

interface DocumentManagerProps {
  limit?: number;
  showSearch?: boolean;
}

const categoryConfig: Record<string, { color: string; bgColor: string }> = {
  "Administrasi": { color: "text-blue-600", bgColor: "bg-blue-100" },
  "Kurikulum": { color: "text-green-600", bgColor: "bg-green-100" },
  "Kesiswaan": { color: "text-purple-600", bgColor: "bg-purple-100" },
  "Keuangan": { color: "text-yellow-600", bgColor: "bg-yellow-100" },
  "Lainnya": { color: "text-gray-600", bgColor: "bg-gray-100" },
};

const fileTypeIcons: Record<string, string> = {
  pdf: "📄",
  docx: "📝",
  xlsx: "📊",
  pptx: "📑",
  jpg: "🖼️",
  png: "🖼️",
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function DocumentManager({ limit = 20, showSearch = true }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchDocuments();
  }, []);

  async function fetchDocuments() {
    try {
      const res = await fetch(`/api/documents?limit=${limit}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch {
      // Ignore error
    } finally {
      setLoading(false);
    }
  }

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      !search ||
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      doc.description?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || doc.category === filter;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="flex items-center gap-2 font-sans text-base font-bold">
        <FileText className="size-4 text-primary" /> Dokumen Sekolah
      </h2>

      {/* Search & Filter */}
      {showSearch && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari dokumen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="all">Semua Kategori</option>
            <option value="Administrasi">Administrasi</option>
            <option value="Kurikulum">Kurikulum</option>
            <option value="Kesiswaan">Kesiswaan</option>
            <option value="Keuangan">Keuangan</option>
            <option value="Lainnya">Lainnya</option>
          </select>
        </div>
      )}

      {/* Documents List */}
      <div className="mt-4 space-y-2">
        {filteredDocuments.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            Tidak ada dokumen ditemukan.
          </p>
        ) : (
          filteredDocuments.map((doc) => {
            const config = categoryConfig[doc.category] || categoryConfig["Lainnya"];
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-lg border bg-background p-3 transition-all hover:border-primary/50 hover:shadow-sm"
              >
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${config.bgColor}`}>
                  <span className="text-xl">{fileTypeIcons[doc.fileType] || "📄"}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate text-sm font-semibold">{doc.title}</h4>
                    {doc.version && (
                      <Badge variant="outline" className="text-[10px]">
                        v{doc.version}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                      {doc.category}
                    </Badge>
                    <span className="flex items-center gap-1">
                      <HardDrive className="size-3" />
                      {formatFileSize(doc.fileSize)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Download className="size-3" />
                      {doc.downloadCount}x
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      {new Date(doc.createdAt).toLocaleDateString("id-ID")}
                    </span>
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="shrink-0">
                  <Download className="size-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
