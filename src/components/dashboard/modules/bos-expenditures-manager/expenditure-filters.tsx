"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatCompactCurrency } from "@/lib/format";
import type { YearStat } from "./form-state";

type ExpenditureFiltersProps = {
  yearFilter: string;
  onYearFilterChange: (value: string) => void;
  yearStats: YearStat[];
  years: number[];
  total: number;
  totalAmount: number;
  onCreate: () => void;
};

export function ExpenditureFilters({
  yearFilter,
  onYearFilterChange,
  yearStats,
  years,
  total,
  totalAmount,
  onCreate,
}: ExpenditureFiltersProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={yearFilter} onValueChange={onYearFilterChange}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Semua Tahun" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Tahun</SelectItem>
            {yearStats.length > 0
              ? yearStats.map((s) => (
                  <SelectItem
                    key={s.year}
                    value={String(s.year)}
                    meta={
                      <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                        {s.count} item · {s.docs} dokumen ·{" "}
                        {formatCompactCurrency(s.amount)}
                      </span>
                    }
                  >
                    {s.year}
                  </SelectItem>
                ))
              : years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="text-sm">
          {total} item · Total {formatCurrency(totalAmount)}
        </Badge>
      </div>
      <Button onClick={onCreate}>
        <Plus className="size-4" />
        Tambah Belanja
      </Button>
    </div>
  );
}
