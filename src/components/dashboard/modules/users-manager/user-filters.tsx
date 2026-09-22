"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { accountCounter, type RoleFilter } from "@/lib/user-roles";
import { FILTERS, type UserCounts } from "./user-shared";

export function RoleFilterTabs({
  value,
  onValueChange,
  counts,
}: {
  value: RoleFilter;
  onValueChange: (v: RoleFilter) => void;
  counts: UserCounts;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onValueChange(v as RoleFilter)}
    >
      <TabsList className="flex-wrap h-auto">
        {FILTERS.map((f) => (
          <TabsTrigger key={f.value} value={f.value}>
            {f.label} ({counts[f.value]})
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export function UserSearchBar({
  search,
  onSearchChange,
  total,
  roleFilter,
  counts,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  total: number;
  roleFilter: RoleFilter;
  counts: UserCounts;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Search className="size-4 text-muted-foreground" />
      <Input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Cari nama, email, atau siswa…"
        className="max-w-xs"
      />
      <span className="ml-auto text-xs text-muted-foreground">
        {accountCounter(total, counts[roleFilter], search.trim() !== "")}
      </span>
    </div>
  );
}
