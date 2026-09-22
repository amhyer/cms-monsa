"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { NEWS_CATEGORIES } from "@/lib/nav";

type NewsFiltersProps = {
  search: string;
  status: string;
  category: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
};

export function NewsFilters({
  search,
  status,
  category,
  onSearchChange,
  onStatusChange,
  onCategoryChange,
}: NewsFiltersProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <Input
        placeholder="Cari judul berita…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <Select
        value={status || "all"}
        onValueChange={(v) => {
          onStatusChange(v === "all" ? "" : v);
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua Status</SelectItem>
          <SelectItem value="PUBLISHED">Published</SelectItem>
          <SelectItem value="DRAFT">Draft</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={category || "all"}
        onValueChange={(v) => {
          onCategoryChange(v === "all" ? "" : v);
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Kategori" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua Kategori</SelectItem>
          {NEWS_CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
