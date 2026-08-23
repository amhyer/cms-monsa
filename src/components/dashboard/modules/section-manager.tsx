"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  GripVertical,
  Plus,
  Trash2,
  Save,
  Eye,
  EyeOff,
  Pencil,
  X,
  Check,
} from "lucide-react";

type TeacherSection = {
  id: string;
  title: string;
  content: string;
  icon: string | null;
  order: number;
  isVisible: boolean;
};

const TEMPLATES = [
  { icon: "📚", title: "Pengalaman Mengajar", placeholder: "10 tahun mengajar kelas 1-3, fokus pada literasi dan numerasi dasar..." },
  { icon: "🏆", title: "Sertifikasi & Pelatihan", placeholder: "• Sertifikat Pendidik (2018)\n• Pelatihan Kurikulum Merdeka (2024)\n• Workshop Pembelajaran Diferensiasi..." },
  { icon: "🎯", title: "Target Tahun Ini", placeholder: "1. Meningkatkan literasi siswa 20%\n2. Mengadakan field trip 2x semester\n3. Melatih 5 siswa olimpiade sains..." },
  { icon: "📁", title: "Proyek & Kegiatan", placeholder: "• Pameran Sains Kelas 4 (Maret 2024)\n• Field Trip ke Museum (April 2024)\n• Lomba Cerdas Cermat..." },
  { icon: "📝", title: "Artikel & Catatan", placeholder: "Artikel tentang pembelajaran aktif di kelas rendah..." },
  { icon: "🎓", title: "Pendidikan Lanjutan", placeholder: "Sedang menempuh S2 Pendidikan Dasar di Universitas Negeri Makassar..." },
  { icon: "💡", title: "Tips untuk Siswa", placeholder: "1. Rajin membaca setiap hari\n2. Berani bertanya di kelas\n3. Selalu mengerjakan PR tepat waktu..." },
  { icon: "🌟", title: "Motivasi & Filosofi", placeholder: "Pembelajaran harus menyenangkan dan bermakna. Setiap anak punya potensi unik yang perlu dikembangkan..." },
];

