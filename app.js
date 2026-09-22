/* Dataset state + rendering. The file opens empty; uploading .txt
 * transcripts builds the dataset and every tab runs on it.
 * Every answer follows claim -> evidence -> source -> timestamp,
 * and every displayed quote passes the claim-evidence validator. */
var liveChunks = [], liveExperts = [], liveFiles = [];
var pendingFocus = null;

const $ = s => document.querySelector(s);
function hasData() { return liveChunks.length > 0; }
function exhibitLetter(i) { return String.fromCharCode(65 + i); }
function uploadPrompt() {
  return `<div class="empty"><strong>The file is empty.</strong> Upload transcripts first. <button class="ghost" data-goto-files style="margin-top:10px">Go to Transcripts</button></div>`;
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function firstSentence(text) {
  const parts = String(text).split(/(?<=[.!?])\s+/);
  return (parts[0] || String(text)).trim();
}

/* Structured evidence record: the unit the whole UI is built from. */
function buildRecord(question, expert, chunk, relevance) {
  const validation = validateEvidence(chunk.id, chunk.text);
  return {
    question,
    market: expert.market,
    expert: expert.name,
    finding: firstSentence(chunk.text),
    evidence: [{
      speaker: chunk.speaker,
      timestamp: chunk.ts,
      quote: chunk.text,
      source: chunk.file || "uploaded transcript",
    }],
    relevance: Math.round(relevance * 1000) / 1000,
    validation: { exactMatch: validation.ok, note: validation.reason },
  };
}

function verifiedBadge(record) {
  return record.validation.exactMatch
    ? `<span class="verified">Verified: exact quote</span>`
    : `<span class="verified bad">Flagged: quote mismatch</span>`;
}

/* Tabs */
const TABS = ["files", "guide", "themes", "ask", "quotes", "arch"];
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => {
      b.classList.toggle("active", b === btn);
      b.setAttribute("aria-selected", b === btn ? "true" : "false");
    });
    TABS.forEach(t => { document.getElementById("tab-" + t).hidden = (t !== btn.dataset.tab); });
  });
});
function showTab(name) {
  document.querySelector(`.tab[data-tab="${name}"]`).click();
}
document.addEventListener("click", e => {
  if (e.target && e.target.matches && e.target.matches("[data-goto-files]")) showTab("files");
  const g = e.target && e.target.closest ? e.target.closest("#goto-guide") : null;
  if (g) showTab("guide");
  const ev = e.target && e.target.closest ? e.target.closest("[data-evidence]") : null;
  if (ev) {
    const d = ev.dataset;
    openEvidence(d.chunk, d.question || "", parseFloat(d.score || "0"));
  }
  const cp = e.target && e.target.closest ? e.target.closest("[data-copyjson]") : null;
  if (cp) copyRecord(cp);
});

/* Evidence drawer: finding, evidence, source, validation, JSON. */
function openEvidence(chunkId, question, relevance) {
  const chunk = chunkById(chunkId);
  if (!chunk) return;
  const expert = expertOf(chunk.expert);
  const record = buildRecord(question || "Evidence record", expert, chunk, relevance || 0);
  const root = $("#drawer-root");
  root.innerHTML = `
  <div class="overlay" data-close-drawer>
    <div class="drawer" role="dialog" aria-modal="true" aria-label="Evidence record">
      <span class="exhibit-tag">Evidence record</span>
      ${question ? `<h2 class="sec" style="margin-top:6px">${esc(question)}</h2>` : ""}
      <p><strong>Finding:</strong> ${esc(record.finding)}</p>
      <p class="quote">${esc(chunk.text)}</p>
      <p><strong>${esc(expert.name)}</strong><br/>
      <span class="muted">${esc(expert.role)}, ${esc(expert.market)} [${chunk.ts}] · Source: ${esc(chunk.file || "uploaded transcript")}</span></p>
      <p>${verifiedBadge(record)} <span class="score">relevance ${record.relevance}</span></p>
      <details><summary>Evidence JSON</summary><pre>${esc(JSON.stringify(record, null, 2))}</pre></details>
      <div class="btnrow">
        <button class="primary" data-view-transcript="${chunk.id}">View in transcript</button>
        <button class="ghost" data-copyjson='${esc(JSON.stringify(record))}'>Copy JSON</button>
        <button class="ghost" data-close-drawer>Close</button>
      </div>
    </div>
  </div>`;
  const closeBtn = root.querySelector("[data-close-drawer].ghost, .drawer .ghost:last-child");
  root.querySelector(".overlay").addEventListener("click", e => {
    if (e.target.hasAttribute("data-close-drawer")) closeEvidence();
  });
  document.addEventListener("keydown", escClose);
  const vt = root.querySelector("[data-view-transcript]");
  if (vt) vt.addEventListener("click", () => { const id = vt.getAttribute("data-view-transcript"); closeEvidence(); viewTranscript(id); });
  if (closeBtn && closeBtn.focus) closeBtn.focus();
}
function escClose(e) { if (e.key === "Escape") closeEvidence(); }
function closeEvidence() {
  $("#drawer-root").innerHTML = "";
  document.removeEventListener("keydown", escClose);
}

