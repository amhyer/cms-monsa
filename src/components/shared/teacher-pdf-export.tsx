"use client";

import { Printer, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TeacherItem } from "@/lib/types";

interface TeacherPDFExportProps {
  teacher: TeacherItem;
  compact?: boolean;
}

/**
 * Generate printable HTML for teacher profile
 */
function generatePrintHTML(teacher: TeacherItem): string {
  const schoolName = "SD Negeri Unggulan Mongisidi 1";
  
  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Profil ${teacher.name} - ${schoolName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1e40af; padding-bottom: 20px; }
    .school-name { font-size: 18px; font-weight: bold; color: #1e40af; }
    .subtitle { font-size: 12px; color: #666; margin-top: 5px; }
    .profile-section { display: flex; gap: 30px; margin-bottom: 30px; }
    .photo { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 3px solid #d4af37; }
    .photo-placeholder { width: 120px; height: 120px; border-radius: 50%; background: #f3f4f6; display: flex; align-items: center; justify-content: center; font-size: 40px; color: #9ca3af; border: 3px solid #d4af37; }
    .info { flex: 1; }
    .name { font-size: 24px; font-weight: bold; color: #1e3a8a; margin-bottom: 5px; }
    .position { font-size: 14px; color: #d4af37; font-weight: 600; margin-bottom: 10px; }
    .motto { font-style: italic; color: #666; margin-bottom: 15px; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 14px; font-weight: bold; color: #1e3a8a; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin-bottom: 10px; }
    .info-grid { display: grid; grid-template-columns: 150px 1fr; gap: 8px; font-size: 12px; }
    .label { color: #6b7280; }
    .value { color: #1f2937; font-weight: 500; }
    .bio { font-size: 12px; line-height: 1.6; color: #4b5563; white-space: pre-line; }
    .achievements { font-size: 12px; line-height: 1.6; color: #4b5563; white-space: pre-line; }
    .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 15px; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="school-name">${schoolName}</div>
    <div class="subtitle">Profil Guru & Tenaga Kependidikan</div>
  </div>
  
  <div class="profile-section">
    ${teacher.photo 
      ? `<img src="${teacher.photo}" alt="${teacher.name}" class="photo" />`
      : `<div class="photo-placeholder">👤</div>`
    }
    <div class="info">
      <div class="name">${teacher.name}</div>
      <div class="position">${teacher.position}</div>
      ${teacher.motto ? `<div class="motto">"${teacher.motto}"</div>` : ''}
      ${teacher.education ? `<div class="value">${teacher.education}</div>` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Data Diri</div>
    <div class="info-grid">
      ${teacher.gender ? `<span class="label">Jenis Kelamin</span><span class="value">${teacher.gender === 'LAKI_LAKI' ? 'Laki-laki' : 'Perempuan'}</span>` : ''}
      ${teacher.tempatLahir || teacher.tanggalLahir ? `<span class="label">Tempat, Tgl Lahir</span><span class="value">${[teacher.tempatLahir, teacher.tanggalLahir ? new Date(teacher.tanggalLahir).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : ''].filter(Boolean).join(', ')}</span>` : ''}
      ${teacher.agama ? `<span class="label">Agama</span><span class="value">${teacher.agama}</span>` : ''}
      ${teacher.statusKepegawaian ? `<span class="label">Status Kepegawaian</span><span class="value">${teacher.statusKepegawaian}</span>` : ''}
      ${teacher.pangkatGolongan ? `<span class="label">Pangkat / Golongan</span><span class="value">${teacher.pangkatGolongan}</span>` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Mengajar</div>
    <div class="info-grid">
      ${teacher.subject ? `<span class="label">Mata Pelajaran</span><span class="value">${teacher.subject}</span>` : ''}
      ${teacher.bidangStudi ? `<span class="label">Bidang Studi</span><span class="value">${teacher.bidangStudi}</span>` : ''}
      ${teacher.jenisPtk ? `<span class="label">Jenis PTK</span><span class="value">${teacher.jenisPtk}</span>` : ''}
      ${teacher.homeroomClasses && teacher.homeroomClasses.length > 0 ? `<span class="label">Wali Kelas</span><span class="value">${teacher.homeroomClasses.map(c => c.name).join(', ')}</span>` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Pendidikan & Sertifikasi</div>
    <div class="info-grid">
      ${teacher.education ? `<span class="label">Pendidikan Terakhir</span><span class="value">${teacher.education}</span>` : ''}
      ${teacher.sertifikasi ? `<span class="label">Sertifikasi / Diklat</span><span class="value">${teacher.sertifikasi}</span>` : ''}
    </div>
  </div>

  ${teacher.riwayat ? `
  <div class="section">
    <div class="section-title">Riwayat Singkat</div>
    <div class="bio">${teacher.riwayat}</div>
  </div>
  ` : ''}

  ${teacher.prestasi ? `
  <div class="section">
    <div class="section-title">Prestasi & Penghargaan</div>
    <div class="achievements">${teacher.prestasi}</div>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">Kontak</div>
    <div class="info-grid">
      ${teacher.phone ? `<span class="label">No. HP</span><span class="value">${teacher.phone}</span>` : ''}
      ${teacher.email ? `<span class="label">Email</span><span class="value">${teacher.email}</span>` : ''}
      ${teacher.officeHours ? `<span class="label">Jam Konsultasi</span><span class="value">${teacher.officeHours}</span>` : ''}
    </div>
  </div>

  <div class="footer">
    <p>Dicetak pada ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    <p>${schoolName} - Negeri Unggulan Mongisidi 1 Makassar</p>
  </div>
</body>
</html>`;
}

/**
 * Open print dialog for teacher profile
 */
function printTeacherProfile(teacher: TeacherItem) {
  const html = generatePrintHTML(teacher);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}

/**
 * Download teacher profile as HTML file
 */
function downloadTeacherProfile(teacher: TeacherItem) {
  const html = generatePrintHTML(teacher);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Profil_${teacher.name.replace(/\s+/g, '_')}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function TeacherPDFExport({ teacher, compact = false }: TeacherPDFExportProps) {
  if (compact) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="gap-1"
        onClick={() => printTeacherProfile(teacher)}
      >
        <Printer className="size-3" /> Cetak
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="gap-1"
        onClick={() => printTeacherProfile(teacher)}
      >
        <Printer className="size-3" /> Cetak Profil
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="gap-1"
        onClick={() => downloadTeacherProfile(teacher)}
      >
        <Download className="size-3" /> Unduh HTML
      </Button>
    </div>
  );
}
