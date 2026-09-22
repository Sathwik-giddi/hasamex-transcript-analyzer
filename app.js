/* Dataset state + rendering. Sample data loads by default; uploading
 * .txt transcripts replaces the dataset and every tab reruns on it. */
var liveChunks = null, liveExperts = null, liveFiles = [];

const $ = s => document.querySelector(s);
function isCustom() { return !!(liveChunks && liveChunks.length); }
function exhibitLetter(i) { return String.fromCharCode(65 + i); }

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function quoteHtml(chunkId) {
  const c = chunkById(chunkId);
  const e = expertOf(c.expert);
  return `<p class="quote">${esc(c.text)}</p><span class="cite">${esc(e.name)}, ${esc(e.market)} [${c.ts}]</span>`;
}

function updateStats() {
  const n = DB().chunks.length;
  $("#docstats").textContent = isCustom()
    ? `${n} timestamped turns from ${liveFiles.length} uploaded files. 6 guide questions. Retrieval runs in this page, offline.`
    : `${n} timestamped turns. 6 guide questions. Retrieval runs in this page, offline, with no dependencies.`;
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

/* Transcripts: upload, parse, activate */
function renderFiles() {
  const list = $("#file-list");
  if (!isCustom()) {
    list.innerHTML = `<div class="empty"><strong>Sample set loaded.</strong> The three case-pack calls (France, Germany, UK). Upload your own .txt transcripts to replace them, or keep exploring below.</div>`;
  } else {
    list.innerHTML = liveFiles.map(f =>
      `<div class="filerow"><span><strong>${esc(f.name)}</strong> <span class="muted">${esc(f.expert)}: ${f.chunks} passages${f.skipped ? `, ${f.skipped} interviewer turns skipped` : ""}${f.warnings.length ? ` (${esc(f.warnings.join("; "))})` : ""}</span></span></div>`
    ).join("");
  }
  $("#restore-btn").hidden = !isCustom();
}

function activateUpload(results) {
  liveExperts = results.map(r => r.expert);
  liveChunks = [];
  liveFiles = [];
  results.forEach(r => {
    r.chunks.forEach(c => liveChunks.push(c));
    liveFiles.push({ name: r.filename, expert: r.expert.name, chunks: r.chunks.length, skipped: r.skipped, warnings: r.warnings });
  });
  resetIndex();
  updateStats(); renderFiles(); renderExpertFilter(); renderGuide(); renderThemes();
  const totalWarn = liveFiles.reduce((n, f) => n + f.warnings.length, 0);
  $("#upload-report").innerHTML = `<div class="empty"><strong>Converted ${liveFiles.length} files into ${liveChunks.length} quoted passages.</strong> Guide answers, themes, questions and the quote index now run on your uploads.${totalWarn ? ` ${totalWarn} note(s) listed per file above.` : ""} <button class="ghost" id="goto-guide" style="margin-top:10px">See the guide answers</button></div>`;
  const g = $("#goto-guide");
  if (g) g.addEventListener("click", () => showTab("guide"));
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
    const rd = new FileReader();
    rd.onload = () => {
      const r = parseTranscript(rd.result, f.name, i + 1);
      out.push({ filename: f.name, expert: r.expert || { id: "up-" + i, name: f.name, role: "Role not stated", market: "Market not stated" }, chunks: r.chunks, skipped: r.skipped, warnings: r.warnings });
      if (!--pending) { out.sort((a, b) => a.filename.localeCompare(b.filename)); activateUpload(out); }
    };
    rd.onerror = () => {
      out.push({ filename: f.name, expert: { id: "up-" + i, name: f.name, role: "Role not stated", market: "Market not stated" }, chunks: [], skipped: 0, warnings: ["Could not read this file."] });
      if (!--pending) { out.sort((a, b) => a.filename.localeCompare(b.filename)); activateUpload(out); }
    };
    rd.readAsText(f);
  });
}

function restoreSample() {
  liveChunks = null; liveExperts = null; liveFiles = [];
  resetIndex();
  $("#upload-report").innerHTML = "";
  updateStats(); renderFiles(); renderExpertFilter(); renderGuide(); renderThemes();
}

/* Guide exhibits: curated in sample mode, retrieved top passage in upload mode */
const qselect = $("#qselect");
GUIDE_QUESTIONS.forEach((q, i) => {
  const o = document.createElement("option");
  o.value = q.id; o.textContent = `${i + 1}. ${q.short}`;
  qselect.appendChild(o);
});
function renderGuide() {
  const q = GUIDE_QUESTIONS.find(x => x.id === qselect.value) || GUIDE_QUESTIONS[0];
  $("#qtext").textContent = "Full wording: " + q.text;
  const box = $("#guide-cards");
  box.innerHTML = "";
  DB().experts.forEach((e, i) => {
    const div = document.createElement("div");
    div.className = "card expert";
    let body;
    if (!isCustom()) {
      const a = GUIDE_ANSWERS[q.id][e.id];
      const extra = a.extraChunkId ? quoteHtml(a.extraChunkId) : "";
      body = `<p class="answer">${esc(a.answer)}</p>${quoteHtml(a.chunkId)}${extra}`;
    } else {
      const hit = search(q.text, 1, e.id)[0];
      body = (hit && hit.score >= NO_EVIDENCE_THRESHOLD)
        ? `<p class="answer">Closest passage in this transcript (relevance ${hit.score.toFixed(3)}).</p><p class="quote">${esc(hit.chunk.text)}</p><span class="cite">${esc(e.name)}, ${esc(e.market)} [${hit.chunk.ts}]</span>`
        : `<div class="empty"><strong>No clear passage.</strong> Nothing in this transcript answers that question closely.</div>`;
    }
    div.innerHTML = `<span class="exhibit-tag">Exhibit ${exhibitLetter(i)}</span>
      <div class="who">${esc(e.name)}</div>
      <div class="role">${esc(e.role)}, ${esc(e.market)}</div>${body}`;
    box.appendChild(div);
  });
}
qselect.addEventListener("change", renderGuide);

