/* Studio Créa IA — logique front (vanilla JS) */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const api = async (url, opts = {}) => {
  const r = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (usd) => `${usd.toFixed(2)} $ ≈ ${Math.round(usd * (state.status?.usdToXpf || 110)).toLocaleString("fr-FR")} F`;

const state = { status: null, catalog: null, brands: [], uploads: {}, jobs: {} };

// ───────── Navigation
$$("nav button").forEach((b) => b.addEventListener("click", () => showView(b.dataset.view)));
function showView(v) {
  $$("nav button").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
  $$(".view").forEach((s) => s.classList.toggle("active", s.id === `view-${v}`));
  if (v === "library") loadLibrary();
  if (v === "dashboard") loadDashboard();
  location.hash = v;
}

// ───────── Chargement initial
async function init() {
  [state.status, state.catalog, state.brands] = await Promise.all([api("/api/status"), api("/api/catalog"), api("/api/brands")]);
  renderModeBadge();
  fillBrandSelects();
  fillModelSelects();
  renderProviders();
  renderCatalog();
  renderBrandPicker();
  loadDashboard();
  $$("form[data-kind]").forEach(wireGenerateForm);
  wireUploads();
  wireBrandForm();
  wireRunForm();
  wireLibrary();
  const v = location.hash.slice(1);
  if (v && $(`#view-${v}`)) showView(v);
}

function renderModeBadge() {
  const b = $("#mode-badge");
  const st = state.status;
  if (st.mockMode) { b.className = "mode-badge demo"; b.innerHTML = `<b>Mode DÉMO</b><br>Aucune clé fournisseur : les rendus sont factices. Ajoutez <code>FAL_KEY</code> dans <code>studio/.env</code>.`; }
  else { b.className = "mode-badge live"; b.innerHTML = `<b>Mode PRODUCTION</b><br>Fournisseur : ${esc(st.defaultProvider)}<br>Claude : ${st.claude.available ? esc(st.claude.model) : "hors ligne"}`; }
}

function fillBrandSelects() {
  $$(".brand-select").forEach((s) => { s.innerHTML = state.brands.map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join(""); });
}

function modelsFor(task, { logo } = {}) {
  let ms = state.catalog.models.filter((m) => m.task === task);
  if (logo) ms = [...ms.filter((m) => m.logo), ...ms.filter((m) => !m.logo)];
  return ms;
}
function modelOption(m) {
  const price = m.price.unit === "image" ? `${m.price.usd} $/img` : m.price.unit === "second" ? `${m.price.usd} $/s` : `${m.price.usd} $/1k car.`;
  const flag = state.status.providers[m.provider]?.configured || state.status.mockMode ? "" : " ⚠ clé manquante";
  return `<option value="${esc(m.id)}">${esc(m.name)} — ${price}${m.openSource ? " · open source" : ""}${flag}</option>`;
}
function fillModelSelects() {
  $$(".model-select").forEach((s) => {
    const task = s.dataset.task;
    const ms = modelsFor(task, { logo: s.dataset.logo });
    s.innerHTML = ms.map(modelOption).join("");
    const defs = state.catalog.defaults[s.dataset.logo ? "logo" : task] || {};
    const def = defs[s.dataset.default || "standard"];
    if (def && ms.some((m) => m.id === def)) s.value = def;
    if (task === "tts") { s.addEventListener("change", () => fillVoices(s)); fillVoices(s); }
  });
  // Modèle vidéo dépend du mode i2v / t2v
  const fv = $("#form-video");
  fv.mode.addEventListener("change", () => {
    const task = fv.mode.value === "t2v" ? "video-t2v" : "video-i2v";
    fv.videoModel.innerHTML = modelsFor(task).map(modelOption).join("");
    fv.videoModel.value = state.catalog.defaults[task].standard;
    fv.imageModel.closest("label").classList.toggle("hidden", fv.mode.value === "t2v");
    estimate(fv);
  });
  fv.music.addEventListener("change", () => $(".music-file", fv).classList.toggle("hidden", fv.music.value !== "upload"));
  const fu = $("#form-ugc");
  fu.route.addEventListener("change", () => { $(".route-avatar", fu).classList.toggle("hidden", fu.route.value !== "avatar"); $(".route-native", fu).classList.toggle("hidden", fu.route.value !== "native"); estimate(fu); });
}
function fillVoices(ttsSelect) {
  const m = state.catalog.models.find((x) => x.id === ttsSelect.value);
  const vs = ttsSelect.closest("form").querySelector(".voice-select");
  if (vs) vs.innerHTML = (m?.voices || []).map((v) => `<option>${esc(v)}</option>`).join("") || `<option value="">(défaut)</option>`;
}

// ───────── Uploads → data URI → serveur
function wireUploads() {
  $$("input[type=file][data-upload]").forEach((inp) => {
    inp.addEventListener("change", async () => {
      const key = inp.dataset.upload;
      const files = [...inp.files];
      const urls = [];
      for (const f of files) {
        const data = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
        const up = await api("/api/upload", { method: "POST", body: { data, name: f.name } });
        urls.push(up.url);
      }
      const form = inp.closest("form");
      form._uploads = form._uploads || {};
      form._uploads[key] = inp.multiple ? urls : urls[0];
      if (key === "logo") $("#brand-logo-preview").innerHTML = `<img src="${urls[0]}" alt="logo">`;
      if (form.dataset.kind) estimate(form);
    });
  });
}

// ───────── Formulaires de génération
function formParams(form) {
  const fd = new FormData(form);
  const p = {};
  for (const [k, v] of fd.entries()) {
    if (form.elements[k]?.type === "file") continue;
    if (k === "formats") { (p.formats ||= []).push(v); continue; }
    if (v === "" || v == null) continue;
    p[k] = v;
  }
  for (const el of form.elements) {
    if (el.type === "checkbox" && el.name && el.name !== "formats") p[el.name] = el.checked;
    if (el.type === "number" && el.value !== "") p[el.name] = Number(el.value);
  }
  Object.assign(p, form._uploads || {});
  if (p.musicUpload) { p.music = p.musicUpload; delete p.musicUpload; }
  if (p.music === "upload") p.music = "none";
  return p;
}
let estTimer;
async function estimate(form) {
  clearTimeout(estTimer);
  estTimer = setTimeout(async () => {
    try {
      const e = await api(`/api/estimate/${form.dataset.kind}`, { method: "POST", body: formParams(form) });
      $(".estimate", form).innerHTML = e.mock ? `Mode démo : <b>0 $</b> (en production ≈ ${money(e.usd)})` : `Coût estimé : <b>${money(e.usd)}</b>${e.models ? ` · ${esc(e.models.join(", "))}` : e.model ? ` · ${esc(e.model)}` : ""}`;
    } catch (err) { $(".estimate", form).textContent = ""; }
  }, 250);
}
function wireGenerateForm(form) {
  form.addEventListener("input", () => estimate(form));
  form.addEventListener("change", () => estimate(form));
  estimate(form);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("button[type=submit]", form);
    btn.disabled = true;
    try {
      const job = await api(`/api/generate/${form.dataset.kind}`, { method: "POST", body: formParams(form) });
      watchJob(job, $(`#panel-${form.dataset.kind}`));
    } catch (err) { alert(err.message); }
    btn.disabled = false;
  });
}