function copyRecord(btn) {
  let record;
  try { record = JSON.parse(btn.getAttribute("data-copyjson")); }
  catch (err) { return; }
  const text = JSON.stringify(record, null, 2);
  const done = () => { btn.textContent = "Copied"; setTimeout(() => { btn.textContent = "Copy JSON"; }, 1500); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); done(); } catch (err) { /* clipboard unavailable; JSON stays visible in the record */ }
  document.body.removeChild(ta);
}

/* Transcript jump: open the expert's transcript with the passage highlighted. */
function viewTranscript(chunkId) {
  const chunk = chunkById(chunkId);
  if (!chunk) return;
  $("#qs-expert").value = chunk.expert;
  $("#qs").value = "";
  pendingFocus = chunkId;
  showTab("quotes");
  doSearch();
}

/* Transcripts: upload, parse, activate */
function renderFiles() {
  const list = $("#file-list");
  list.innerHTML = hasData() ? liveFiles.map(f =>
    `<div class="filerow"><span><strong>${esc(f.name)}</strong> <span class="muted">${esc(f.expert)}: ${f.chunks} passages${f.skipped ? `, ${f.skipped} interviewer turns skipped` : ""}${f.warnings.length ? ` (${esc(f.warnings.join("; "))})` : ""}</span></span></div>`
  ).join("") : `<div class="empty"><strong>Nothing in the file yet.</strong> Drop the case transcripts above and the evidence file builds itself.</div>`;
}

function activateUpload(results) {
  liveExperts = results.map(r => r.expert);
  liveChunks = [];
  liveFiles = [];
  results.forEach(r => {
    r.chunks.forEach(c => { c.file = r.filename; liveChunks.push(c); });
    liveFiles.push({ name: r.filename, expert: r.expert.name, chunks: r.chunks.length, skipped: r.skipped, warnings: r.warnings });
  });
  resetIndex();
  updateStats(); renderFiles(); renderExpertFilter(); renderGuide(); renderThemes();
  const totalWarn = liveFiles.reduce((n, f) => n + f.warnings.length, 0);
  $("#upload-report").innerHTML = `<div class="empty"><strong>Converted ${liveFiles.length} file(s) into ${liveChunks.length} quoted passages.</strong> Guide answers, comparison, explore and evidence now run on your uploads.${totalWarn ? ` ${totalWarn} note(s) listed per file above.` : ""} <button class="ghost" id="goto-guide" style="margin-top:10px">See the guide answers</button></div>`;
}

function handleFiles(fileList) {
  const files = [...fileList].filter(f => /\.txt$/i.test(f.name) || /\.md$/i.test(f.name) || f.type.startsWith("text/"));
  if (!files.length) {
    $("#upload-report").innerHTML = `<div class="empty"><strong>Nothing readable there.</strong> Drop plain .txt transcript files.</div>`;
    return;
  }
  $("#upload-report").innerHTML = `<div class="empty"><strong>Reading ${files.length} file(s).</strong> Parsing timestamped turns.</div>`;
  const out = [];
  let pending = files.length;
  files.forEach((f, i) => {
    const done = () => { if (!--pending) { out.sort((a, b) => a.filename.localeCompare(b.filename)); activateUpload(out); } };
    const rd = new FileReader();
    rd.onload = () => {
      const r = parseTranscript(rd.result, f.name, i + 1);
      out.push({ filename: f.name, expert: r.expert || { id: "up-" + i, name: f.name, role: "Role not stated", market: "Market not stated" }, chunks: r.chunks, skipped: r.skipped, warnings: r.warnings });
      done();
    };
    rd.onerror = () => {
      out.push({ filename: f.name, expert: { id: "up-" + i, name: f.name, role: "Role not stated", market: "Market not stated" }, chunks: [], skipped: 0, warnings: ["Could not read this file."] });
      done();
    };
    rd.readAsText(f);
  });
}

