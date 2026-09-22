/**
 * Regression lock (A1 audit fix): komponen login adalah client component —
 * string apa pun di dalamnya ikut ter-bundle ke JavaScript publik. Kredensial
 * akun TIDAK boleh pernah di-hardcode di sana lagi.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const LOGIN_VIEWS = [
  "src/components/auth/login-view.tsx",
  "src/components/auth/admin-login-view.tsx",
];

const SEED_PASSWORDS = ["admin123", "operator123", "guru123"];

describe("login views tidak membawa kredensial hardcoded", () => {
  for (const file of LOGIN_VIEWS) {
    it(`${file} bebas dari password seed`, () => {
      const src = readFileSync(file, "utf8");
      for (const pwd of SEED_PASSWORDS) {
        expect(src).not.toContain(`"${pwd}"`);
        expect(src).not.toContain(`'${pwd}'`);
      }
    });
  }
});
