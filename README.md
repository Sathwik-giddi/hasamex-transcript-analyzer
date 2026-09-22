# European Robotic Surgery — Expert Call Analyzer
Hasamex AI Engineer technical case (Round 2 demo).

Extractive, fully-cited analysis of 3 expert-call transcripts (France · Germany · UK).
Every answer pairs a short synthesis with **exact verbatim quotes + timestamps**.
No answer is ever generated without retrieved evidence.

## Run it (30 seconds, no dependencies, works offline)

```bash
cd hasamex-transcript-analyzer
python3 -m http.server 8000
# open http://localhost:8000
```

Alternatively just double-click `index.html`. No build step, no API keys, no backend.

## What the app does (maps to the 6 case requirements)

| Requirement | Where |
|---|---|
| Read the 3 transcripts | `data.js` — 21 timestamped chunks (1 speaker turn = 1 chunk, verbatim) |
| Answer interview-guide questions per expert | Tab 1 — 6 questions × 3 experts, each pinned to a chunk ID (`GUIDE_ANSWERS`) |
| Extract exact quotes | Every answer renders the verbatim chunk text; Tab 4 searches it |
| Show source timestamp | Every quote carries `[Name · Market · mm:ss]` |
| Common themes & disagreements | Tab 2 — 6 themes with verdicts, each backed by 3 cited quotes |
| Ask questions across transcripts | Tab 3 — free-text extractive QA over all chunks, optional per-expert filter |

## Architecture

```
transcripts → timestamped chunks {id, expert, speaker, mm:ss, text}
  → in-browser TF-IDF index (stemmed, stopword-removed)
  → cosine retrieval + synonym expansion + 0.06 relevance threshold
  → extractive answer: verbatim quotes + citations (no LLM in the loop)
```

## Key decisions (demo walkthrough)

- **Model choice:** deliberately no generative model in the default path. With only
  21 chunks, deterministic TF-IDF + stemming + a small synonym map is accurate,
  instant, offline, and fully explainable. An LLM is the *optional* layer on top
  (summary wording only), never the source of facts.
- **Citations/timestamps:** chunking preserves `{expert, speaker, mm:ss}` as metadata;
  the UI never rewords quotes — citation strings are rendered from the chunk record.
- **Anti-hallucination (4 layers):** 1) extractive-only answers, 2) relevance threshold
  with an explicit "No evidence in transcripts" fallback (try typing gibberish),
  3) guide answers pinned to single chunk IDs instead of retrieved at runtime,
  4) disagreements shown side-by-side with quotes rather than averaged away.
- **Scale 3 → 30+ transcripts:** keep the same chunk schema; swap in-browser TF-IDF for
  embeddings (bge/e5) + a vector store (FAISS/pgvector); add diarization + timestamp
  alignment for raw audio; dedupe near-identical turns; cache per-question answers;
  add an eval harness — citation precision (% quotes that are exact substrings) and
  per-question recall against the guide.

## Files

- `index.html` — UI shell + 5 tabs
- `styles.css` — dark theme
- `data.js` — transcripts (verbatim), guide Q&A map, themes
- `retrieval.js` — tokenizer, stemmer, TF-IDF + cosine, synonym expansion
- `app.js` — rendering + tab logic

## 2-minute demo script

1. **Guide tab:** pick Q3 (budgets & ROI) → France/Germany say economics decides, UK balances it — point at the three timestamps.
2. **Themes tab:** open "Growth pace" → the one real disagreement, with all three numbers quoted (15–20% / single-digit / above 15%).
3. **Ask tab:** ask "Does finance alone decide the purchase?" → UK quote on top; then type gibberish → "No evidence" fallback (anti-hallucination proof).
