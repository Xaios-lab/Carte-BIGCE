// Adaptateur fal.ai — API de file d'attente (queue.fal.run).
// Doc : https://docs.fal.ai/model-apis/queue
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class ProviderError extends Error {
  constructor(message, { status, provider = "fal", body } = {}) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.provider = provider;
    this.body = body;
  }
}

function key() {
  const k = process.env.FAL_KEY;
  if (!k) throw new ProviderError("FAL_KEY manquante : ajoutez votre clé fal.ai dans studio/.env", { status: 401 });
  return k;
}

export async function run(endpoint, input, { log = () => {}, timeoutMs = 15 * 60_000, signal } = {}) {
  const headers = { Authorization: `Key ${key()}`, "Content-Type": "application/json" };
  const submit = await fetch(`https://queue.fal.run/${endpoint}`, { method: "POST", headers, body: JSON.stringify(input), signal });
  if (!submit.ok) {
    const body = await submit.text();
    throw new ProviderError(`fal.ai ${endpoint} → HTTP ${submit.status}: ${body.slice(0, 500)}`, { status: submit.status, body });
  }
  const { request_id, status_url, response_url } = await submit.json();
  log(`fal.ai: requête ${request_id} en file (${endpoint})`);

  const started = Date.now();
  let seenLogs = 0;
  while (Date.now() - started < timeoutMs) {
    await sleep(2000);
    const st = await fetch(`${status_url}?logs=1`, { headers, signal });
    if (!st.ok) throw new ProviderError(`fal.ai statut HTTP ${st.status}`, { status: st.status });
    const s = await st.json();
    if (Array.isArray(s.logs)) {
      for (const l of s.logs.slice(seenLogs)) if (l?.message) log(`  ${l.message}`);
      seenLogs = s.logs.length;
    }
    if (s.status === "IN_QUEUE" && s.queue_position != null) log(`  position dans la file : ${s.queue_position}`);
    if (s.status === "COMPLETED") {
      const res = await fetch(response_url, { headers, signal });
      if (!res.ok) throw new ProviderError(`fal.ai résultat HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`, { status: res.status });
      return res.json();
    }
    if (s.status === "FAILED" || s.error) throw new ProviderError(`fal.ai échec : ${JSON.stringify(s.error || s).slice(0, 500)}`);
  }
  throw new ProviderError(`fal.ai : délai dépassé (${Math.round(timeoutMs / 1000)} s) pour ${endpoint}`);
}
