export const SOURCES = ["BOS Reguler", "BOS Kinerja", "DAK", "Lainnya"] as const;

export type FormState = {
  year: number;
  source: string;
  category: string;
  item: string;
  amount: number;
  quarter: number | null;
  note: string;
};

export const EMPTY: FormState = {
  year: new Date().getFullYear(),
  source: SOURCES[0],
  category: "",
  item: "",
  amount: 0,
  quarter: null,
  note: "",
};

export type DocFormState = {
  year: number;
  title: string;
  description: string;
};

export const EMPTY_DOC: DocFormState = {
  year: new Date().getFullYear(),
  title: "",
  description: "",
};

export type YearStat = {
  year: number;
  count: number;
  docs: number;
  amount: number;
};