/* Guide exhibits: closest retrieved passage per expert, validated. */
const qselect = $("#qselect");
GUIDE_QUESTIONS.forEach((q, i) => {
  const o = document.createElement("option");
  o.value = q.id; o.textContent = `${i + 1}. ${q.short}`;
  qselect.appendChild(o);
});
function evidenceButtons(chunkId, question, score) {
  return `<div class="btnrow"><button class="ghost" data-evidence data-chunk="${chunkId}" data-question="${esc(question)}" data-score="${score.toFixed(3)}">Evidence record</button></div>`;
}
function renderGuide() {
  const q = GUIDE_QUESTIONS.find(x => x.id === qselect.value) || GUIDE_QUESTIONS[0];
  $("#qtext").textContent = "Full wording: " + q.text;
  const box = $("#guide-cards");
  if (!hasData()) { box.innerHTML = uploadPrompt(); return; }
  box.innerHTML = "";
  DB().experts.forEach((e, i) => {
    const hit = search(q.text, 1, e.id)[0];
    const ok = hit && hit.score >= NO_EVIDENCE_THRESHOLD;
    const record = ok ? buildRecord(q.text, e, hit.chunk, hit.score) : null;
    const body = ok
      ? `<p class="answer">${esc(record.finding)}</p><p class="quote">${esc(hit.chunk.text)}</p><span class="cite">${esc(e.name)}, ${esc(e.market)} [${hit.chunk.ts}]</span> ${verifiedBadge(record)}${evidenceButtons(hit.chunk.id, q.text, hit.score)}`
      : `<div class="empty"><strong>No clear passage.</strong> Nothing in this transcript answers that question closely.</div>`;
    const div = document.createElement("div");
    div.className = "card expert";
    div.innerHTML = `<span class="exhibit-tag">Exhibit ${exhibitLetter(i)}</span>
      <div class="who">${esc(e.name)}</div>
      <div class="role">${esc(e.role)}, ${esc(e.market)}</div>${body}`;
    box.appendChild(div);
  });
}
qselect.addEventListener("change", renderGuide);

/* Compare: each guide question answered side by side from every transcript. */
function renderThemes() {
  const host = $("#theme-list");
  if (!hasData()) { host.innerHTML = uploadPrompt(); return; }
  host.innerHTML = GUIDE_QUESTIONS.map(q => {
    const cols = DB().experts.map(e => {
      const hit = search(q.text, 1, e.id)[0];
      const ok = hit && hit.score >= NO_EVIDENCE_THRESHOLD;
      const inner = ok
        ? `<p class="quote">${esc(hit.chunk.text)}</p><span class="cite">${esc(e.name)} [${hit.chunk.ts}]</span>${evidenceButtons(hit.chunk.id, q.text, hit.score)}`
        : `<div class="empty"><strong>No clear passage</strong> in this transcript.</div>`;
      return `<div><strong>${esc(e.name)}</strong><br/>${inner}</div>`;
    }).join("");
    return `<div class="card"><span class="exhibit-tag">Guide question</span><h2 class="sec" style="margin-top:6px">${esc(q.short)}</h2><div class="compare">${cols}</div></div>`;
  }).join("");
}

/* Explore: free text across all transcripts, answers validated. */
function renderAsk(results, query) {
  const out = $("#ask-out");
  if (!hasData()) { out.innerHTML = uploadPrompt(); return; }
  if (!results.length || results[0].score < NO_EVIDENCE_THRESHOLD) {
    out.innerHTML = `<div class="empty"><strong>No evidence in the transcripts.</strong> Nothing on \u201C${esc(query)}\u201D scored above the threshold, so the file refuses to guess. Try different words (budgets, training, timelines).</div>`;
    return;
  }
  out.innerHTML = `<div class="card"><span class="exhibit-tag">Answer: ${results.length} cited turns</span>
    ${results.map((r, i) => {
      const e = expertOf(r.chunk.expert);
      const record = buildRecord(query, e, r.chunk, r.score);
      return `<div class="ev"><span class="evhead">${i + 1}. ${esc(e.name)} (${esc(e.market)}) [${r.chunk.ts}]</span>
        <span class="score">relevance ${r.score.toFixed(3)}</span> ${verifiedBadge(record)}
        <p class="quote">${esc(r.chunk.text)}</p>${evidenceButtons(r.chunk.id, query, r.score)}</div>`;
    }).join("")}</div>`;
}
function doAsk() {
  const q = $("#q").value.trim();
  if (!q) return;
  renderAsk(search(q, 3, $("#expert-filter").value), q);
}
$("#ask-btn").addEventListener("click", doAsk);
$("#q").addEventListener("keydown", e => { if (e.key === "Enter") doAsk(); });
document.querySelectorAll(".examples button").forEach(b =>
  b.addEventListener("click", () => { $("#q").value = b.dataset.ex; doAsk(); }));

