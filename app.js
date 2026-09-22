/* Renders guide exhibits, themes, extractive Q&A and the quote index. */
const $ = s => document.querySelector(s);
const EXHIBIT = { france: "A", germany: "B", uk: "C" };

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function quoteHtml(chunkId) {
  const c = chunkById(chunkId);
  const e = expertOf(c.expert);
  return `<p class="quote">${esc(c.text)}</p><span class="cite">${esc(e.name)}, ${esc(e.market)} [${c.ts}]</span>`;
}

/* Tabs: real buttons, aria-selected kept in sync. Tab order matches visual order. */
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => {
      b.classList.toggle("active", b === btn);
      b.setAttribute("aria-selected", b === btn ? "true" : "false");
    });
    ["guide", "themes", "ask", "quotes", "arch"].forEach(t => {
      document.getElementById("tab-" + t).hidden = (t !== btn.dataset.tab);
    });
  });
});

/* Guide exhibits */
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
  ["france", "germany", "uk"].forEach(eid => {
    const e = expertOf(eid);
    const a = GUIDE_ANSWERS[q.id][eid];
    const extra = a.extraChunkId ? quoteHtml(a.extraChunkId) : "";
    const div = document.createElement("div");
    div.className = "card expert";
    div.innerHTML = `<span class="exhibit-tag">Exhibit ${EXHIBIT[eid]}</span>
      <div class="who">${esc(e.name)}</div>
      <div class="role">${esc(e.role)}, ${esc(e.market)}</div>
      <p class="answer">${esc(a.answer)}</p>
      ${quoteHtml(a.chunkId)}${extra}`;
    box.appendChild(div);
  });
}
qselect.addEventListener("change", renderGuide);
renderGuide();

/* Themes */
function verdictClass(v) {
  if (v.indexOf("Agreement") === 0) return "agree";
  if (v.indexOf("Disagreement") === 0) return "dis";
  return "partial";
}
$("#theme-list").innerHTML = THEMES.map((t, i) => `
  <div class="card"><span class="exhibit-tag">Reading ${i + 1} of ${THEMES.length}</span>
  <h2 class="sec" style="margin-top:6px">${esc(t.title)} <span class="verdict ${verdictClass(t.verdict)}">${esc(t.verdict)}</span></h2>
  <p class="secsub">${esc(t.summary)}</p>
  ${t.chunkIds.map(id => quoteHtml(id)).join("")}</div>`).join("");

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
  const res = q ? search(q, 8, "all") : CHUNKS.map(chunk => ({ chunk, score: 1 })).slice(0, 8);
  const shown = q ? res.filter(r => r.score >= 0.02) : res;
  out.innerHTML = shown.length ? shown.map(r => {
    const e = expertOf(r.chunk.expert);
    return `<div class="card"><span class="exhibit-tag">Exhibit ${EXHIBIT[r.chunk.expert]} [${r.chunk.ts}]</span>
      <p class="quote">${esc(r.chunk.text)}</p>
      <span class="cite">${esc(e.name)}, ${esc(e.market)} [${r.chunk.ts}]</span>
      ${q ? `<span class="score"> relevance ${r.score.toFixed(3)}</span>` : ""}</div>`;
  }).join("") : `<div class="empty"><strong>No verbatim matches</strong> for \u201C${esc(q)}\u201D.</div>`;
}
$("#qs-btn").addEventListener("click", doSearch);
$("#qs").addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });
doSearch();
