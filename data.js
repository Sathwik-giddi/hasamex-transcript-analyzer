/* Hasamex case — source data.
 * Every quote below is copied verbatim from the 3 sample transcripts.
 * Chunks are split by timestamped speaker turn (the natural unit for citation).
 */
const EXPERTS = [
  { id: "france", name: "Dr. Jean Martin", role: "Head of Urology", market: "France" },
  { id: "germany", name: "Anna Keller", role: "Former Hospital Procurement Director", market: "Germany" },
  { id: "uk", name: "Dr. Emily Carter", role: "Consultant Urologist", market: "United Kingdom" },
];

const CHUNKS = [
  // ---- France ----
  { id: "fr-1", expert: "france", ts: "00:18", speaker: "Dr. Martin", text: "Adoption is growing, but it is still concentrated in larger academic hospitals and private centres with stronger capital budgets. Smaller regional hospitals are much slower." },
  { id: "fr-2", expert: "france", ts: "01:20", speaker: "Dr. Martin", text: "The biggest issue is still capital budget approval. Hospitals may like the technology clinically, but purchasing committees need a strong economic case before approving a system." },
  { id: "fr-3", expert: "france", ts: "02:18", speaker: "Dr. Martin", text: "Very important. The clinical argument may get surgeons interested, but the finance team wants to understand utilisation, procedure volume, maintenance cost and whether the system will actually pay for itself." },
  { id: "fr-4", expert: "france", ts: "03:10", speaker: "Dr. Martin", text: "Training matters, especially in the first year. If only one surgeon can use the system, the economics become difficult. Hospitals want several surgeons trained so utilisation is high enough." },
  { id: "fr-5", expert: "france", ts: "04:08", speaker: "Dr. Martin", text: "Clinical outcomes are necessary, but they are not enough on their own. If two systems offer similar outcomes, the hospital will look hard at economics and utilisation." },
  { id: "fr-6", expert: "france", ts: "05:07", speaker: "Dr. Martin", text: "I expect adoption to continue increasing, probably steadily rather than explosively. I would expect maybe 15 to 20 percent more procedures annually in some of the stronger centres, but smaller hospitals will remain slower." },
  { id: "fr-7", expert: "france", ts: "06:08", speaker: "Dr. Martin", text: "Six to twelve months is realistic once the hospital becomes serious. It can be longer if the capital committee pushes the purchase into the next budget cycle." },
  // ---- Germany ----
  { id: "de-1", expert: "germany", ts: "00:16", speaker: "Anna Keller", text: "It is growing, but adoption is quite uneven. Large university hospitals are much more advanced, while many smaller hospitals are still waiting." },
  { id: "de-2", expert: "germany", ts: "01:10", speaker: "Anna Keller", text: "Cost is the first barrier. These are large capital purchases, and hospital finances are under pressure. The second issue is proving that the system will be used enough." },
  { id: "de-3", expert: "germany", ts: "02:08", speaker: "Anna Keller", text: "We look at total cost of ownership, expected procedure volume, maintenance, service contracts and training requirements. A strong clinical case helps, but the economic case decides whether it gets approved." },
  { id: "de-4", expert: "germany", ts: "03:05", speaker: "Anna Keller", text: "Very important operationally. If the hospital buys a system but only one surgeon is comfortable using it, utilisation will be poor. That weakens the business case." },
  { id: "de-5", expert: "germany", ts: "04:09", speaker: "Anna Keller", text: "Yes, but I would not expect a dramatic jump. I think growth will be gradual, especially because many hospitals have other competing capital priorities." },
  { id: "de-6", expert: "germany", ts: "05:08", speaker: "Anna Keller", text: "I would expect continued growth, but probably closer to high single digits or low double digits in procedure volumes rather than something like 20 percent across the whole market." },
  { id: "de-7", expert: "germany", ts: "06:05", speaker: "Anna Keller", text: "Nine to eighteen months is common. Procurement, clinical leadership, finance and management all need to align, so it can move slowly." },
  // ---- UK ----
  { id: "uk-1", expert: "uk", ts: "00:14", speaker: "Dr. Carter", text: "Adoption is increasing, and in some larger NHS trusts robotic surgery is becoming standard for selected procedures. But access still varies significantly by hospital." },
  { id: "uk-2", expert: "uk", ts: "01:05", speaker: "Dr. Carter", text: "Funding is important, but I would say training capacity is just as important. You can buy a system, but if you cannot train enough surgeons and theatre staff, adoption stalls." },
  { id: "uk-3", expert: "uk", ts: "02:07", speaker: "Dr. Carter", text: "It matters, but the discussion is not always purely financial. Hospitals also consider patient outcomes, length of stay, surgeon recruitment and whether the technology improves their clinical position." },
  { id: "uk-4", expert: "uk", ts: "03:10", speaker: "Dr. Carter", text: "I would say economics and clinical strategy are balanced. I would not say finance alone decides the purchase." },
  { id: "uk-5", expert: "uk", ts: "04:06", speaker: "Dr. Carter", text: "I am quite positive. I think adoption could accelerate if training expands and systems become more cost competitive. I could see procedure growth above 15 percent annually in some areas." },
  { id: "uk-6", expert: "uk", ts: "05:04", speaker: "Dr. Carter", text: "Around six to nine months can happen if funding is already available. If the trust has to wait for a new capital cycle, it can take much longer." },
  { id: "uk-7", expert: "uk", ts: "06:04", speaker: "Dr. Carter", text: "The key point is that adoption is not just about buying the machine. Hospitals need enough trained people and enough procedure volume to make the programme sustainable." },
];

