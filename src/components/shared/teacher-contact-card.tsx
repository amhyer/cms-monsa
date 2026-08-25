"use client";

import { useState } from "react";
import {
  Download,
  QrCode,
  Phone,
  Mail,
  MessageCircle,
  Share2,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { TeacherItem } from "@/lib/types";

/**
 * Generate vCard string for a teacher
 */
function generateVCard(teacher: TeacherItem): string {
  const nameParts = teacher.name.split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  return `BEGIN:VCARD
VERSION:3.0
N:${lastName};${firstName};;;
FN:${teacher.name}
ORG:SD Negeri Unggulan Mongisidi 1
TITLE:${teacher.position}
${teacher.phone ? `TEL;TYPE=CELL:${teacher.phone}` : ""}
${teacher.email ? `EMAIL:${teacher.email}` : ""}
${teacher.phone ? `NOTE;ENCODING=QUOTED-PRINTABLE:${teacher.position} - SD Negeri Unggulan Mongisidi 1` : ""}
END:VCARD`;
}

/**
 * Download vCard file
 */
function downloadVCard(teacher: TeacherItem) {
  const vCard = generateVCard(teacher);
  const blob = new Blob([vCard], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${teacher.name.replace(/\s+/g, "_")}.vcf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success("Kontak berhasil diunduh!");
}

/**
 * Generate QR code URL (using free API)
 */
function getQRCodeUrl(text: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`;
}

/**
 * Copy profile link to clipboard
 */
async function copyProfileLink(teacherId: string) {
  const url = `${window.location.origin}/academic/guru/${teacherId}`;
  await navigator.clipboard.writeText(url);
  toast.success("Link profil disalin!");
}

/**
 * Share teacher profile
 */
async function shareProfile(teacher: TeacherItem) {
  const url = `${window.location.origin}/academic/guru/${teacher.id}`;
  if (navigator.share) {
    try {
      await navigator.share({
        title: `Profil ${teacher.name}`,
        text: `${teacher.name} - ${teacher.position} | SD Negeri Unggulan Mongisidi 1`,
        url,
      });
    } catch {
      // User cancelled share
    }
  } else {
    await copyProfileLink(teacher.id);
  }
}

interface TeacherContactCardProps {
  teacher: TeacherItem;
  compact?: boolean;
}

export function TeacherContactCard({
  teacher,
  compact = false,
}: TeacherContactCardProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const profileUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/academic/guru/${teacher.id}`;
  const qrUrl = getQRCodeUrl(profileUrl);

  const handleCopyLink = async () => {
    await copyProfileLink(teacher.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {teacher.phone && (
          <a
            href={`https://wa.me/62${teacher.phone.startsWith("0") ? teacher.phone.slice(1) : teacher.phone}`}
            target="_blank"
            rel="noreferrer"
          >
            <Button size="sm" variant="outline" className="gap-1">
              <MessageCircle className="size-3" />
            </Button>
          </a>
        )}
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={() => downloadVCard(teacher)}
        >
          <Download className="size-3" />
        </Button>
        <Dialog open={showQR} onOpenChange={setShowQR}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1">
              <QrCode className="size-3" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xs">
            <DialogHeader>
              <DialogTitle>QR Code Profil</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3">
              <img src={qrUrl} alt="QR Code" className="rounded-lg" />
              <p className="text-center text-sm text-muted-foreground">
                Scan untuk melihat profil {teacher.name}
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* WhatsApp */}
      {teacher.phone && (
        <a
          href={`https://wa.me/62${teacher.phone.startsWith("0") ? teacher.phone.slice(1) : teacher.phone}`}
          target="_blank"
          rel="noreferrer"
        >
          <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700">
            <MessageCircle className="size-3" /> WhatsApp
          </Button>
        </a>
      )}

      {/* Phone */}
      {teacher.phone && (
        <a href={`tel:${teacher.phone}`}>
          <Button size="sm" variant="outline" className="gap-1">
            <Phone className="size-3" /> Telepon
          </Button>
        </a>
      )}

      {/* Email */}
      {teacher.email && (
        <a href={`mailto:${teacher.email}`}>
          <Button size="sm" variant="outline" className="gap-1">
            <Mail className="size-3" /> Email
          </Button>
        </a>
      )}

      {/* Download vCard */}
      <Button
        size="sm"
        variant="outline"
        className="gap-1"
        onClick={() => downloadVCard(teacher)}
      >
        <Download className="size-3" /> Unduh Kontak
      </Button>

      {/* QR Code */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1">
            <QrCode className="size-3" /> QR Code
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>QR Code Profil</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            <img src={qrUrl} alt="QR Code" className="rounded-lg border" />
            <p className="text-center text-sm text-muted-foreground">
              Scan untuk melihat profil {teacher.name}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                const link = document.createElement("a");
                link.href = qrUrl;
                link.download = `QR_${teacher.name.replace(/\s+/g, "_")}.png`;
                link.click();
              }}
            >
              <Download className="size-3 mr-1" /> Unduh QR Code
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Copy Link */}
      <Button
        size="sm"
        variant="outline"
        className="gap-1"
        onClick={handleCopyLink}
      >
        {copied ? (
          <Check className="size-3 text-emerald-600" />
        ) : (
          <Copy className="size-3" />
        )}
        {copied ? "Tersalin!" : "Salin Link"}
      </Button>

      {/* Share */}
      <Button
        size="sm"
        variant="outline"
        className="gap-1"
        onClick={() => shareProfile(teacher)}
      >
        <Share2 className="size-3" /> Bagikan
      </Button>
    </div>
  );
}
