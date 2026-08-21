"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";

/**
 * Opsi siswa dari /api/students (GET publik/proteksi — sudah dimuat parent).
 */
export type StudentOption = {
  id: string;
  name: string;
  className?: string | null;
  nis?: string | null;
};

/**
 * Typeahead siswa yang DIPAKAI BERSAMA oleh form Data Prestasi (Tambah/Edit
 * Prestasi) dan Manajemen Akun (pemilih siswa SISWA/ORANG_TUA) — perilaku
 * identik di kedua tempat:
 *   - ketik nama / kelas / NIS → daftar difilter (maks 8 hasil);
 *   - pilih lewat klik atau keyboard (ArrowUp/Down + Enter, Escape tutup);
 *   - tanpa kecocokan → teks bebas (prestasi tim / tidak tertaut siswa);
 *   - mengetik manual memutus tautan siswa (hanya pemilihan dari daftar yang
 *     mengisi id) — diputuskan PARENT lewat onQueryChange/onPick.
 *
 * Parent mengontrol `query` (agar bisa di-pre-fill saat edit) dan rendering
 * Label + hint di atas/bawah komponen ini.
 */
export function StudentTypeahead({
  id,
  students,
  query,
  onQueryChange,
  onPick,
  placeholder = "Ketik nama siswa / NIS…",
}: {
  id: string;
  students: StudentOption[];
  query: string;
  onQueryChange: (v: string) => void;
  onPick: (s: StudentOption) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const debouncedQuery = useDebounce(query, 200);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const all = q
      ? students.filter((s) =>
          `${s.name} ${s.className ?? ""} ${s.nis ?? ""}`
            .toLowerCase()
            .includes(q)
        )
      : students;
    return all.slice(0, 8);
  }, [students, query]);

  function pick(s: StudentOption) {
    onPick(s);
    setOpen(false);
    setHighlight(0);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (filtered.length ? (h + 1) % filtered.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) =>
        filtered.length ? (h - 1 + filtered.length) % filtered.length : 0
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const s = filtered[highlight];
      if (s) pick(s);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={`${id}-list`}
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Tidak ada siswa cocok — nama akan disimpan sebagai teks bebas.
            </p>
          ) : (
            <ul
              id={`${id}-list`}
              role="listbox"
              className="max-h-56 overflow-auto py-1"
            >
              {filtered.map((s, i) => (
                <li
                  key={s.id}
                  role="option"
                  aria-selected={i === highlight}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(s);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm ${
                    i === highlight ? "bg-accent text-accent-foreground" : ""
                  }`}
                >
                  <span className="truncate font-medium">{s.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {s.className}
                    {s.nis ? ` · ${s.nis}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
