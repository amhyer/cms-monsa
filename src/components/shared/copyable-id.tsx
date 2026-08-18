import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Label + nilai identitas (NUPTK/NIP/NIK/NIS/NISN) yang bisa disalin dengan
 * sekali klik — memudahkan pengecekan silang Dapodik. Font monospace agar
 * deretan digit mudah dibaca; truncate agar muat di kartu yang sempit.
 */
export function CopyableId({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  /** Varian ringkas untuk kartu sempit (mis. marquee galeri siswa). */
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast.success(`${label} disalin ke clipboard.`);
        } catch {
          toast.error("Gagal menyalin ke clipboard.");
        }
      }}
      title={`Salin ${label}: ${value}`}
      aria-label={`Salin ${label}: ${value}`}
      className={cn(
        "block w-full truncate bg-transparent p-0 text-left font-mono transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "text-[10px] leading-4" : ""
      )}
    >
      {label}: {value}
    </button>
  );
}