// ───────── Suivi d'un job (SSE)
function jobCard(job) {
  const el = document.createElement("div");
  el.className = "job";
  el.id = `job-${job.id}`;
  el.innerHTML = `<div class="job-head"><div><span class="title">${esc(job.title || job.kind)}</span> <span class="meta">${esc(job.id)}</span></div><div><span class="meta cost"></span> <span class="status ${job.status}">${job.status}</span></div></div>
  <div class="progress"><i style="width:${job.progress || 0}%"></i></div><div class="stage">${esc(job.stage || "")}</div>
  <div class="result hidden"></div>
  <div class="outputs"></div>
  <details><summary class="stage">Journal</summary><div class="log"></div></details>`;
  return el;
}
function renderOutput(o) {
  const d = document.createElement("div");
  d.className = `out${o.final ? " final" : ""}`;
  let media = "";
  if (o.kind === "image") media = `<img src="${o.url}" loading="lazy" alt="${esc(o.label)}">`;
  else if (o.kind === "video") media = `<video src="${o.url}" ${o.thumb ? `poster="${o.thumb}"` : ""} controls preload="metadata"></video>`;
  else if (o.kind === "audio") media = `<audio src="${o.url}" controls style="width:95%"></audio>`;
  else media = `<span style="font-size:32px">📄</span>`;
  d.innerHTML = `<div class="media">${media}</div><div class="cap"><span class="l">${esc(o.label || o.kind)}</span><span class="m">${esc(o.modelName || "")}${o.cost ? ` · ${o.cost.toFixed(3)} $` : ""}${o.mock ? " · démo" : ""}</span><a href="${o.url}" download>Télécharger</a></div>`;
  if (o.kind === "image") $(".media", d).addEventListener("click", () => lightbox(`<img src="${o.url}">`));
  return d;
}
function renderResult(kind, r) {
  if (!r) return "";
  if (r.concepts) return `<h4>Concepts</h4>` + r.concepts.map((c) => `<div class="scene"><b>${esc(c.name)}</b> — ${esc(c.rationale)}<br><span class="en">${esc(c.prompt)}</span><br>Typo : ${esc(c.typography)} · Palette : ${(c.palette || []).map((p) => `<span class="tag" style="border-color:${esc(p)}">${esc(p)}</span>`).join("")}</div>`).join("");
  if (r.creative) { const c = r.creative; return `<h4>Accroche</h4><b>${esc(c.headline)}</b><br>${esc(c.subline)}<br>CTA : <b>${esc(c.cta)}</b><br><span class="en">${esc(c.imagePrompt)}</span><br>Variantes A/B : ${(c.variants || []).map((v) => `« ${esc(v.headline)} » / ${esc(v.cta)}`).join(" · ")}`; }
  if (r.script?.scenes) { const s = r.script; return `<h4>${esc(s.title)}</h4>Hook : <b>${esc(s.hook)}</b>` + s.scenes.map((sc) => `<div class="scene"><b>Scène ${sc.index} (${sc.durationSec} s)</b> — 🗣 ${esc(sc.voiceover)}${sc.onScreenText ? ` · 🔤 ${esc(sc.onScreenText)}` : ""}<br><span class="en">${esc(sc.visualPrompt)} — ${esc(sc.motionPrompt)}</span></div>`).join("") + `<div class="scene">Outro : ${esc(s.outro)}<br>Musique : <span class="en">${esc(s.musicMood)}</span><br>Légende : ${esc(s.caption)} ${(s.hashtags || []).map(esc).join(" ")}</div>`; }
  if (r.script?.persona) { const s = r.script; return `<h4>Persona : ${esc(s.persona.name)}</h4>${esc(s.persona.description)}<br><span class="en">${esc(s.persona.imagePrompt)}</span><div class="scene">Hook : <b>${esc(s.hook)}</b><br>🗣 ${esc(s.script)}<br>CTA : <b>${esc(s.cta)}</b> · ≈ ${s.estimatedSeconds} s</div><div class="scene">Hooks écran : ${(s.onScreenHooks || []).map((h) => `<span class="tag">${esc(h)}</span>`).join("")}<br>Légende : ${esc(s.caption)} ${(s.hashtags || []).map(esc).join(" ")}</div>`; }
  return "";
}
function applyJob(el, job) {
  $(".status", el).textContent = job.status; $(".status", el).className = `status ${job.status}`;
  $(".progress i", el).style.width = `${job.progress || 0}%`;
  $(".stage", el).textContent = job.stage || (job.status === "failed" ? `Échec : ${job.error}` : "");
  $(".cost", el).textContent = job.cost ? `${job.cost.toFixed(3)} $` : "";
  $(".log", el).textContent = (job.logs || []).join("\n");
  const res = renderResult(job.kind, job.result);
  const rEl = $(".result", el); rEl.innerHTML = res; rEl.classList.toggle("hidden", !res);
  const outs = $(".outputs", el); outs.innerHTML = ""; (job.outputs || []).forEach((o) => outs.appendChild(renderOutput(o)));
}
function watchJob(job, panel) {
  const el = jobCard(job);
  panel.prepend(el);
  state.jobs[job.id] = job;
  const es = new EventSource(`/api/jobs/${job.id}/events`);
  const j = job;
  es.addEventListener("snapshot", (e) => { Object.assign(j, JSON.parse(e.data)); applyJob(el, j); });
  es.addEventListener("log", (e) => { j.logs.push(JSON.parse(e.data)); const l = $(".log", el); l.textContent = j.logs.join("\n"); l.scrollTop = l.scrollHeight; });
  es.addEventListener("progress", (e) => { const d = JSON.parse(e.data); j.progress = d.progress; j.stage = d.stage; $(".progress i", el).style.width = `${d.progress}%`; $(".stage", el).textContent = d.stage || ""; });
  es.addEventListener("output", (e) => { const o = JSON.parse(e.data); j.outputs.push(o); if (o.cost) j.cost += o.cost; $(".outputs", el).appendChild(renderOutput(o)); $(".cost", el).textContent = j.cost ? `${j.cost.toFixed(3)} $` : ""; });
  es.addEventListener("result", (e) => { j.result = JSON.parse(e.data); const res = renderResult(j.kind, j.result); const rEl = $(".result", el); rEl.innerHTML = res; rEl.classList.toggle("hidden", !res); });
  es.addEventListener("status", (e) => { j.status = JSON.parse(e.data); $(".status", el).textContent = j.status; $(".status", el).className = `status ${j.status}`; if (j.status === "done" || j.status === "failed") { es.close(); api(`/api/jobs/${j.id}`).then((full) => applyJob(el, full)); } });
  es.onerror = () => { /* reconnexion automatique par EventSource */ };
}

