import "@testing-library/jest-dom/vitest";

// Node 22+/jsdom: localStorage hanya tersedia bila Node dijalankan dengan
// flag eksperimental --localstorage-file. Stub in-memory agar test komponen
// yang memakai localStorage (preferensi UI, mis. interval panel storage)
// bisa memverifikasi perilaku persisten seperti di browser.
if (typeof window !== "undefined" && typeof window.localStorage === "undefined") {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) =>
        void store.set(String(key), String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => void store.clear(),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size;
      },
    },
    configurable: true,
  });
}
