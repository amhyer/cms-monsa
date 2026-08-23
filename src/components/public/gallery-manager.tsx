"use client";

import { useState, useEffect } from "react";
import { Image, Video, Eye, Heart, Download, ExternalLink, Grid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Album {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  category: string;
  photoCount: number;
  createdAt: string;
}

interface GalleryManagerProps {
  limit?: number;
  showGrid?: boolean;
}

const categoryConfig: Record<string, { color: string; bgColor: string }> = {
  "Kegiatan": { color: "text-blue-600", bgColor: "bg-blue-100" },
  "Prestasi": { color: "text-yellow-600", bgColor: "bg-yellow-100" },
  "Fasilitas": { color: "text-green-600", bgColor: "bg-green-100" },
  "Upacara": { color: "text-red-600", bgColor: "bg-red-100" },
  "Kelas": { color: "text-purple-600", bgColor: "bg-purple-100" },
  "Lainnya": { color: "text-gray-600", bgColor: "bg-gray-100" },
};

export function GalleryManager({ limit = 12, showGrid = true }: GalleryManagerProps) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  useEffect(() => {
    fetchAlbums();
  }, []);

  async function fetchAlbums() {
    try {
      const res = await fetch(`/api/albums?limit=${limit}`);
      if (res.ok) {
        const data = await res.json();
        setAlbums(data.albums || []);
      }
    } catch {
      // Ignore error
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-square rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-sans text-base font-bold">
          <Image className="size-4 text-primary" /> Galeri Foto
        </h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={viewMode === "grid" ? "default" : "outline"}
            onClick={() => setViewMode("grid")}
          >
            <Grid className="size-3" />
          </Button>
          <Button
            size="sm"
            variant={viewMode === "list" ? "default" : "outline"}
            onClick={() => setViewMode("list")}
          >
            <List className="size-3" />
          </Button>
        </div>
      </div>

      {/* Albums Grid */}
      <div className={`mt-4 ${viewMode === "grid" ? "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" : "space-y-3"}`}>
        {albums.length === 0 ? (
          <p className="col-span-full text-center text-sm text-muted-foreground">
            Belum ada album foto.
          </p>
        ) : (
          albums.map((album) => {
            const config = categoryConfig[album.category] || categoryConfig["Lainnya"];
            return (
              <div
                key={album.id}
                className={`overflow-hidden rounded-lg border bg-background transition-all hover:shadow-md ${
                  viewMode === "grid" ? "aspect-square" : "flex items-center gap-4 p-3"
                }`}
                onClick={() => setSelectedAlbum(album)}
              >
                {album.coverUrl ? (
                  <img
                    src={album.coverUrl}
                    alt={album.name}
                    className={`object-cover ${
                      viewMode === "grid" ? "size-full" : "size-16 shrink-0 rounded"
                    }`}
                  />
                ) : (
                  <div
                    className={`flex items-center justify-center ${config.bgColor} ${
                      viewMode === "grid" ? "size-full" : "size-16 shrink-0 rounded"
                    }`}
                  >
                    <Image className={`size-8 ${config.color}`} />
                  </div>
                )}
                <div className={viewMode === "grid" ? "p-3" : "flex-1"}>
                  <h4 className="text-sm font-semibold">{album.name}</h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">
                      {album.category}
                    </Badge>
                    <span>{album.photoCount} foto</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