// ───────── Tableau de bord
async function loadDashboard() {
  const st = state.status;
  const alert = $("#dash-alert");
  alert.innerHTML = st.mockMode
    ? `<div class="alert warn"><b>Mode démo.</b> Pour générer de vraies images et vidéos, créez une clé sur <a href="https://fal.ai/dashboard/keys" target="_blank">fal.ai</a> (recommandé) et/ou <a href="https://replicate.com/account/api-tokens" target="_blank">Replicate</a>, puis une clé <a href="https://console.anthropic.com/settings/keys" target="_blank">Anthropic</a> pour le directeur créatif. Copiez-les dans <code>studio/.env</code> et redémarrez. Détails dans l'onglet <a href="#connections" onclick="showView('connections')">Connexions</a>.</div>`
    : `<div class="alert ok">Production active via <b>${esc(st.defaultProvider)}</b>${st.claude.available ? ` · directeur créatif <b>${esc(st.claude.model)}</b>` : " · directeur créatif hors ligne (ajoutez ANTHROPIC_API_KEY pour des scripts sur mesure)"}.</div>`;
  const jobs = await api("/api/jobs");
  const total = jobs.reduce((s, j) => s + (j.cost || 0), 0);
  const prov = Object.values(st.providers).filter((p) => p.env);
  $("#dash-cards").innerHTML = `
    <div class="card"><h3>Travaux</h3><div class="big">${jobs.length}</div><p>${jobs.filter((j) => j.status === "done").length} terminés · ${jobs.filter((j) => j.status === "failed").length} échoués</p></div>
    <div class="card"><h3>Dépense estimée</h3><div class="big">${money(total)}</div><p>Somme des coûts estimés des travaux</p></div>
    <div class="card"><h3>Fournisseurs</h3><div class="big">${prov.filter((p) => p.configured).length}/${prov.length}</div><p>${prov.map((p) => `${p.configured ? "✔" : "✘"} ${esc(p.name)}`).join("<br>")}</p></div>
    <div class="card"><h3>Modèles au catalogue</h3><div class="big">${state.catalog.models.length}</div><p>${state.catalog.models.filter((m) => m.openSource).length} open source</p></div>`;
  const list = $("#dash-jobs"); list.innerHTML = "";
  jobs.slice(0, 8).forEach((j) => { const el = jobCard(j); applyJob(el, j); $("details", el).remove(); list.appendChild(el); });
  if (!jobs.length) list.innerHTML = `<p class="lead">Aucun travail pour l'instant. Commencez par un <a href="#logo" onclick="showView('logo')">logo</a> ou une <a href="#video" onclick="showView('video')">vidéo promo</a>.</p>`;
}

