// Macro Tracker app: state, rendering and all interactions. Data lives in this device's localStorage.
(function () {
  const VERSION = "1.1.0";
  const KEY = "mt.v1", THEME_KEY = "mt.theme";
  // macros are a share of daily calories: protein and carbs 4 cal/g, fat 9 cal/g
  const DEFAULT_GOALS = { cal: 2110, pp: 34, pc: 39, pf: 27, water: 3700 };
  const KCAL_PER_G = { p: 4, c: 4, f: 9 };
  const WATER_STEP = 250;

  const MEALS = [
    { k: "breakfast", label: "Desayuno", icon: '<path d="M12 3v2"/><path d="m5.6 7.6 1.4 1.4"/><path d="m18.4 7.6-1.4 1.4"/><path d="M3 17h18"/><path d="M7 17a5 5 0 0 1 10 0"/><path d="M8 21h8"/>' },
    { k: "lunch", label: "Comida", icon: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>' },
    { k: "dinner", label: "Cena", icon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>' },
    { k: "snacks", label: "Snacks", icon: '<path d="M12 7c-1-2-3-3-5-2.5C4 5.3 3.5 9 4.5 12.5 5.6 16.5 8 20 10 20c.8 0 1.3-.4 2-.4s1.2.4 2 .4c2 0 4.4-3.5 5.5-7.5 1-3.5.5-7.2-2.5-8-2-.5-4 .5-5 2.5Z"/><path d="M12 7c0-2 1-3.5 2.5-4"/>' },
  ];
  const MEAL_KEYS = MEALS.map(m => m.k);
  const MACROS = [
    { k: "p", label: "Proteína", color: "var(--protein)" },
    { k: "c", label: "Carbos", color: "var(--carbs)" },
    { k: "f", label: "Grasa", color: "var(--fat)" },
  ];

  /* ---------- storage ---------- */
  function readLS(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function writeLS(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function loadState() {
    let s = null;
    try { s = JSON.parse(readLS(KEY) || "null"); } catch (e) { s = null; }
    s = s || {};
    return {
      log: Array.isArray(s.log) ? s.log : [],
      water: s.water && typeof s.water === "object" ? s.water : {},
      goals: normGoals(s.goals),
      recents: Array.isArray(s.recents) ? s.recents : [],
      custom: Array.isArray(s.custom) ? s.custom : [],
    };
  }
  // accepts current goals ({cal, pp, pc, pf, water}) and the older gram-based ones ({cal, p, c, f, water})
  function normGoals(g) {
    g = g && typeof g === "object" ? g : {};
    const cal = +g.cal > 0 ? +g.cal : DEFAULT_GOALS.cal;
    const water = +g.water > 0 ? +g.water : DEFAULT_GOALS.water;
    if (+g.pp >= 0 && +g.pc >= 0 && +g.pf >= 0 && Math.abs(+g.pp + +g.pc + +g.pf - 100) < 0.6) {
      return { cal, pp: +g.pp, pc: +g.pc, pf: +g.pf, water };
    }
    if (+g.p > 0 && +g.c > 0 && +g.f > 0) {
      const kp = g.p * 4, kc = g.c * 4, kf = g.f * 9, sum = kp + kc + kf;
      const pp = Math.round(kp / sum * 100), pc = Math.round(kc / sum * 100);
      return { cal, pp, pc, pf: 100 - pp - pc, water };
    }
    return { ...DEFAULT_GOALS, cal, water };
  }
  function gramsFor(cal, pct, k) { return cal * pct / 100 / KCAL_PER_G[k]; }
  function targets() {
    const g = S.goals;
    return { cal: g.cal, water: g.water, p: gramsFor(g.cal, g.pp, "p"), c: gramsFor(g.cal, g.pc, "c"), f: gramsFor(g.cal, g.pf, "f") };
  }

  const S = loadState();
  function save() {
    if (!writeLS(KEY, JSON.stringify(S))) toast("No se pudo guardar en este dispositivo. Revisa el espacio o el modo privado.");
  }

  /* ---------- dates & numbers ---------- */
  const pad = n => String(n).padStart(2, "0");
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseD = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return ymd(d); };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const fmt = n => Math.round(n).toLocaleString("es-ES");
  const fmt1 = n => (Math.round(n * 10) / 10).toLocaleString("es-ES");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  let today = ymd(new Date());
  let view = today;
  const $ = id => document.getElementById(id);

  function mealForNow() {
    const h = new Date().getHours();
    return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 19 ? "snacks" : "dinner";
  }

  function totals(date) {
    const t = { cal: 0, p: 0, c: 0, f: 0, n: 0 };
    for (const it of S.log) if (it.date === date) { t.cal += +it.cal || 0; t.p += +it.p || 0; t.c += +it.c || 0; t.f += +it.f || 0; t.n++; }
    return t;
  }

  /* ---------- main render ---------- */
  let shownCal = 0, calAnim = 0;
  function countUp(to) {
    cancelAnimationFrame(calAnim);
    const from = shownCal, start = performance.now(), dur = 900;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = now => {
      const k = reduce ? 1 : Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - k, 3);
      shownCal = from + (to - from) * e;
      $("calNum").textContent = fmt(shownCal);
      if (k < 1) calAnim = requestAnimationFrame(step); else shownCal = to;
    };
    calAnim = requestAnimationFrame(step);
  }

  const C_HERO = 2 * Math.PI * 94;
  function render() {
    const G = targets(), t = totals(view);
    const yest = addDays(today, -1);
    $("title").textContent = view === today ? "Hoy" : view === yest ? "Ayer" : cap(parseD(view).toLocaleDateString("es-ES", { weekday: "long" }));
    $("date").textContent = cap(parseD(view).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: view.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric" }));
    $("todayBtn").classList.toggle("on", view === today);
    $("nextBtn").disabled = view >= today;

    const ring = $("calRing");
    ring.style.strokeDasharray = C_HERO;
    ring.style.strokeDashoffset = C_HERO * (1 - Math.min(1, G.cal ? t.cal / G.cal : 0));
    countUp(Math.round(t.cal));
    $("calOf").textContent = `de ${fmt(G.cal)} cal`;
    const left = G.cal - Math.round(t.cal);
    $("calLeft").textContent = left >= 0 ? `${fmt(left)} restantes` : `${fmt(-left)} por encima`;
    $("calLeft").classList.toggle("over", left < 0);
    $("hsItems").textContent = t.n;
    $("hsPct").textContent = (G.cal ? Math.round(t.cal / G.cal * 100) : 0) + "%";
    const week = Array.from({ length: 7 }, (_, i) => totals(addDays(view, i - 6)).cal).filter(v => v > 0);
    $("hsAvg").textContent = week.length ? fmt(week.reduce((a, b) => a + b, 0) / week.length) : "—";

    const C = 2 * Math.PI * 32;
    $("macros").innerHTML = MACROS.map(m => {
      const v = t[m.k], goal = G[m.k] || 1, pct = Math.min(1, v / goal);
      return `<div class="macro">
        <div class="mring"><svg viewBox="0 0 78 78" aria-hidden="true">
          <circle cx="39" cy="39" r="32" fill="none" stroke="var(--track)" stroke-width="8"/>
          <circle class="prog" data-off="${C * (1 - pct)}" cx="39" cy="39" r="32" fill="none" stroke="${m.color}" stroke-width="8" stroke-linecap="round" style="stroke-dasharray:${C};stroke-dashoffset:${C}"/>
        </svg><div class="pct num">${Math.round(v / goal * 100)}%</div></div>
        <div class="nm"><span class="dot" style="background:${m.color}"></span>${m.label}</div>
        <div class="g num">${fmt(v)} / ${fmt(G[m.k])} g</div>
      </div>`;
    }).join("");
    requestAnimationFrame(() => requestAnimationFrame(() =>
      document.querySelectorAll("#macros .prog").forEach(c => { c.style.strokeDashoffset = c.dataset.off; })));

    const w = S.water[view] || 0;
    $("wVal").textContent = (w / 1000).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " L";
    $("wGoal").textContent = "/ " + (G.water / 1000).toLocaleString("es-ES", { maximumFractionDigits: 2 }) + " L";
    $("wBar").style.width = Math.min(100, G.water ? w / G.water * 100 : 0) + "%";
    $("wMinus").disabled = w <= 0;
    $("histGoal").textContent = `objetivo ${fmt(G.cal)}`;

    renderChart();
    renderDiary();
  }

  function renderChart() {
    const G = targets();
    const W = 330, H = 150, top = 18, base = 118, side = 6;
    const days = Array.from({ length: 7 }, (_, i) => addDays(view, i - 6));
    const vals = days.map(d => totals(d).cal);
    const max = Math.max(G.cal * 1.2, ...vals, 1);
    const y = v => base - (v / max) * (base - top);
    const slot = (W - side * 2) / 7, bw = 26;
    const letters = ["D", "L", "M", "X", "J", "V", "S"];
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Calorías de los últimos 7 días frente al objetivo">
      <defs><linearGradient id="gbar" x1="0" y1="1" x2="0" y2="0"><stop offset="0" class="stop-a"/><stop offset="1" class="stop-b"/></linearGradient></defs>
      <line x1="${side}" x2="${W - side}" y1="${base}" y2="${base}" stroke="var(--line)" stroke-width="1"/>`;
    days.forEach((d, i) => {
      const v = vals[i], cx = side + slot * i + slot / 2, isView = d === view;
      const h = v > 0 ? Math.max(4, base - y(v)) : 3;
      const fill = v > G.cal * 1.05 ? "var(--fat)" : v > 0 ? "url(#gbar)" : "var(--track)";
      s += `<rect x="${cx - bw / 2}" y="${base - h}" width="${bw}" height="${h}" rx="7" fill="${fill}" opacity="${isView || v === 0 ? 1 : .55}"/>`;
      if (v > 0) s += `<text x="${cx}" y="${base - h - 6}" text-anchor="middle" font-size="10.5" font-weight="600" fill="var(--fg-2)">${fmt(v)}</text>`;
      s += `<text x="${cx}" y="${base + 20}" text-anchor="middle" font-size="12" font-weight="${isView ? 700 : 500}" fill="${isView ? "var(--fg)" : "var(--fg-3)"}">${letters[parseD(d).getDay()]}</text>`;
      if (isView) s += `<circle cx="${cx}" cy="${base + 30}" r="2.5" fill="var(--accent-2)"/>`;
    });
    const ty = y(G.cal);
    s += `<line x1="${side}" x2="${W - side}" y1="${ty}" y2="${ty}" stroke="var(--fg-3)" stroke-width="1" stroke-dasharray="3 4" opacity=".8"/></svg>`;
    $("chart").innerHTML = s;
  }

  function macroLine(p, c, f) {
    return `<em><span class="dot" style="background:var(--protein)"></span>P ${fmt(p)} g</em><em><span class="dot" style="background:var(--carbs)"></span>C ${fmt(c)} g</em><em><span class="dot" style="background:var(--fat)"></span>G ${fmt(f)} g</em>`;
  }

  function renderDiary() {
    const items = S.log.filter(i => i.date === view);
    let html = "";
    if (!items.length) {
      html += `<div class="card hint">${view === today
        ? `Aún no hay nada hoy. Toca <b>+</b> para buscar un alimento, escanear un código de barras o añadir algo rápido.`
        : `No hay nada registrado este día. Puedes añadirlo con <b>+</b>.`}</div>`;
    }
    for (const m of MEALS) {
      const list = items.filter(i => (MEAL_KEYS.includes(i.meal) ? i.meal : "snacks") === m.k);
      const kcal = list.reduce((a, i) => a + (+i.cal || 0), 0);
      html += `<div class="card meal">
        <div class="mhead"><span class="mico"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${m.icon}</svg></span>
        <h3>${m.label}</h3><span class="k num">${list.length ? fmt(kcal) + " cal" : ""}</span>
        <button class="addmini" data-add="${m.k}" aria-label="Añadir a ${m.label}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button></div>
        ${list.length ? list.map(i => `<div class="item">
          <div class="dots" aria-hidden="true"><i style="background:var(--protein)"></i><i style="background:var(--carbs)"></i><i style="background:var(--fat)"></i></div>
          <button class="it" data-edit="${esc(i.id)}" aria-label="Editar ${esc(i.name)}"><div class="n">${esc(i.name)}</div>${i.serving ? `<div class="s">${esc(i.serving)}</div>` : ""}
            <div class="m num">${macroLine(i.p, i.c, i.f)}</div></button>
          <div class="ical num">${fmt(i.cal)}<small>cal</small></div>
          <button class="del" data-del="${esc(i.id)}" aria-label="Eliminar ${esc(i.name)}"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l6 6M9 3 3 9"/></svg></button>
        </div>`).join("") : `<div class="empty">Sin registros</div>`}
      </div>`;
    }
    $("diary").innerHTML = html;
  }

  /* ---------- toast ---------- */
  let toastTimer = 0, toastUndo = null;
  function toast(msg, undo) {
    $("toastMsg").textContent = msg;
    toastUndo = undo || null;
    $("toastAction").hidden = !undo;
    $("toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("toast").classList.remove("show"), undo ? 5000 : 2600);
  }
  $("toastAction").onclick = () => { if (toastUndo) toastUndo(); toastUndo = null; $("toast").classList.remove("show"); };

  /* ---------- sheets ---------- */
  const openSheets = [];
  function openSheet(id) {
    const el = $(id);
    el.hidden = false;
    if (!openSheets.includes(id)) openSheets.push(id);
    document.body.style.overflow = "hidden";
  }
  function closeSheet(id) {
    const el = $(id);
    if (el.hidden) return;
    el.hidden = true;
    const i = openSheets.indexOf(id);
    if (i >= 0) openSheets.splice(i, 1);
    if (id === "scanSheet") Scanner.stop();
    if (!openSheets.length) document.body.style.overflow = "";
  }
  document.querySelectorAll(".sheet").forEach(sh => {
    sh.addEventListener("click", e => {
      if (e.target === sh || e.target.closest("[data-close]")) closeSheet(sh.id);
    });
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && openSheets.length) closeSheet(openSheets[openSheets.length - 1]); });

  function mealChips(containerId, selected, onPick) {
    const el = $(containerId);
    el.innerHTML = MEALS.map(m => `<button type="button" class="chip" role="radio" data-meal="${m.k}" aria-checked="${m.k === selected}">${m.label}</button>`).join("");
    el.onclick = e => {
      const b = e.target.closest("[data-meal]"); if (!b) return;
      el.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-checked", c === b));
      onPick(b.dataset.meal);
    };
  }

  /* ---------- add sheet & search ---------- */
  let addMeal = "lunch";
  let resultMap = new Map();
  let offReq = 0, offTimer = 0, offPage = 1, offFoods = [], offState = "idle", offQuery = "";

  function openAdd(meal) {
    addMeal = meal || (view === today ? mealForNow() : "lunch");
    mealChips("addMeal", addMeal, k => { addMeal = k; });
    $("q").value = "";
    resetOff();
    renderResults();
    openSheet("addSheet");
    Foods.load().then(() => renderResults()).catch(() => renderResults());
    setTimeout(() => $("q").focus(), 250);
  }

  function resetOff() { offReq++; clearTimeout(offTimer); offPage = 1; offFoods = []; offState = "idle"; offQuery = ""; }

  function row(food, tag) {
    resultMap.set(food.key, food);
    const per = food.src === "custom" || food.src === "quick" ? food.units[0].l : "100 g";
    return `<button class="row" data-food="${esc(food.key)}">
      <div class="it"><div class="n">${tag ? `<span class="tag ${tag[0]}">${tag[1]}</span>` : ""}${esc(food.name)}</div><div class="s">${esc(food.sub)}</div></div>
      <div class="kc num"><b>${fmt(food.n.kcal)}</b><span>cal / ${esc(per)}</span></div></button>`;
  }

  function matchCustom(q) {
    const nq = Foods.norm(q).trim().split(" ").filter(Boolean);
    return S.custom.filter(f => { const t = Foods.norm(f.name + " " + f.sub); return nq.every(w => t.includes(" " + w)); });
  }

  function renderResults() {
    const q = $("q").value.trim();
    resultMap = new Map();
    let h = "";
    if (!q) {
      if (S.recents.length) {
        h += `<div class="rsec"><div class="label">Recientes</div></div>`;
        h += S.recents.slice(0, 25).map(r => row(r.food)).join("");
      }
      if (S.custom.length) {
        h += `<div class="rsec"><div class="label">Mis alimentos</div></div>`;
        h += S.custom.map(f => row(f, ["mine", "Mío"])).join("");
      }
      if (!S.recents.length && !S.custom.length) {
        h += `<div class="status">Busca entre ${Foods.count() ? fmt(Foods.count()) : "8.789"} alimentos e ingredientes, o entre millones de productos de marca de Open Food Facts. También puedes escanear un código de barras.</div>`;
      }
      $("results").innerHTML = h;
      return;
    }
    const mine = matchCustom(q);
    if (mine.length) {
      h += `<div class="rsec"><div class="label">Mis alimentos</div></div>` + mine.map(f => row(f, ["mine", "Mío"])).join("");
    }
    const boost = new Set(S.recents.map(r => r.food.key));
    const local = Foods.search(q, boost, 40);
    h += `<div class="rsec"><div class="label">Alimentos</div><small>USDA</small></div>`;
    if (!Foods.count()) h += `<div class="status"><span class="spinner"></span>Cargando base de alimentos…</div>`;
    else if (!local.length) h += `<div class="status">Nada en la base local. Prueba con otra palabra o mira los productos de abajo.</div>`;
    else h += local.map(f => row(f)).join("");

    h += `<div class="rsec"><div class="label">Productos de marca</div><small><a href="https://world.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a></small></div>`;
    if (q.length < 3) h += `<div class="status">Escribe al menos 3 letras para buscar productos.</div>`;
    else {
      h += offFoods.map(f => row(f, ["off", "Marca"])).join("");
      if (offState === "loading") h += `<div class="status"><span class="spinner"></span>Buscando productos…</div>`;
      else if (offState === "error") h += `<div class="status">No se pudo conectar con Open Food Facts. <button class="pill ghost more" data-retry>Reintentar</button></div>`;
      else if (offState === "done" && !offFoods.length) h += `<div class="status">Sin productos para “${esc(q)}”.</div>`;
      else if (offState === "more") h += `<button class="pill ghost more" data-more>Ver más productos</button>`;
    }
    $("results").innerHTML = h;
  }

  function runOff(page) {
    const q = $("q").value.trim();
    if (q.length < 3) return;
    const req = ++offReq;
    offQuery = q; offPage = page; offState = "loading";
    renderResults();
    OFF.search(q, page).then(res => {
      if (req !== offReq) return;
      offFoods = page === 1 ? res.foods : offFoods.concat(res.foods);
      offState = res.more ? "more" : "done";
      renderResults();
    }).catch(() => {
      if (req !== offReq) return;
      offState = "error";
      renderResults();
    });
  }

  $("q").addEventListener("input", () => {
    resetOff();
    renderResults();
    const q = $("q").value.trim();
    if (q.length >= 3) offTimer = setTimeout(() => runOff(1), 700);
  });
  $("q").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); clearTimeout(offTimer); if (offState === "idle") runOff(1); $("q").blur(); }
  });
  $("results").addEventListener("click", e => {
    if (e.target.closest("[data-more]")) { runOff(offPage + 1); return; }
    if (e.target.closest("[data-retry]")) { runOff(offPage); return; }
    const b = e.target.closest("[data-food]");
    if (b && resultMap.has(b.dataset.food)) openFood(resultMap.get(b.dataset.food), { meal: addMeal });
  });

  /* ---------- food detail ---------- */
  let fd = null; // { food, unit, qty, meal, editId }

  function openFood(food, opts) {
    const recent = S.recents.find(r => r.food.key === food.key);
    let unit = opts.unit ?? (recent ? recent.u : food.def ?? 0);
    if (!food.units[unit]) unit = 0;
    const qty = opts.qty ?? (recent ? recent.q : food.qty ?? 1);
    fd = { food, unit, qty, meal: opts.meal || "lunch", editId: opts.editId || null };
    $("fdName").textContent = food.name;
    $("fdSub").textContent = food.sub || "";
    $("fdQty").value = qty;
    $("fdUnits").innerHTML = food.units.map((u, i) => `<button type="button" class="chip" role="radio" data-unit="${i}" aria-checked="${i === unit}">${esc(u.l)}</button>`).join("");
    mealChips("fdMeal", fd.meal, k => { fd.meal = k; });
    const per = food.units[0].g ? "100 g" : food.units[0].l;
    $("fdPer").textContent = `Por ${per}: ${fmt(food.n.kcal)} cal · P ${fmt1(food.n.p)} g · C ${fmt1(food.n.c)} g · G ${fmt1(food.n.f)} g` +
      (food.src === "usda" ? " · Fuente: USDA SR28" : food.src === "off" ? " · Fuente: Open Food Facts" : "");
    $("fdSave").textContent = fd.editId ? "Guardar cambios" : "Añadir";
    updateFood();
    openSheet("foodSheet");
  }

  function calc() {
    const u = fd.food.units[fd.unit], k = (parseFloat(fd.qty) || 0) * u.f, n = fd.food.n;
    return { cal: n.kcal * k, p: n.p * k, c: n.c * k, f: n.f * k };
  }
  function servingText() {
    const u = fd.food.units[fd.unit], q = parseFloat(fd.qty) || 0;
    if (u.g) return `${fmt1(q)} g`;
    return q === 1 ? u.l : `${fmt1(q)} × ${u.l}`;
  }
  function updateFood() {
    const r = calc();
    $("fdKcal").textContent = fmt(r.cal);
    $("fdP").textContent = fmt1(r.p);
    $("fdC").textContent = fmt1(r.c);
    $("fdF").textContent = fmt1(r.f);
    $("fdSave").disabled = !(parseFloat(fd.qty) > 0);
  }
  $("fdQty").addEventListener("input", () => { fd.qty = $("fdQty").value; updateFood(); });
  function stepQty(dir) {
    const u = fd.food.units[fd.unit];
    const q = parseFloat(fd.qty) || 0, step = u.g ? (q >= 100 ? 25 : 10) : 0.5;
    fd.qty = Math.max(0, Math.round((q + dir * step) * 100) / 100);
    $("fdQty").value = fd.qty;
    updateFood();
  }
  $("fdMinus").onclick = () => stepQty(-1);
  $("fdPlusBtn").onclick = () => stepQty(1);
  $("fdUnits").onclick = e => {
    const b = e.target.closest("[data-unit]"); if (!b) return;
    const next = +b.dataset.unit;
    if (next === fd.unit) return;
    // keep the same amount of food when switching units
    const grams = (parseFloat(fd.qty) || 0) * fd.food.units[fd.unit].f;
    fd.unit = next;
    const nf = fd.food.units[next].f;
    fd.qty = fd.food.units[next].g ? Math.round(grams / nf) : (grams > 0 ? Math.round(grams / nf * 4) / 4 || 1 : 1);
    $("fdQty").value = fd.qty;
    $("fdUnits").querySelectorAll(".chip").forEach(c => c.setAttribute("aria-checked", c === b));
    updateFood();
  };

  function snapshot(food) {
    return { key: food.key, src: food.src, ref: food.ref, name: food.name, sub: food.sub, n: food.n, units: food.units, def: food.def, qty: food.qty };
  }
  function remember(food, u, q) {
    S.recents = [{ food: snapshot(food), u, q: parseFloat(q) || 1, t: Date.now() }, ...S.recents.filter(r => r.food.key !== food.key)].slice(0, 40);
  }
  function round1(v) { return Math.round(v * 10) / 10; }

  $("fdSave").onclick = () => {
    const r = calc();
    const fields = {
      meal: fd.meal, name: fd.food.name, serving: servingText(),
      cal: Math.round(r.cal), p: round1(r.p), c: round1(r.c), f: round1(r.f),
      food: snapshot(fd.food), u: fd.unit, q: parseFloat(fd.qty) || 0,
    };
    if (fd.editId) {
      const it = S.log.find(i => i.id === fd.editId);
      if (it) Object.assign(it, fields);
      toast("Cambios guardados");
    } else {
      S.log.push({ id: uid(), date: view, ...fields });
      toast(`Añadido a ${MEALS.find(m => m.k === fd.meal).label}: ${fmt(r.cal)} cal`);
    }
    if (fd.food.src !== "quick") remember(fd.food, fd.unit, fd.qty);
    save();
    closeSheet("foodSheet");
    closeSheet("addSheet");
    render();
  };

  function editItem(id) {
    const it = S.log.find(i => i.id === id);
    if (!it) return;
    const food = it.food || {
      key: "x" + it.id, src: "quick", name: it.name, sub: it.serving || "",
      n: { kcal: +it.cal || 0, p: +it.p || 0, c: +it.c || 0, f: +it.f || 0 }, units: [{ l: it.serving || "porción", f: 1 }],
    };
    openFood(food, { meal: it.meal, editId: it.id, unit: it.food ? it.u : 0, qty: it.food ? it.q : 1 });
  }

  /* ---------- quick add ---------- */
  function openQuick() {
    $("quickForm").reset();
    $("qkSave").checked = true;
    $("qkMsg").textContent = "";
    let qkMeal = addMeal;
    mealChips("qkMeal", qkMeal, k => { qkMeal = k; $("quickForm").dataset.meal = k; });
    $("quickForm").dataset.meal = qkMeal;
    const q = $("q").value.trim();
    if (q) $("qkName").value = q;
    openSheet("quickSheet");
  }
  $("quickBtn").onclick = openQuick;
  $("quickForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("qkName").value.trim(), cal = parseFloat($("qkCal").value);
    if (!name || !(cal >= 0)) { $("qkMsg").textContent = "Escribe un nombre y las calorías."; $("qkMsg").className = "formmsg err"; return; }
    const serving = $("qkServing").value.trim() || "porción";
    const n = { kcal: Math.round(cal), p: round1(parseFloat($("qkP").value) || 0), c: round1(parseFloat($("qkC").value) || 0), f: round1(parseFloat($("qkF").value) || 0) };
    const meal = $("quickForm").dataset.meal || addMeal;
    let food = { key: "q" + uid(), src: "quick", name, sub: serving, n, units: [{ l: serving, f: 1 }], def: 0, qty: 1 };
    if ($("qkSave").checked) {
      food = { ...food, key: "c" + uid(), src: "custom", sub: serving };
      S.custom.unshift(food);
    }
    S.log.push({ id: uid(), date: view, meal, name, serving, cal: n.kcal, p: n.p, c: n.c, f: n.f, food: snapshot(food), u: 0, q: 1 });
    save();
    closeSheet("quickSheet");
    closeSheet("addSheet");
    render();
    toast(`Añadido: ${name}`);
  });

  /* ---------- barcode ---------- */
  function openScan() {
    $("codeInput").value = "";
    $("scanMsg").textContent = "Apunta la cámara al código de barras.";
    $("scanMsg").className = "formmsg";
    openSheet("scanSheet");
    Scanner.start($("scanVideo"), lookup).catch(err => {
      $("scanMsg").textContent = err && err.friendly ? err.message
        : err && (err.name === "NotAllowedError" || err.name === "SecurityError")
          ? "Sin permiso para la cámara. Actívalo en los ajustes del navegador o escribe el número del código."
          : err && (err.name === "NotFoundError" || err.name === "OverconstrainedError")
            ? "No encontré ninguna cámara. Escribe el número del código."
            : "No se pudo abrir la cámara. Escribe el número del código.";
      $("scanMsg").className = "formmsg err";
    });
  }
  async function lookup(code) {
    code = String(code).replace(/\D/g, "");
    if (!code) return;
    if (navigator.vibrate) navigator.vibrate(40);
    $("scanMsg").innerHTML = `<span class="spinner"></span>Buscando ${esc(code)} en Open Food Facts…`;
    $("scanMsg").className = "formmsg";
    try {
      const food = await OFF.barcode(code);
      if (!food) {
        $("scanMsg").textContent = `No encontré el código ${code} (o no tiene calorías). Usa Añadir rápido con los datos de la etiqueta.`;
        $("scanMsg").className = "formmsg err";
        return;
      }
      closeSheet("scanSheet");
      openFood(food, { meal: addMeal });
    } catch (e) {
      $("scanMsg").textContent = "No se pudo conectar con Open Food Facts. Revisa tu conexión e inténtalo de nuevo.";
      $("scanMsg").className = "formmsg err";
    }
  }
  $("scanBtn").onclick = openScan;
  $("codeForm").addEventListener("submit", e => { e.preventDefault(); Scanner.stop(); lookup($("codeInput").value); });

  /* ---------- diary & day interactions ---------- */
  $("prevBtn").onclick = () => { view = addDays(view, -1); render(); };
  $("nextBtn").onclick = () => { if (view < today) { view = addDays(view, 1); render(); } };
  $("todayBtn").onclick = () => { view = today; render(); };
  $("fab").onclick = () => openAdd();
  function setWater(delta) { S.water[view] = Math.max(0, (S.water[view] || 0) + delta); save(); render(); }
  $("wPlus").onclick = () => setWater(WATER_STEP);
  $("wMinus").onclick = () => setWater(-WATER_STEP);

  $("diary").addEventListener("click", e => {
    const add = e.target.closest("[data-add]");
    if (add) { openAdd(add.dataset.add); return; }
    const del = e.target.closest("[data-del]");
    if (del) {
      const idx = S.log.findIndex(i => i.id === del.dataset.del);
      if (idx < 0) return;
      const [removed] = S.log.splice(idx, 1);
      save(); render();
      toast(`Eliminado: ${removed.name}`, () => { S.log.splice(idx, 0, removed); save(); render(); });
      return;
    }
    const ed = e.target.closest("[data-edit]");
    if (ed) editItem(ed.dataset.edit);
  });

  /* ---------- settings, backup ---------- */
  function b64encode(obj) { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); }
  function b64decode(str) { return JSON.parse(decodeURIComponent(escape(atob(str.replace(/\s+/g, ""))))); }
  function slimItem(i) { return { id: i.id, date: i.date, meal: i.meal, name: i.name, serving: i.serving, cal: i.cal, p: i.p, c: i.c, f: i.f }; }
  function saveCode() { return "MT1:" + b64encode({ v: 1, log: S.log.map(slimItem), water: S.water, goals: S.goals }); }
  function cleanItem(i, fallbackDate) {
    const meal = MEAL_KEYS.includes(i.meal) ? i.meal : "snacks";
    return {
      id: String(i.id || uid()), date: /^\d{4}-\d{2}-\d{2}$/.test(i.date || "") ? i.date : fallbackDate, meal,
      name: String(i.name || "Alimento"), serving: i.serving ? String(i.serving) : "",
      cal: Math.round(+i.cal || 0), p: round1(+i.p || 0), c: round1(+i.c || 0), f: round1(+i.f || 0),
    };
  }
  function msg(id, text, cls) { $(id).textContent = text; $(id).className = "formmsg " + (cls || ""); }

  function readGoalsForm() {
    return { cal: +$("gCal").value, pp: +$("gPP").value, pc: +$("gPC").value, pf: +$("gPF").value, water: Math.round(+$("gWater").value * 1000) };
  }
  function updateGoalsPreview() {
    const v = readGoalsForm(), cal = v.cal > 0 ? v.cal : 0, sum = v.pp + v.pc + v.pf;
    $("gPg").textContent = fmt(gramsFor(cal, v.pp || 0, "p")) + " g";
    $("gCg").textContent = fmt(gramsFor(cal, v.pc || 0, "c")) + " g";
    $("gFg").textContent = fmt(gramsFor(cal, v.pf || 0, "f")) + " g";
    const scale = sum > 0 ? 100 / Math.max(sum, 100) : 0;
    $("sbP").style.width = (v.pp || 0) * scale + "%";
    $("sbC").style.width = (v.pc || 0) * scale + "%";
    $("sbF").style.width = (v.pf || 0) * scale + "%";
    const ok = Math.abs(sum - 100) < 0.6;
    $("gSum").textContent = ok ? "Total: 100 %" : `Total: ${fmt1(sum)} %. Ajusta los porcentajes para que sumen 100 %.`;
    $("gSum").className = "sumrow num" + (ok ? "" : " bad");
    document.querySelectorAll("#presets .chip").forEach(c => {
      const [a, b, d] = c.dataset.split.split(",").map(Number);
      c.setAttribute("aria-pressed", a === v.pp && b === v.pc && d === v.pf);
    });
  }
  ["gCal", "gPP", "gPC", "gPF", "gWater"].forEach(id => $(id).addEventListener("input", () => { msg("goalsMsg", ""); updateGoalsPreview(); }));
  $("presets").onclick = e => {
    const b = e.target.closest("[data-split]"); if (!b) return;
    const [a, c, f] = b.dataset.split.split(",");
    $("gPP").value = a; $("gPC").value = c; $("gPF").value = f;
    msg("goalsMsg", "");
    updateGoalsPreview();
  };

  function openSettings() {
    const G = S.goals;
    $("gCal").value = G.cal; $("gPP").value = G.pp; $("gPC").value = G.pc; $("gPF").value = G.pf; $("gWater").value = G.water / 1000;
    updateGoalsPreview();
    msg("goalsMsg", ""); msg("backupMsg", "");
    $("wipeConfirm").hidden = true;
    $("ver").textContent = `Versión ${VERSION} · ${Foods.count() ? fmt(Foods.count()) : "8.789"} alimentos sin conexión`;
    openSheet("settingsSheet");
  }
  $("settingsBtn").onclick = openSettings;
  $("goalsForm").addEventListener("submit", e => {
    e.preventDefault();
    const v = readGoalsForm();
    if (!(v.cal > 0) || !(v.water > 0)) { msg("goalsMsg", "Las calorías y el agua deben ser mayores que cero.", "err"); return; }
    if ([v.pp, v.pc, v.pf].some(x => !(x >= 0))) { msg("goalsMsg", "Los porcentajes no pueden ser negativos.", "err"); return; }
    if (Math.abs(v.pp + v.pc + v.pf - 100) >= 0.6) { msg("goalsMsg", "Los porcentajes deben sumar 100 %.", "err"); return; }
    S.goals = v; save(); render();
    const G = targets();
    msg("goalsMsg", `Guardado: ${fmt(G.cal)} cal · P ${fmt(G.p)} g · C ${fmt(G.c)} g · G ${fmt(G.f)} g.`, "ok");
  });
  $("copyCode").onclick = () => {
    const code = saveCode();
    const fallback = () => { $("codeBox").value = code; $("codeBox").focus(); $("codeBox").select(); msg("backupMsg", "No pude copiar automáticamente. El código está seleccionado: cópialo a mano."); };
    try { navigator.clipboard.writeText(code).then(() => msg("backupMsg", "Código copiado. Guárdalo en un lugar seguro.", "ok"), fallback); }
    catch (e) { fallback(); }
  };
  $("importCode").onclick = () => {
    const raw = $("codeBox").value.trim();
    try {
      if (raw.startsWith("MT1:")) {
        const d = b64decode(raw.slice(4));
        if (!Array.isArray(d.log)) throw new Error();
        S.log = d.log.map(i => cleanItem(i, today));
        S.water = d.water && typeof d.water === "object" ? d.water : {};
        if (d.goals) S.goals = normGoals(d.goals);
        save(); render();
        msg("backupMsg", `Restaurado: ${S.log.length} alimentos.`, "ok");
      } else if (raw.startsWith("MTA:")) {
        const d = b64decode(raw.slice(4));
        const items = Array.isArray(d.items) ? d.items : Array.isArray(d) ? d : null;
        if (!items) throw new Error();
        const ids = new Set(S.log.map(i => i.id));
        let added = 0;
        for (const i of items) {
          const it = cleanItem(i, view);
          if (ids.has(it.id)) continue;
          S.log.push(it); ids.add(it.id); added++;
        }
        if (d.water && typeof d.water === "object") for (const [k, ml] of Object.entries(d.water)) S.water[k] = Math.max(S.water[k] || 0, +ml || 0);
        save(); render();
        msg("backupMsg", added === 1 ? "Añadido 1 alimento." : added ? `Añadidos ${added} alimentos.` : "Esos alimentos ya estaban en tu diario.", "ok");
      } else throw new Error();
      $("codeBox").value = "";
    } catch (e) {
      msg("backupMsg", "Ese código no es válido. Debe empezar por MT1: o MTA: y estar completo.", "err");
    }
  };
  $("wipeBtn").onclick = () => { $("wipeConfirm").hidden = false; };
  $("wipeNo").onclick = () => { $("wipeConfirm").hidden = true; };
  $("wipeYes").onclick = () => {
    S.log = []; S.water = {}; S.recents = []; S.custom = [];
    save(); render();
    $("wipeConfirm").hidden = true;
    closeSheet("settingsSheet");
    toast("Datos borrados");
  };

  /* ---------- theme ---------- */
  const sun = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const moon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/></svg>';
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const isDark = () => (document.documentElement.dataset.theme || (mq.matches ? "dark" : "light")) === "dark";
  function applyTheme() {
    $("themeBtn").innerHTML = isDark() ? sun : moon;
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute("content", bg));
  }
  const savedTheme = readLS(THEME_KEY);
  if (savedTheme === "dark" || savedTheme === "light") document.documentElement.dataset.theme = savedTheme;
  $("themeBtn").onclick = () => {
    const t = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = t;
    writeLS(THEME_KEY, t);
    applyTheme();
  };
  mq.addEventListener("change", applyTheme);

  /* ---------- day rollover, offline ---------- */
  function checkDay() {
    const t = ymd(new Date());
    if (t !== today) { const wasToday = view === today; today = t; if (wasToday) view = t; render(); }
  }
  setInterval(checkDay, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) checkDay(); });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  applyTheme();
  render();
  Foods.load().catch(() => {});
})();
