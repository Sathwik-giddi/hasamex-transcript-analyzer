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
| Read the transcripts | Transcripts tab: `.txt` files parsed into timestamped chunks (1 speaker turn each, verbatim) |
| Answer interview-guide questions per expert | Interview guide tab: 6 questions by each uploaded expert, closest passage shown with score |
| Extract exact quotes | Every answer renders the verbatim chunk text; Evidence tab searches and browses it |
| Show source timestamp | Every quote carries speaker, market and `[mm:ss]` |
| Common themes and disagreements | Compare tab: each guide question answered side by side from every transcript |
| Ask questions across transcripts | Explore tab: free-text extractive QA over all chunks, optional per-expert filter |

## How answers stay trustworthy

- **Evidence first.** Retrieval (TF-IDF plus stemming plus synonyms) selects passages; nothing is generated from model memory. The display order is always claim, evidence, source, timestamp.
- **Claim-evidence validator.** Every displayed quote is checked as an exact substring of its cited turn at render time (`validateEvidence` in `retrieval.js`). Matches carry a "Verified: exact quote" badge; mismatches are flagged, never silently shown. Below-threshold retrieval gets an explicit no-evidence reply.
- **Structured records.** Each answer is shaped as claim plus evidence JSON (question, market, expert, finding, quote, speaker, timestamp, source file, relevance, validation result). Open any Evidence record to inspect it, jump to its transcript position, or copy the JSON.
- **Scoped numbers.** A standing note reminds readers that figures are individual expert expectations, scoped to each market, never blended into one forecast.

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

## 2-minute demo story

Play a market researcher who just finished three expert interviews.

1. **Upload moment.** Transcripts tab: drop the three `.txt` files. The report reads "Converted 3 files into 21 quoted passages." Click through to the guide.
2. **Guide matrix.** Open Q3 (budgets and ROI). France and Germany say economics decides, the UK balances it. Point at the three timestamps.
3. **Evidence drawer.** Open the Germany answer as an Evidence record: finding, exact quote, Anna Keller 02:08, source file, verified badge, JSON. Press View in transcript and land on the passage, highlighted.
4. **Compare.** The growth-pace question is the real disagreement, with all three numbers quoted and scoped (15 to 20 percent in stronger French centres, single digits across Germany, above 15 percent in some UK areas).
5. **Explore.** Ask "Do all three experts agree that economics is the main purchasing driver?" The answer is no, with each side cited. Then type gibberish: the file refuses to guess.