// ───────── Bibliothèque
function wireLibrary() { $("#lib-filter").addEventListener("change", loadLibrary); $("#lib-refresh").addEventListener("click", loadLibrary); }
async function loadLibrary() {
  const jobs = (await api("/api/jobs")).filter((j) => !$("#lib-filter").value || j.kind === $("#lib-filter").value);
  const lib = $("#library"); lib.innerHTML = "";
  for (const j of jobs) {
    const el = jobCard(j); applyJob(el, j); $("details", el).remove();
    const del = document.createElement("button"); del.textContent = "Supprimer"; del.className = "danger"; del.style.marginTop = "10px";
    del.onclick = async () => { if (confirm("Supprimer ce travail et ses fichiers ?")) { await api(`/api/jobs/${j.id}?files=1`, { method: "DELETE" }); loadLibrary(); } };
    el.appendChild(del); lib.appendChild(el);
  }
  if (!jobs.length) lib.innerHTML = `<p class="lead">Bibliothèque vide.</p>`;
}

// ───────── Marques
function renderBrandPicker() {
  $("#brand-pick").innerHTML = state.brands.map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join("");
  loadBrandForm(state.brands[0]);
}
function loadBrandForm(b) {
  const f = $("#form-brand"); f.reset(); f._uploads = {}; f.dataset.id = b?.id || "";
  if (!b) { $("#brand-logo-preview").innerHTML = ""; return; }
  for (const k of ["name", "tagline", "language", "description", "audience", "tone", "primary", "secondary", "accent", "fonts", "visualStyle", "avoid", "region"]) if (f.elements[k] && b[k] != null) f.elements[k].value = b[k];
  f.elements.cta.value = (b.cta || []).join("; ");
  $("#brand-logo-preview").innerHTML = b.logo ? `<img src="${b.logo}" alt="logo">` : "";
}
function wireBrandForm() {
  $("#brand-pick").addEventListener("change", (e) => loadBrandForm(state.brands.find((b) => b.id === e.target.value)));
  $("#brand-new").addEventListener("click", () => loadBrandForm(null));
  $("#brand-delete").addEventListener("click", async () => { const id = $("#form-brand").dataset.id; if (id && confirm("Supprimer cette marque ?")) { await api(`/api/brands/${id}`, { method: "DELETE" }); state.brands = await api("/api/brands"); fillBrandSelects(); renderBrandPicker(); } });
  $("#form-brand").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target; const fd = new FormData(f); const b = {};
    for (const [k, v] of fd.entries()) if (f.elements[k].type !== "file") b[k] = v;
    b.cta = b.cta.split(";").map((s) => s.trim()).filter(Boolean);
    const prev = state.brands.find((x) => x.id === f.dataset.id);
    b.id = f.dataset.id || undefined; b.logo = f._uploads?.logo || prev?.logo || null; b.createdAt = prev?.createdAt;
    const saved = await api("/api/brands", { method: "POST", body: b });
    state.brands = await api("/api/brands"); fillBrandSelects(); $("#brand-pick").innerHTML = state.brands.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join(""); $("#brand-pick").value = saved.id; loadBrandForm(saved);
    alert("Marque enregistrée.");
  });
}

