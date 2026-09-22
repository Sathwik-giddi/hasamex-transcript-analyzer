/* Transcript parser: .txt files become timestamped chunks.
 * Expected shape (same as the case pack): an optional header with
 * Expert / Role / Market lines, then timestamp lines (MM:SS) each
 * followed by "Speaker: text". Interviewer turns are skipped so that
 * per-expert answers only ever quote the experts themselves.
 * Files without timestamps still load: paragraphs become chunks
 * marked "no timestamp", flagged in the parse report.
 */
const TS_RE = /^(\d{1,2}:\d{2}(?::\d{2})?)\s*$/;

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "expert";
}

function parseTranscript(rawText, filename, fileNo) {
  const warnings = [];
  const lines = String(rawText).replace(/\r/g, "").split("\n");
  if (!lines.some(l => l.trim())) {
    return { expert: null, chunks: [], skipped: 0, warnings: ["File is empty."] };
  }

  const firstTs = lines.findIndex(l => TS_RE.test(l.trim()));
  const header = lines.slice(0, firstTs === -1 ? Math.min(lines.length, 12) : firstTs).join("\n");
  const pick = re => { const m = header.match(re); return m ? m[1].trim() : null; };
  const meta = {
    name: pick(/expert\s+\d+\s*[–—-]\s*(.+)/i) ||
      filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || ("Expert " + fileNo),
    role: pick(/role\s*:\s*(.+)/i) || "Role not stated",
    market: pick(/market\s*:\s*(.+)/i) || "Market not stated",
  };
  const expertId = "up-" + fileNo + "-" + slug(meta.name);
  const expert = { id: expertId, name: meta.name, role: meta.role, market: meta.market, file: filename };

  const body = firstTs === -1 ? lines : lines.slice(firstTs);
  if (firstTs === -1) warnings.push("No timestamps found. Split by paragraph instead.");
  const turns = [];
  let cur = null;
  const flush = () => { if (cur && cur.lines.length) turns.push(cur); cur = null; };
  body.forEach(line => {
    const t = line.trim();
    const tsM = t.match(TS_RE);
    if (tsM) { flush(); cur = { ts: tsM[1], lines: [] }; return; }
    if (!t) return;
    if (!cur) cur = { ts: "", lines: [] };
    cur.lines.push(t);
  });
  flush();

  const chunks = [];
  let skipped = 0;
  turns.forEach((t, i) => {
    const joined = t.lines.join(" ");
    const cm = joined.match(/^([^:]{1,60}?):\s*(.+)$/);
    let speaker = meta.name, text = joined;
    if (cm) { speaker = cm[1].trim(); text = cm[2].trim(); }
    if (/interviewer/i.test(speaker)) { skipped += 1; return; }
    if (!text) return;
    chunks.push({ id: expertId + "-" + (i + 1), expert: expertId, ts: t.ts || "no timestamp", speaker, text });
  });
  if (!chunks.length) warnings.push("No quotable expert turns found after skipping interviewer lines.");
  return { expert, chunks, skipped, warnings };
}