/* Evidence explorer: search, or browse one transcript end to end. */
function quoteCard(r, showScore) {
  const e = expertOf(r.chunk.expert);
  const letters = {};
  DB().experts.forEach((ex, i) => { letters[ex.id] = exhibitLetter(i); });
  return `<div class="card" id="chunk-${r.chunk.id}"><span class="exhibit-tag">Exhibit ${letters[r.chunk.expert] || "?"} [${r.chunk.ts}]</span>
    <p class="quote">${esc(r.chunk.text)}</p>
    <span class="cite">${esc(e.name)}, ${esc(e.market)} [${r.chunk.ts}]</span>
    ${showScore ? `<span class="score"> relevance ${r.score.toFixed(3)}</span>` : ""}</div>`;
}
function doSearch() {
  const q = $("#qs").value.trim();
  const out = $("#qs-out");
  if (!hasData()) { out.innerHTML = uploadPrompt(); return; }
  const expertSel = $("#qs-expert").value || "all";
  const pool = expertSel === "all" ? DB().chunks : DB().chunks.filter(c => c.expert === expertSel);
  let html;
  if (q) {
    const res = search(q, 40, expertSel).filter(r => r.score >= 0.02).slice(0, 8);
    html = res.length ? res.map(r => quoteCard(r, true)).join("")
      : `<div class="empty"><strong>No verbatim matches</strong> for \u201C${esc(q)}\u201D.</div>`;
  } else {
    const cap = 40;
    html = pool.slice(0, cap).map(c => quoteCard({ chunk: c, score: 1 }, false)).join("") +
      (pool.length > cap ? `<div class="empty"><strong>Showing ${cap} of ${pool.length} turns.</strong> Narrow with search.</div>` : "");
  }
  out.innerHTML = html;
  if (pendingFocus) {
    const id = pendingFocus;
    pendingFocus = null;
    const el = document.getElementById("chunk-" + id);
    if (el) {
      el.classList.add("flash");
      if (el.scrollIntoView) el.scrollIntoView({ block: "center" });
      setTimeout(() => el.classList.remove("flash"), 2400);
    }
  }
}
$("#qs-btn").addEventListener("click", doSearch);
$("#qs").addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });
$("#qs-expert").addEventListener("change", doSearch);

/* Upload wiring */
$("#file-input").addEventListener("change", e => { handleFiles(e.target.files); e.target.value = ""; });
const dz = $("#dropzone");
["dragenter", "dragover"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add("dragover"); }));
["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove("dragover"); }));
dz.addEventListener("drop", e => { if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); });

/* Init */
function updateStats() {
  $("#docstats").textContent = hasData()
    ? `${liveChunks.length} timestamped turns from ${liveFiles.length} uploaded file(s). 6 guide questions. Retrieval runs in this page, offline.`
    : `No transcripts yet. Upload .txt files to open the evidence file.`;
}
function renderExpertFilter() {
  const sel = $("#expert-filter");
  const keep = sel.value || "all";
  sel.innerHTML = `<option value="all">All experts in the file</option>` +
    DB().experts.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join("");
  sel.value = DB().experts.some(e => e.id === keep) ? keep : "all";
  const qs = $("#qs-expert");
  const keepQ = qs.value || "all";
  qs.innerHTML = `<option value="all">All transcripts</option>` +
    DB().experts.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join("");
  qs.value = DB().experts.some(e => e.id === keepQ) ? keepQ : "all";
}
updateStats(); renderFiles(); renderExpertFilter(); renderGuide(); renderThemes(); doSearch();
