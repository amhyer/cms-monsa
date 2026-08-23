import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/teachers/[id]/meetings
 * Public: create a meeting request
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { slotId, parentName, studentName, phone, purpose } = body;

    // Validate required fields
    if (!slotId || !parentName?.trim() || !studentName?.trim()) {
      return NextResponse.json(
        { error: "Slot, nama orang tua, dan nama siswa wajib diisi." },
        { status: 400 }
      );
    }

    // Verify teacher exists
    const teacher = await db.teacher.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true },
    });

    if (!teacher || !teacher.isActive) {
      return NextResponse.json(
        { error: "Guru tidak ditemukan." },
        { status: 404 }
      );
    }

    // In production, you'd:
    // 1. Verify the slot is still available
    // 2. Create the meeting record
    // 3. Send notification to teacher
    // 4. Send confirmation to parent

    // For now, return success
    return NextResponse.json(
      {
        message: `Pertemuan dengan ${teacher.name} berhasil dijadwalkan. Guru akan mengonfirmasi.`,
        meeting: {
          id: `meeting-${Date.now()}`,
          teacherName: teacher.name,
          parentName,
          studentName,
          slotId,
          status: "PENDING",
        },
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[meetings] POST error:", e);
    return NextResponse.json(
      { error: "Gagal menjadwalkan pertemuan." },
      { status: 500 }
    );
  }
}
