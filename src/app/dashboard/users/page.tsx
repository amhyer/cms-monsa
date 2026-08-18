import { UsersManager } from "@/components/dashboard/modules/users-manager";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ createSiswa?: string; studentName?: string }>;
}) {
  const sp = await searchParams;
  return (
    <UsersManager
      initialCreateSiswa={
        sp.createSiswa
          ? { studentId: sp.createSiswa, studentName: sp.studentName ?? "" }
          : null
      }
    />
  );
}
