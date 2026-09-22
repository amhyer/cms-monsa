"use client";

import { Download, Database, Users, GraduationCap, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DapodikData } from "./types";

function SummaryCard({ title, value, icon: Icon, loading, onPull }: {
  title: string; value: string; icon: React.ComponentType<{ className?: string }>; loading: boolean; onPull: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-lg font-semibold">{loading ? "..." : value}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onPull} disabled={loading}>
          <Download className="size-3" />
        </Button>
      </CardContent>
    </Card>
  );
}

export function DapodikSummaryCards({ data, loading, onFetch }: {
  data: DapodikData | null; loading: boolean; onFetch: (endpoint: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <SummaryCard title="Sekolah" value={data?.sekolah?.nama ?? "-"} icon={Building2} loading={loading} onPull={() => onFetch("sekolah")} />
      <SummaryCard title="Peserta Didik" value={data?.peserta_didik?.length?.toString() ?? "-"} icon={GraduationCap} loading={loading} onPull={() => onFetch("siswa")} />
      <SummaryCard title="GTK (Guru)" value={data?.gtk?.length?.toString() ?? "-"} icon={Users} loading={loading} onPull={() => onFetch("guru")} />
      <SummaryCard title="Rombel" value={data?.rombel?.length?.toString() ?? "-"} icon={Database} loading={loading} onPull={() => onFetch("rombel")} />
    </div>
  );
}
