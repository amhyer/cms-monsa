import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// CATATAN VERSI (temuan review M6):
// `eslint-plugin-react-hooks` datang sebagai dependency transitif dari
// `eslint-config-next` dengan range longgar `^7.0.0`. Versi 7.1.x
// mengaktifkan/memperketat rule `react-hooks/set-state-in-effect` dan
// `react-hooks/immutability` sehingga install baru menghasilkan ~65 error
// di 30+ file (kebanyakan src/components/dashboard/modules/*.tsx).
//
// package.json mengunci versi ini lewat field `overrides` (dihormati npm
// maupun bun) agar CI tidak mendadak merah saat lockfile di-regenerate.
//
// Ini penundaan, bukan penyelesaian. Utang teknisnya: perbaiki pola
// setState-sinkron-di-useEffect tersebut, lalu lepas pin-nya dan naikkan
// ke 7.1.x secara sadar.

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    // TypeScript rules
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/no-unused-disable-directive": "off",

    // React rules
    "react-hooks/purity": "off",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    "react-compiler/react-compiler": "off",

    // Next.js rules
    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "off",

    // General JavaScript rules
    "prefer-const": "off",
    "no-console": "off",
    "no-debugger": "off",
    "no-empty": "off",
    "no-irregular-whitespace": "off",
    "no-case-declarations": "off",
    "no-fallthrough": "off",
    "no-mixed-spaces-and-tabs": "off",
    "no-redeclare": "off",
    "no-undef": "off",
    "no-unreachable": "off",
    "no-useless-escape": "off",
  },
}, {
  ignores: [
    "node_modules/**",
    ".next/**",
    ".next-*/**", // distDir server dev paralel (NEXT_DIST_DIR) — build output
    "out/**",
    "build/**",
    "coverage/**",
    "test-results/**",
    "playwright-report/**",
    "next-env.d.ts",
    "examples/**",
    "skills",
    // CommonJS tooling scripts (markdownlint custom rules) — bukan TS
    "scripts/**/*.cjs",
    // Aplikasi jembatan Dapodik (CJS companion, di-zip ke file bukan TS)
    "dapodik-jembatan/**",
  ]
}];

export default eslintConfig;