export function SectionManager({ teacherId: propTeacherId }: { teacherId?: string }) {
  const user = useAppStore((s) => s.user);
  const [sections, setSections] = useState<TeacherSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSection, setNewSection] = useState({
    title: "",
    content: "",
    icon: "",
  });

  // Determine which teacherId to use
  const isOperator = user?.role === "SUPER_ADMIN" || user?.role === "OPERATOR";
  const activeTeacherId = propTeacherId || null;

  // Fetch sections
  useEffect(() => {
    (async () => {
      try {
        let url = "/api/me/teacher/sections";
        if (isOperator && activeTeacherId) {
          url += `?teacherId=${activeTeacherId}`;
        }
        const res = await fetch(url, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          setSections(data);
        }
      } catch {
        // Ignore error
      } finally {
        setLoading(false);
      }
    })();
  }, [isOperator, activeTeacherId]);

  // Add section from template
  const addFromTemplate = useCallback((template: (typeof TEMPLATES)[number]) => {
    setNewSection({
      title: template.title,
      content: "",
      icon: template.icon,
    });
    setShowAddForm(true);
  }, []);

  // Add custom section
  const addCustom = useCallback(() => {
    setNewSection({ title: "", content: "", icon: "📝" });
    setShowAddForm(true);
  }, []);

  // Save new section
  const saveNewSection = useCallback(async () => {
    if (!newSection.title.trim() || !newSection.content.trim()) {
      toast.error("Judul dan isi wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      const csrfRes = await fetch("/api/csrf-token");
      const { token: csrfToken } = await csrfRes.json();

      const payload: Record<string, unknown> = {
        title: newSection.title,
        content: newSection.content,
        icon: newSection.icon,
      };

      // Include teacherId for OPERATOR
      if (isOperator && activeTeacherId) {
        payload.teacherId = activeTeacherId;
      }

      const res = await fetch("/api/me/teacher/sections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error ?? "Gagal menyimpan.");
      }

      const section = await res.json();
      setSections((prev) => [...prev, section]);
      setShowAddForm(false);
      setNewSection({ title: "", content: "", icon: "" });
      toast.success("Bagian profil berhasil ditambahkan!");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [newSection, isOperator, activeTeacherId]);

  // Toggle visibility
  const toggleVisibility = useCallback(async (section: TeacherSection) => {
    const updated = sections.map((s) =>
      s.id === section.id ? { ...s, isVisible: !s.isVisible } : s
    );
    setSections(updated);

    try {
      const csrfRes = await fetch("/api/csrf-token");
      const { token: csrfToken } = await csrfRes.json();

      await fetch("/api/me/teacher/sections", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          sections: [
            {
              id: section.id,
              isVisible: !section.isVisible,
              order: section.order,
            },
          ],
        }),
      });
    } catch {
      // Revert on error
      setSections((prev) =>
        prev.map((s) =>
          s.id === section.id ? { ...s, isVisible: section.isVisible } : s
        )
      );
      toast.error("Gagal mengubah visibilitas.");
    }
  }, [sections]);

  // Delete section
  const deleteSection = useCallback(async (section: TeacherSection) => {
    if (!confirm(`Hapus bagian "${section.title}"?`)) return;

    try {
      const csrfRes = await fetch("/api/csrf-token");
      const { token: csrfToken } = await csrfRes.json();

      const res = await fetch(`/api/me/teacher/sections?id=${section.id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken },
      });

      if (!res.ok) throw new Error("Gagal menghapus.");

      setSections((prev) => prev.filter((s) => s.id !== section.id));
      toast.success("Bagian profil berhasil dihapus.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, []);

  // Move section up/down
  const moveSection = useCallback(
    async (section: TeacherSection, direction: "up" | "down") => {
      const idx = sections.findIndex((s) => s.id === section.id);
      if (idx < 0) return;
      if (direction === "up" && idx === 0) return;
      if (direction === "down" && idx === sections.length - 1) return;

      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      const newSections = [...sections];
      [newSections[idx], newSections[newIdx]] = [
        newSections[newIdx],
        newSections[idx],
      ];

      // Update orders
      const updated = newSections.map((s, i) => ({ ...s, order: i }));
      setSections(updated);

      try {
        const csrfRes = await fetch("/api/csrf-token");
        const { token: csrfToken } = await csrfRes.json();

        await fetch("/api/me/teacher/sections", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify({
            sections: updated.map((s) => ({
              id: s.id,
              order: s.order,
              isVisible: s.isVisible,
            })),
          }),
        });
      } catch {
        // Revert on error
        setSections(sections);
        toast.error("Gagal mengubah urutan.");
      }
    },
    [sections]
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Memuat bagian profil...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📋 Bagian Profil Saya
        </CardTitle>
        <CardDescription>
          Tambahkan bagian kustom untuk menampilkan informasi tambahan di profil
          website Anda. Guru lain tidak bisa mengubah bagian Anda.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing sections */}
        {sections.length > 0 && (
          <div className="space-y-2">
            {sections.map((section, idx) => (
              <div
                key={section.id}
                className="flex items-start gap-2 rounded-lg border p-3 bg-card"
              >
                <div className="flex flex-col gap-1 pt-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => moveSection(section, "up")}
                    disabled={idx === 0}
                  >
                    <GripVertical className="size-4" />
                  </Button>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{section.icon || "📝"}</span>
                    <span className="font-medium">{section.title}</span>
                    {!section.isVisible && (
                      <Badge variant="outline" className="text-xs">
                        <EyeOff className="size-3 mr-1" /> Tersembunyi
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {section.content}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => toggleVisibility(section)}
                    title={section.isVisible ? "Sembunyikan" : "Tampilkan"}
                  >
                    {section.isVisible ? (
                      <Eye className="size-4" />
                    ) : (
                      <EyeOff className="size-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteSection(section)}
                    title="Hapus"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add form */}
        {showAddForm && (
          <div className="rounded-lg border-2 border-dashed border-primary/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Tambah Bagian Baru</h4>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowAddForm(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="section-icon">Icon/Emoji</Label>
                <Input
                  id="section-icon"
                  value={newSection.icon}
                  onChange={(e) =>
                    setNewSection((s) => ({ ...s, icon: e.target.value }))
                  }
                  placeholder="📚"
                  className="w-20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="section-title">Judul *</Label>
                <Input
                  id="section-title"
                  value={newSection.title}
                  onChange={(e) =>
                    setNewSection((s) => ({ ...s, title: e.target.value }))
                  }
                  placeholder="Pengalaman Mengajar"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="section-content">Isi *</Label>
              <Textarea
                id="section-content"
                rows={4}
                value={newSection.content}
                onChange={(e) =>
                  setNewSection((s) => ({ ...s, content: e.target.value }))
                }
                placeholder="Tulis informasi yang ingin ditampilkan..."
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={saveNewSection} disabled={saving}>
                <Check className="size-4" />
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowAddForm(false)}
              >
                Batal
              </Button>
            </div>
          </div>
        )}

        {/* Template buttons */}
        {!showAddForm && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">
              Pilih template atau buat sendiri:
            </p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((template) => (
                <Button
                  key={template.title}
                  variant="outline"
                  size="sm"
                  onClick={() => addFromTemplate(template)}
                >
                  {template.icon} {template.title}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={addCustom}>
                <Plus className="size-4" /> Custom
              </Button>
            </div>
          </div>
        )}

        {sections.length === 0 && !showAddForm && (
          <p className="text-center text-sm text-muted-foreground py-4">
            Belum ada bagian profil. Klik template di atas untuk menambahkan.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
