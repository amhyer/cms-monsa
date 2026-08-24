/** Days of the school week used in both API validation and the schedule grid. */
export const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;
export type Day = (typeof DAYS)[number];