const GUIDE_QUESTIONS = [
  { id: "q1", short: "Current adoption", text: "How would you describe current adoption of robotic surgery in your market?" },
  { id: "q2", short: "Barriers", text: "What are the main barriers to adoption?" },
  { id: "q3", short: "Budgets & ROI", text: "How important are hospital budgets and ROI in purchasing decisions?" },
  { id: "q4", short: "Training & outcomes", text: "How important are surgeon training and clinical outcomes?" },
  { id: "q5", short: "3–5 year trend", text: "What adoption trend do you expect over the next 3–5 years?" },
  { id: "q6", short: "Decision timeline", text: "What is the typical hospital decision-making timeline for purchasing a new robotic system?" },
];

/* Curated guide answers: each maps a guide question -> one expert answer grounded
 * in exactly one verbatim chunk. `answer` is a faithful paraphrase; `chunkId`
 * points at the exact quote shown alongside it. */
const GUIDE_ANSWERS = {
  q1: {
    france: { answer: "Growing but concentrated in larger academic hospitals and well-funded private centres; smaller regional hospitals lag.", chunkId: "fr-1" },
    germany: { answer: "Growing but uneven — large university hospitals are advanced, many smaller hospitals still waiting.", chunkId: "de-1" },
    uk: { answer: "Increasing; becoming standard for selected procedures in some larger NHS trusts, but access varies by hospital.", chunkId: "uk-1" },
  },
  q2: {
    france: { answer: "Capital budget approval is the biggest barrier — committees demand a strong economic case.", chunkId: "fr-2" },
    germany: { answer: "Cost first (large capital outlay, pressured finances), plus proving the system will be used enough.", chunkId: "de-2" },
    uk: { answer: "Funding matters, but training capacity is equally important — without trained surgeons and theatre staff, adoption stalls.", chunkId: "uk-2" },
  },
  q3: {
    france: { answer: "Very important — finance wants utilisation, procedure volume, maintenance cost and proof the system pays for itself.", chunkId: "fr-3" },
    germany: { answer: "Decisive — procurement weighs total cost of ownership, volume, maintenance and service; the economic case decides approval.", chunkId: "de-3" },
    uk: { answer: "Matters, but not purely financial — patient outcomes, length of stay, recruitment and clinical positioning also count.", chunkId: "uk-3" },
  },
  q4: {
    france: { answer: "Training matters for utilisation (several surgeons needed); outcomes are necessary but not sufficient — economics decides ties.", chunkId: "fr-4", extraChunkId: "fr-5" },
    germany: { answer: "Training is very important operationally — single-surgeon use means poor utilisation and a weak business case.", chunkId: "de-4" },
    uk: { answer: "Economics and clinical strategy are balanced; finance alone does not decide the purchase.", chunkId: "uk-4" },
  },
  q5: {
    france: { answer: "Steady rather than explosive growth — maybe 15–20% more procedures annually in stronger centres; smaller hospitals slower.", chunkId: "fr-6" },
    germany: { answer: "Gradual growth — high single digits or low double digits, not ~20% market-wide; competing capital priorities constrain.", chunkId: "de-6", extraChunkId: "de-5" },
    uk: { answer: "Quite positive — adoption could accelerate with expanded training and cost-competitive systems; above 15% in some areas.", chunkId: "uk-5" },
  },
  q6: {
    france: { answer: "Six to twelve months once serious; longer if pushed into the next budget cycle.", chunkId: "fr-7" },
    germany: { answer: "Nine to eighteen months is common — procurement, clinical, finance and management must all align.", chunkId: "de-7" },
    uk: { answer: "Six to nine months if funding is available; much longer if waiting for a new capital cycle.", chunkId: "uk-6" },
  },
};

const THEMES = [
  {
    title: "Adoption is concentrated in large centres",
    verdict: "Agreement",
    summary: "All three experts describe growth concentrated in large academic / university / NHS-trust hospitals, with smaller hospitals lagging.",
    chunkIds: ["fr-1", "de-1", "uk-1"],
  },
  {
    title: "Economics decides — except the UK balances it",
    verdict: "Partial disagreement",
    summary: "France and Germany say the economic case is decisive for approval. The UK expert explicitly disagrees that finance alone decides, weighting clinical strategy equally.",
    chunkIds: ["fr-3", "de-3", "uk-4"],
  },
  {
    title: "Training drives utilisation and the business case",
    verdict: "Agreement",
    summary: "All three link training breadth to utilisation and economics. The UK elevates training capacity to a co-equal top barrier alongside funding.",
    chunkIds: ["fr-4", "de-4", "uk-2"],
  },
  {
    title: "Growth pace: steady vs gradual vs could accelerate",
    verdict: "Disagreement",
    summary: "France: steady, 15–20% in stronger centres. Germany: gradual, high-single / low-double digits, explicitly not ~20% market-wide. UK: could accelerate, above 15% in some areas.",
    chunkIds: ["fr-6", "de-6", "uk-5"],
  },
  {
    title: "Purchase timelines overlap but differ by market",
    verdict: "Broadly aligned",
    summary: "Ranges overlap at 6–18 months. France 6–12 mo, Germany slowest at 9–18 mo (multi-stakeholder alignment), UK fastest at 6–9 mo when funding is in place.",
    chunkIds: ["fr-7", "de-7", "uk-6"],
  },
  {
    title: "Outcomes are necessary but not sufficient",
    verdict: "Agreement (FR/DE explicit)",
    summary: "France and Germany state clinical evidence gets you in the door but economics closes the deal. The UK's closing line reframes it: trained people + procedure volume make programmes sustainable.",
    chunkIds: ["fr-5", "de-3", "uk-7"],
  },
];