/* Themes: curated readings in sample mode, question-by-question
 * comparison in upload mode (each side shown, never averaged away). */
function verdictClass(v) {
  if (v.indexOf("Agreement") === 0) return "agree";
  if (v.indexOf("Disagreement") === 0) return "dis";
  return "partial";
}
function renderThemes() {
  const host = $("#theme-list");
  if (!isCustom()) {
    host.innerHTML = THEMES.map((t, i) => `
      <div class="card"><span class="exhibit-tag">Reading ${i + 1} of ${THEMES.length}</span>
      <h2 class="sec" style="margin-top:6px">${esc(t.title)} <span class="verdict ${verdictClass(t.verdict)}">${esc(t.verdict)}</span></h2>
      <p class="secsub">${esc(t.summary)}</p>
      ${t.chunkIds.map(id => quoteHtml(id)).join("")}</div>`).join("");
    return;
  }
  host.innerHTML = `<div class="card"><span class="exhibit-tag">Auto comparison</span>
    <p class="secsub" style="margin:8px 0 0">Curated readings describe the sample set. For your uploads, each guide question is answered side by side from the closest passage in each transcript.</p></div>` +
    GUIDE_QUESTIONS.map(q => {
      const cols = DB().experts.map(e => {
        const hit = search(q.text, 1, e.id)[0];
        const inner = (hit && hit.score >= NO_EVIDENCE_THRESHOLD)
          ? `<p class="quote">${esc(hit.chunk.text)}</p><span class="cite">${esc(e.name)} [${hit.chunk.ts}]</span>`
          : `<div class="empty"><strong>No clear passage</strong> in this transcript.</div>`;
        return `<div><strong>${esc(e.name)}</strong><br/>${inner}</div>`;
      }).join("");
      return `<div class="card"><span class="exhibit-tag">Guide question</span><h2 class="sec" style="margin-top:6px">${esc(q.short)}</h2><div class="compare">${cols}</div></div>`;
    }).join("");
}

/* Question the file */
function renderAsk(results, query) {
  const out = $("#ask-out");
  if (!results.length || results[0].score < NO_EVIDENCE_THRESHOLD) {
    out.innerHTML = `<div class="empty"><strong>No evidence in the transcripts.</strong> Nothing on \u201C${esc(query)}\u201D scored above the threshold, so the file refuses to guess. Try different words (budgets, training, timelines).</div>`;
    return;
  }
  out.innerHTML = `<div class="card"><span class="exhibit-tag">Answer: ${results.length} cited turns</span>
    ${results.map((r, i) => {
      const e = expertOf(r.chunk.expert);
      return `<div class="ev"><span class="evhead">${i + 1}. ${esc(e.name)} (${esc(e.market)}) [${r.chunk.ts}]</span>
        <span class="score">relevance ${r.score.toFixed(3)}</span>
        <p class="quote">${esc(r.chunk.text)}</p></div>`;
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

/* Quote index */
function doSearch() {
  const q = $("#qs").value.trim();
  const out = $("#qs-out");
  const chunks = DB().chunks;
  const res = q ? search(q, 8, "all") : chunks.slice(0, 8).map(chunk => ({ chunk, score: 1 }));
  const shown = q ? res.filter(r => r.score >= 0.02) : res;
  const letters = {};
  DB().experts.forEach((e, i) => { letters[e.id] = exhibitLetter(i); });
  out.innerHTML = shown.length ? shown.map(r => {
    const e = expertOf(r.chunk.expert);
    return `<div class="card"><span class="exhibit-tag">Exhibit ${letters[r.chunk.expert] || "?"} [${r.chunk.ts}]</span>
      <p class="quote">${esc(r.chunk.text)}</p>
      <span class="cite">${esc(e.name)}, ${esc(e.market)} [${r.chunk.ts}]</span>
      ${q ? `<span class="score"> relevance ${r.score.toFixed(3)}</span>` : ""}</div>`;
  }).join("") : `<div class="empty"><strong>No verbatim matches</strong> for \u201C${esc(q)}\u201D.</div>`;
}
$("#qs-btn").addEventListener("click", doSearch);
$("#qs").addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });

/* Upload wiring */
$("#file-input").addEventListener("change", e => { handleFiles(e.target.files); e.target.value = ""; });
$("#restore-btn").addEventListener("click", restoreSample);
const dz = $("#dropzone");
["dragenter", "dragover"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add("dragover"); }));
["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove("dragover"); }));
dz.addEventListener("drop", e => { if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); });

/* Init */
function renderExpertFilter() {
  const sel = $("#expert-filter");
  const keep = sel.value || "all";
  sel.innerHTML = `<option value="all">All experts in the file</option>` +
    DB().experts.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join("");
  sel.value = DB().experts.some(e => e.id === keep) ? keep : "all";
}
updateStats(); renderFiles(); renderExpertFilter(); renderGuide(); renderThemes(); doSearch();
