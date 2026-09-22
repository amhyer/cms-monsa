import type { SiteSettingItem } from "@/lib/types";

export type FormState = Omit<SiteSettingItem, "id" | "updatedAt">;

export const EMPTY: FormState = {
  schoolName: "",
  npsn: "",
  logo: "",
  faviconUrl: "",
  address: "",
  phone: "",
  email: "",
  mapEmbed: "",
  vision: "",
  mission: "",
  history: "",
  principalName: "",
  principalPhoto: "",
  principalWelcome: "",
  facebook: "",
  instagram: "",
  youtube: "",
  tiktok: "",
  studentCount: 0,
  teacherCount: 0,
  facilityCount: 0,
  achievementCount: 0,
  spmbInfo: "",
  spmbLink: "",
};

/** Props shared by the presentational form-card sections. */
export type FormSectionProps = {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
};

/** Shape of `/api/notifications/health` response. */
export type HealthStatus = {
  smtp: { configured: boolean; host: string; port: number; userPreview: string | null };
  whatsapp: { configured: boolean; hasAdminPhone: boolean };
  telegram: { configured: boolean };
  lastLogs: Record<string, { action: string; detail: string; at: string } | null>;
  storageAlert: {
    aboveThreshold: boolean;
    lastSendAt: string | null;
    lastChannelsWhatsapp: boolean | null;
    lastChannelsTelegram: boolean | null;
    lastTestSendAt: string | null;
    lastTestChannelsWhatsapp: boolean | null;
    lastTestChannelsTelegram: boolean | null;
  } | null;
};