// ───────── Connexions & catalogue
function renderProviders() {
  const ps = state.status.providers;
  $("#providers").innerHTML = `<div class="prov">` + Object.entries(ps).map(([id, p]) => `<div class="card"><h3>${esc(p.name)} ${p.configured ? '<span class="tag ok">connecté</span>' : p.env ? '<span class="tag ko">clé manquante</span>' : ""}${p.required ? ' <span class="tag">recommandé</span>' : ""}</h3><p>${esc(p.role)}</p>${p.env ? `<span class="kv">${esc(p.env)}=…</span><p><a href="${p.url}" target="_blank">Obtenir une clé →</a></p>` : ""}<p>${esc(p.fallback || "")}</p></div>`).join("") + `</div>`;
}
function renderCatalog() {
  const task = $("#cat-filter").value, os = $("#cat-os").checked;
  const ms = state.catalog.models.filter((m) => (!task || m.task === task) && (!os || m.openSource));
  const price = (m) => `${m.price.usd} $ / ${{ image: "image", second: "seconde", "1k_chars": "1 000 car.", megapixel: "Mpx" }[m.price.unit] || m.price.unit}${m.price.note ? `<br><small>${esc(m.price.note)}</small>` : ""}`;
  $("#catalog").innerHTML = `<table><thead><tr><th>Modèle</th><th>Tâche</th><th>Fournisseur / endpoint</th><th>Prix indicatif</th><th>Licence</th><th>Qualité</th><th>Idéal pour</th></tr></thead><tbody>` +
    ms.map((m) => `<tr><td><b>${esc(m.name)}</b><br><small>${esc(m.id)}</small></td><td><span class="tag">${esc(m.task)}</span></td><td>${esc(m.provider)}<br><small><code>${esc(m.endpoint)}</code></small>${m.verified ? "" : '<br><span class="tag unv">endpoint à vérifier</span>'}</td><td>${price(m)}</td><td><span class="tag ${m.openSource ? "os" : "prop"}">${m.openSource ? "open source" : "propriétaire"}</span><br><small>${esc(m.license)}</small></td><td><span class="stars">${"★".repeat(m.quality)}${"☆".repeat(5 - m.quality)}</span><br><small>vitesse ${"⚡".repeat(m.speed)}</small></td><td>${esc(m.bestFor)}</td></tr>`).join("") + `</tbody></table>`;
  $("#run-model").innerHTML = state.catalog.models.map((m) => `<option value="${esc(m.id)}">${esc(m.task)} — ${esc(m.name)}</option>`).join("");
}
$("#cat-filter").addEventListener("change", renderCatalog);
$("#cat-os").addEventListener("change", renderCatalog);

function wireRunForm() {
  $("#form-run").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target; const fd = new FormData(f);
    const params = { prompt: fd.get("prompt"), text: fd.get("prompt"), aspect: fd.get("aspect"), duration: Number(fd.get("duration")), ...(f._uploads || {}) };
    if (params.imageUrl) params.refImages = [params.imageUrl];
    try { const job = await api("/api/run", { method: "POST", body: { model: fd.get("model"), params } }); watchJob(job, $("#panel-run")); } catch (err) { alert(err.message); }
  });
}

// ───────── Lightbox
function lightbox(html) { const lb = $("#lightbox"); $(".lightbox-inner", lb).innerHTML = html; lb.classList.remove("hidden"); }
$("#lightbox").addEventListener("click", () => $("#lightbox").classList.add("hidden"));

window.showView = showView;
init().catch((e) => { document.body.innerHTML = `<pre style="padding:20px;color:#f88">Erreur de chargement : ${esc(e.message)}</pre>`; });
