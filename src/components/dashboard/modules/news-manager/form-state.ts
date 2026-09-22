export type FormState = {
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  status: "DRAFT" | "PUBLISHED";
};

export const EMPTY_FORM: FormState = {
  title: "",
  excerpt: "",
  content: "",
  coverImage: "",
  category: "Kegiatan",
  status: "DRAFT",
};
