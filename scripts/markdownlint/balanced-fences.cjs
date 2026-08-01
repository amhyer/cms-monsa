// Custom rule markdownlint: CUSTOM002 — balanced-code-fences
// Setiap fence (``` atau ~~~) harus ditutup. Parser markdown menutup fence
// yang tidak ditutup secara diam-diam di akhir file, sehingga core
// markdownlint TIDAK melaporkannya — rule ini menangkapnya secara eksplisit.
//
// CATATAN: setiap file custom rule harus meng-export SATU rule object
// (bukan array) agar markdownlint-cli2 memuatnya dengan benar.
"use strict";

module.exports = {
  names: ["CUSTOM002", "balanced-code-fences"],
  description: "Fenced code blocks must be closed",
  tags: ["code", "structure"],
  function: function balancedCodeFences(params, onError) {
    let openFence = null;

    params.lines.forEach((line, index) => {
      const match = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
      if (!match) return;

      const fence = match[2];
      const rest = match[3];
      if (!openFence) {
        // Buka fence baru
        openFence = { char: fence[0], len: fence.length, line: index + 1 };
      } else if (
        fence[0] === openFence.char &&
        fence.length >= openFence.len &&
        /^\s*$/.test(rest)
      ) {
        // Tutup hanya jika fence bare (tanpa teks bahasa setelahnya)
        openFence = null;
      }
    });

    if (openFence) {
      onError({
        lineNumber: openFence.line,
        detail: `Fenced code block tidak ditutup (dibuka di baris ${openFence.line})`,
        context: (params.lines[openFence.line - 1] || "").slice(0, 80),
      });
    }
  },
};
