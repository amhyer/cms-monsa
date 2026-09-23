import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-helpers";
import { db } from "@/lib/db";

/**
 * GET /api/teachers/[id]/meeting-slots
 * Public: get available meeting slots for a teacher
 */
async function GET_impl(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Verify teacher exists
  const teacher = await db.teacher.findUnique({
    where: { id },
    select: { id: true, isActive: true },
  });

  if (!teacher || !teacher.isActive) {
    return NextResponse.json(
      { error: "Guru tidak ditemukan." },
      { status: 404 }
    );
  }

  // Mock slots belum memakai officeHours — query detail guru di-skip
  // sampai generator slot-nya benar-benar mengonsumsi jam operasional.
  const slots = generateMockSlots();

  return NextResponse.json({ slots });
}

// Proteksi error konsisten (gate: check-mutation-handlers) — klien menerima
// 500 tersanitasi, server mencatat trace via logger.error.
export const GET = withErrorHandling(GET_impl, { errorMessage: "Gagal memuat slot pertemuan." });

/**
 * Generate mock meeting slots based on office hours
 * In production, replace with database queries
 */
function generateMockSlots(): Array<{id: string; date: string; startTime: string; endTime: string; isAvailable: boolean}> {
  const slots: Array<{id: string; date: string; startTime: string; endTime: string; isAvailable: boolean}> = [];
  const today = new Date();
  
  // Generate slots for next 7 days
  for (let i = 1; i <= 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    
    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    // Generate morning and afternoon slots
    const morningSlot = {
      id: `slot-${date.toISOString().split('T')[0]}-morning`,
      date: date.toISOString().split('T')[0],
      startTime: "08:00",
      endTime: "10:00",
      isAvailable: Math.random() > 0.3, // Random availability
    };
    
    const afternoonSlot = {
      id: `slot-${date.toISOString().split('T')[0]}-afternoon`,
      date: date.toISOString().split('T')[0],
      startTime: "13:00",
      endTime: "15:00",
      isAvailable: Math.random() > 0.3,
    };
    
    slots.push(morningSlot, afternoonSlot);
  }
  
  return slots;
}
