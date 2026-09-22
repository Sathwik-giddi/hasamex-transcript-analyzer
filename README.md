# European Robotic Surgery: Evidence File
Hasamex AI Engineer technical case (Round 2 demo).

An extractive, fully cited analysis of expert-call transcripts.
Upload the calls, and every answer pairs a short synthesis with exact verbatim quotes plus timestamps.
No answer is ever generated without retrieved evidence. The file opens empty: there is no built-in data.

## Run it (30 seconds, no dependencies, works offline)

```bash
cd hasamex-transcript-analyzer
python3 -m http.server 8000
# open http://localhost:8000
```

Double-clicking `index.html` works too. No build step, no API keys, no backend.

## Uploading transcripts

Open the Transcripts tab and drop plain `.txt` files (one per call). The parser picks up
`Expert` / `Role` / `Market` headers, splits turns on timestamp lines (`00:18`), and skips
interviewer lines so experts are only quoted on their own words. Files without timestamps
still load (split by paragraph, flagged in the report). Uploading builds the dataset and
every tab runs on it: guide answers show the closest passage per expert, themes answer each
question side by side, and questions plus the quote index search the new text.

## What the app does (maps to the 6 case requirements)

| Requirement | Where |
|---|---|
| Read the transcripts | Upload tab: `.txt` files parsed into timestamped chunks (1 speaker turn each, verbatim) |
| Answer interview-guide questions per expert | Interview guide tab: 6 questions by each uploaded expert, closest passage shown with score |
| Extract exact quotes | Every answer renders the verbatim chunk text; the quote index searches it |
| Show source timestamp | Every quote carries speaker, market and `[mm:ss]` |
| Common themes and disagreements | Themes tab: each guide question answered side by side from every transcript |
| Ask questions across transcripts | Question tab: free-text extractive QA over all chunks, optional per-expert filter |

## Architecture

```
transcripts turn into timestamped chunks {id, expert, speaker, mm:ss, text}
  indexed as TF-IDF in the page (stemmed, stopword-removed)
  queried by cosine similarity with synonym expansion and a 0.06 threshold
  answered as verbatim quotes plus citations (no LLM in the loop)
```

## Key decisions (demo walkthrough)

- **Model choice.** No generative model in the default path. At this scale, deterministic TF-IDF plus stemming plus a small synonym map is accurate, instant, offline and explainable. A language model is an optional layer on top (summary wording only), never the source of facts.
- **Citations and timestamps.** Chunking preserves `{expert, speaker, mm:ss}` as metadata. The UI never rewords quotes. Citation strings render from the chunk record.
- **Against invention (4 layers).** 1) extractive-only answers, 2) relevance threshold with an explicit no-evidence reply, 3) guide answers pinned to single chunk IDs, 4) disagreements shown side by side with quotes instead of averaged away.
- **Scale from 3 to 30+ transcripts.** Same chunk schema. Replace the in-page index with embeddings (bge/e5) plus a vector store (FAISS/pgvector), add timestamp alignment for raw audio, dedupe near-identical turns, cache per-question answers, and add an eval harness: citation precision (share of quotes that are exact substrings) and per-question recall against the guide.

## Design notes

The UI is a clinical dossier: paper background, serif evidence quotes, mono timestamps, Exhibit A/B/C labels. One teal accent marks key moments only (active section, primary action, citation chips). All text pairings pass WCAG AA (checked with the antislop contrast script), verdicts pair color with text labels, tabs are keyboard operable with visible focus, and the layout reflows to a single column on narrow screens.

## Files

- `index.html`: dossier shell plus 5 sections
- `styles.css`: dossier theme
- `data.js`: the six interview-guide questions (the brief, not transcript data)
- `retrieval.js`: tokenizer, stemmer, TF-IDF plus cosine, synonym expansion
- `app.js`: rendering plus tab logic

## 2-minute demo script

1. **Upload moment.** Transcripts tab: drop the three `.txt` files. The report reads "Converted 3 files into 21 quoted passages." Click through to the guide.
2. **Guide tab.** Open Q3 (budgets and ROI). France and Germany say economics decides, the UK balances it. Point at the three timestamps.
3. **Themes tab.** Open the growth-pace reading: the one real disagreement, with all three numbers quoted (15 to 20 percent, single digits, above 15 percent).
4. **Question tab.** Ask "Does finance alone decide the purchase?" The UK passage leads. Then type gibberish. The file refuses to guess, which is the anti-hallucination proof.
