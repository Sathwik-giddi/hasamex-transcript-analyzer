/* Grounded extractive retrieval (no generation, no hallucination).
 * Method: tokenize -> TF-IDF over the uploaded timestamped chunks -> cosine similarity.
 * Answers are always verbatim chunk quotes with [timestamp + expert] citations.
 * If the best score is below THRESHOLD we return "no evidence" instead of guessing.
 */
const STOP = new Set(("a,an,the,and,or,but,if,then,else,for,to,of,in,on,at,by,with,from,as,is,are,was,were,be,been,being,it,its,this,that,these,those,you,your,we,our,they,their,he,she,his,her,what,whats,how,why,when,where,which,who,whom,whose,do,does,did,can,could,should,would,will,just,very,more,most,also,not,no,so,such,than,there,here,about,into,over,after,before,between,across,all,any,both,each,few,many,much,own,same,too,i,me,my,wouldnt,would,mean,like,say,think,know,something").split(","));

function stem(t) {
  if (t.length > 4 && t.endsWith("ies")) return t.slice(0, -3) + "y";
  if (t.length > 5 && t.endsWith("ing")) return t.slice(0, -3);
  if (t.length > 4 && t.endsWith("ed")) return t.slice(0, -2);
  if (t.length > 4 && t.endsWith("es")) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith("s")) return t.slice(0, -1);
  return t;
}

function tokens(s) {
  return (s.toLowerCase().match(/[a-z0-9%'-]+/g) || [])
    .map(t => t.replace(/^['-]+|['-]+$/g, ""))
    .filter(t => t.length > 1 && !STOP.has(t))
    .map(stem);
}

function buildIndex(chunks) {
  const docs = chunks.map(c => tokens(c.text + " " + c.speaker));
  const df = new Map();
  docs.forEach(toks => new Set(toks).forEach(t => df.set(t, (df.get(t) || 0) + 1)));
  const N = docs.length;
  const idf = new Map([...df.entries()].map(([t, d]) => [t, Math.log(1 + N / d)]));
  const vecs = docs.map(toks => {
    const tf = new Map();
    toks.forEach(t => tf.set(t, (tf.get(t) || 0) + 1));
    const v = new Map();
    tf.forEach((f, t) => v.set(t, (f / toks.length) * (idf.get(t) || 0)));
    return v;
  });
  return { idf, vecs };
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  a.forEach((v, k) => { na += v * v; if (b.has(k)) dot += v * b.get(k); });
  b.forEach(v => { nb += v * v; });
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

let _idx = null;
function resetIndex() { _idx = null; }

/* Active dataset: uploaded transcripts only (see app.js). The file opens
 * empty; nothing is built in. Guarded so load order never matters. */
function DB() {
  if (typeof liveChunks !== "undefined" && liveChunks) {
    return { chunks: liveChunks, experts: liveExperts || [] };
  }
  return { chunks: [], experts: [] };
}
function getIndex() {
  if (!_idx) _idx = buildIndex(DB().chunks);
  return _idx;
}

/* Small synonym expansion so "cost/price/ROI/money" style questions match
 * finance-heavy chunks, and "future/outlook" matches forecast chunks. */
const EXPAND_RAW = {
  cost: ["cost", "budget", "capital", "finance", "economic", "maintenance", "ownership", "funding", "price"],
  price: ["cost", "budget", "capital", "finance", "economic", "maintenance", "ownership", "funding"],
  roi: ["utilisation", "volume", "economic", "finance", "budget", "ownership", "maintenance"],
  budget: ["budget", "capital", "finance", "economic", "funding", "cost"],
  money: ["cost", "budget", "capital", "finance", "economic", "funding"],
  economic: ["economic", "finance", "budget", "utilisation", "volume", "ownership"],
  future: ["expect", "growth", "increasing", "accelerate", "gradual", "annually"],
  outlook: ["expect", "growth", "increasing", "accelerate", "gradual", "annually"],
  trend: ["expect", "growth", "increasing", "gradual", "annually"],
  expected: ["expect", "growth", "increasing", "gradual", "accelerate", "annually"],
  growth: ["expect", "growth", "increasing", "gradual", "accelerate", "annually", "percent"],
  training: ["training", "train", "trained", "surgeon", "surgeons", "staff"],
  timeline: ["months", "cycle", "budget"],
  long: ["months", "cycle"],
  purchase: ["procurement", "capital", "committee", "months", "cycle", "approval"],
  buying: ["buying", "purchase", "procurement", "machine"],
  barrier: ["issue", "cost", "budget", "approval", "training", "proving", "pressure", "stalls"],
  adopt: ["adoption", "growing", "increasing", "concentrated", "uneven"],
  adoption: ["adoption", "growing", "increasing", "concentrated", "uneven"],
  disagree: ["balanced", "alone", "rather", "dramatic", "accelerate", "gradual"],
};
/* Stem expansion keys/values with the same stemmer so they match indexed terms. */
const EXPAND = {};
Object.entries(EXPAND_RAW).forEach(([k, vs]) => {
  EXPAND[stem(k)] = vs.map(stem);
});

function expandQuery(q) {
  const base = tokens(q);
  const out = [...base];
  base.forEach(t => { (EXPAND[t] || []).forEach(s => { if (!out.includes(s)) out.push(s); }); });
  return out;
}

function queryVec(qterms, idf) {
  const tf = new Map();
  qterms.forEach(t => tf.set(t, (tf.get(t) || 0) + 1));
  const v = new Map();
  tf.forEach((f, t) => { if (idf.has(t)) v.set(t, (f / qterms.length) * idf.get(t)); });
  return v;
}

const NO_EVIDENCE_THRESHOLD = 0.06;

function search(query, topK = 3, expertFilter = "all") {
  const { idf, vecs } = getIndex();
  const chunks = DB().chunks;
  const qv = queryVec(expandQuery(query), idf);
  const scored = chunks
    .map((c, i) => ({ chunk: c, score: cosine(qv, vecs[i]) }))
    .filter(r => expertFilter === "all" || r.chunk.expert === expertFilter)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  return scored;
}

function expertOf(id) { return DB().experts.find(e => e.id === id); }
function chunkById(id) { return DB().chunks.find(c => c.id === id); }
function cite(c) { return `${expertOf(c.expert).name} [${c.ts}]`; }
