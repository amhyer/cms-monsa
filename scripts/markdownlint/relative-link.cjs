// Custom rule markdownlint: CUSTOM001 — relative-link-exists
// Semua tautan relatif ([text](target)) harus menunjuk ke file yang benar-benar
// ada di disk. Mengabaikan tautan eksternal (http/https/mailto/tel), anchor (#),
// dan tautan dengan judul. Mencegah "tautan rusak" ter-commit.
//
// CATATAN: setiap file custom rule harus meng-export SATU rule object
// (bukan array) agar markdownlint-cli2 memuatnya dengan benar.
"use strict";

const fs = require("node:fs");
const path = require("node:path");

module.exports = {
  names: ["CUSTOM001", "relative-link-exists"],
  description: "Relative links must point to existing files",
  tags: ["links", "files"],
  function: function relativeLinkExists(params, onError) {
    const sourceDir = path.dirname(params.name || ".");
    const linkRe = /\[[^\]]*\]\(([^)]+)\)/g;
    // Fence pembuka/tutup — baris di dalam blok kode dilewati (contoh tautan
    // di dokumentasi sering ditulis di dalam code block).
    const fenceRe = /^(\s*)(`{3,}|~{3,})(.*)$/;
    let inFence = null;

    params.lines.forEach((line, index) => {
      const fenceMatch = line.match(fenceRe);
      if (fenceMatch) {
        const fence = fenceMatch[2];
        const rest = fenceMatch[3];
        if (!inFence) {
          inFence = { char: fence[0], len: fence.length };
        } else if (
          fence[0] === inFence.char &&
          fence.length >= inFence.len &&
          /^\s*$/.test(rest)
        ) {
          inFence = null;
        }
        return; // baris fence itu sendiri bukan tautan
      }
      if (inFence) return; // di dalam blok kode — lewati

      // Strip inline code span (\`text\`) agar contoh tautan dalam dokumentasi
      // seperti \`[text](file.md)\` tidak dianggap tautan sungguhan.
      const scanLine = line.replace(/`[^`]*`/g, "");

      let match;
      while ((match = linkRe.exec(scanLine)) !== null) {
        let target = match[1].trim();

        // Lewati tautan eksternal / anchor / skema khusus
        if (/^(https?:|mailto:|tel:|#)/.test(target)) continue;

        // Buang judul opsional: [text](url "title") atau [text](url 'title')
        target = target.replace(/\s+["'][^"']*["']\s*$/, "").trim();
        if (!target) continue;

        // Tangani fragmen dalam tautan file: [text](file.md#section)
        const filePart = target.split("#")[0];
        if (!filePart) continue;

        const resolved = path.resolve(sourceDir, filePart);
        if (!fs.existsSync(resolved)) {
          onError({
            lineNumber: index + 1,
            detail: `Relative link target tidak ditemukan: ${match[1]}`,
            context: line.slice(0, 80),
          });
        }
      }
    });
  },
};
