/* UI logic — renders guide answers, themes, extractive Q&A, quote search. */
const $ = s => document.querySelector(s);

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function quoteHtml(chunkId, blue) {
  const c = chunkById(chunkId);
  const e = expertOf(c.expert);
  return `<div class="quote">“${esc(c.text)}”<br/><span class="cite${blue ? " blue" : ""}">${esc(e.name)} · ${esc(e.market)} · [${c.ts}]</span></div>`;
}

/* ---- tabs ---- */
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    ["guide", "themes", "ask", "quotes", "arch"].forEach(t => {
      document.getElementById("tab-" + t).hidden = (t !== btn.dataset.tab);
    });
  });
});

/* ---- interview guide ---- */
const qselect = $("#qselect");
GUIDE_QUESTIONS.forEach((q, i) => {
  const o = document.createElement("option");
  o.value = q.id; o.textContent = `${i + 1}. ${q.short}`;
  qselect.appendChild(o);
});
function renderGuide() {
  const q = GUIDE_QUESTIONS.find(x => x.id === qselect.value) || GUIDE_QUESTIONS[0];
  $("#qtext").textContent = "Q: " + q.text;
  const box = $("#guide-cards");
  box.innerHTML = "";
  ["france", "germany", "uk"].forEach(eid => {
    const e = expertOf(eid);
    const a = GUIDE_ANSWERS[q.id][eid];
    const extra = a.extraChunkId ? quoteHtml(a.extraChunkId, true) : "";
    const div = document.createElement("div");
    div.className = "expert";
    div.innerHTML = `<div class="who">${esc(e.name)}</div>
      <div class="role">${esc(e.role)} · ${esc(e.market)}</div>
      <p class="answer">${esc(a.answer)}</p>
      ${quoteHtml(a.chunkId)}${extra}`;
    box.appendChild(div);
  });
}
qselect.addEventListener("change", renderGuide);
renderGuide();

/* ---- themes ---- */
function verdictPill(v) {
  const c = v.startsWith("Agreement") ? "agree" : v.startsWith("Disagreement") ? "dis" : "mid";
  return `<span class="pill ${c}">${esc(v)}</span>`;
}
$("#theme-list").innerHTML = THEMES.map(t => `
  <div class="card"><h3>${esc(t.title)} &nbsp;${verdictPill(t.verdict)}</h3>
  <div class="muted">${esc(t.summary)}</div>
  ${t.chunkIds.map(id => quoteHtml(id)).join("")}</div>`).join("");

/* ---- ask across transcripts ---- */
function renderAsk(results, query) {
  const out = $("#ask-out");
  if (!results.length || results[0].score < NO_EVIDENCE_THRESHOLD) {
    out.innerHTML = `<div class="card"><h3>No evidence in transcripts</h3>
      <div class="muted">Nothing relevant to “${esc(query)}” scored above the threshold. The app refuses to guess — try rephrasing (e.g. “budgets”, “training”, “timelines”).</div></div>`;
    return;
  }
  out.innerHTML = `<div class="card"><h3>Answer — grounded in ${results.length} cited turns</h3>
    <div class="muted">Extractive summary: key points below are paraphrases of the quoted turns only.</div>
    ${results.map((r, i) => {
      const e = expertOf(r.chunk.expert);
      return `<div class="ev"><b>${i + 1}. ${esc(e.name)} (${esc(e.market)}) [${r.chunk.ts}]</b>
        <span class="score"> · relevance ${r.score.toFixed(3)}</span>
        <div class="quote">“${esc(r.chunk.text)}”<br/><span class="cite">${esc(e.name)} · [${r.chunk.ts}]</span></div></div>`;
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

/* ---- quote explorer ---- */
function doSearch() {
  const q = $("#qs").value.trim();
  const out = $("#qs-out");
  const res = q ? search(q, 8, "all") : CHUNKS.map(chunk => ({ chunk, score: 1 })).slice(0, 8);
  const shown = q ? res.filter(r => r.score >= 0.02) : res;
  out.innerHTML = shown.length ? shown.map(r => {
    const e = expertOf(r.chunk.expert);
    return `<div class="card"><b>${esc(e.name)} · ${esc(e.market)} · [${r.chunk.ts}]</b>
      ${q ? `<span class="muted"> · score ${r.score.toFixed(3)}</span>` : ""}
      <div class="quote">“${esc(r.chunk.text)}”</div>
      <div class="muted">${esc(r.chunk.speaker)} · chunk <code>${r.chunk.id}</code></div></div>`;
  }).join("") : `<div class="card"><div class="muted">No verbatim matches for “${esc(q)}”.</div></div>`;
}
$("#qs-btn").addEventListener("click", doSearch);
$("#qs").addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });
doSearch();
