// Open Food Facts: online search of branded products and barcode lookup.
// https://world.openfoodfacts.org (ODbL). Needs a connection; results are not cached offline.
(function () {
  const BASE = "https://world.openfoodfacts.org";
  const FIELDS = "code,product_name,product_name_es,generic_name,brands,quantity,serving_size,serving_quantity,nutriments";
  const cache = new Map();

  function withTimeout(url, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } })
      .finally(() => clearTimeout(timer));
  }

  function kcalOf(n) {
    if (n["energy-kcal_100g"] != null) return +n["energy-kcal_100g"];
    if (n["energy_100g"] != null) return +n["energy_100g"] / 4.184;
    if (n["energy-kj_100g"] != null) return +n["energy-kj_100g"] / 4.184;
    return null;
  }

  // Open Food Facts stores nutrients per 100 g in grams; convert to the units the app uses
  const OFF_MICROS = [
    ["fib", "fiber", 1], ["sug", "sugars", 1], ["sat", "saturated-fat", 1], ["mono", "monounsaturated-fat", 1],
    ["poly", "polyunsaturated-fat", 1], ["chol", "cholesterol", 1e3], ["k", "potassium", 1e3], ["ca", "calcium", 1e3],
    ["fe", "iron", 1e3], ["mg", "magnesium", 1e3], ["phos", "phosphorus", 1e3], ["zn", "zinc", 1e3], ["cu", "copper", 1e3],
    ["mn", "manganese", 1e3], ["se", "selenium", 1e6], ["va", "vitamin-a", 1e6], ["vc", "vitamin-c", 1e3],
    ["vd", "vitamin-d", 1e6], ["ve", "vitamin-e", 1e3], ["vk", "vitamin-k", 1e6], ["b1", "vitamin-b1", 1e3],
    ["b2", "vitamin-b2", 1e3], ["b3", "vitamin-pp", 1e3], ["b5", "pantothenic-acid", 1e3], ["b6", "vitamin-b6", 1e3],
    ["fol", "vitamin-b9", 1e6], ["b12", "vitamin-b12", 1e6], ["chl", "choline", 1e3],
  ];
  function microsOf(n) {
    const m = {};
    for (const [k, name, mult] of OFF_MICROS) {
      const v = parseFloat(n[name + "_100g"]);
      if (v >= 0 && isFinite(v)) m[k] = v * mult;
    }
    const na = parseFloat(n["sodium_100g"]), salt = parseFloat(n["salt_100g"]);
    if (na >= 0) m.na = na * 1e3;
    else if (salt >= 0) m.na = salt / 2.5 * 1e3;
    return m;
  }

  function toFood(p) {
    const n = p.nutriments || {};
    const kcal = kcalOf(n);
    const name = (p.product_name_es || p.product_name || p.generic_name || "").trim();
    if (kcal == null || !name) return null;
    const brands = Array.isArray(p.brands) ? p.brands.join(", ") : (p.brands || "");
    const units = [{ l: "g", f: 0.01, g: true }];
    const sq = parseFloat(p.serving_quantity);
    if (sq > 0) units.push({ l: `porción${p.serving_size ? " · " + p.serving_size : ""} (${Math.round(sq)} g)`, f: sq / 100 });
    const pq = parseFloat(String(p.quantity || "").replace(",", "."));
    if (pq > 0 && /\b(g|ml)\b/i.test(p.quantity || "") && pq !== sq) units.push({ l: `envase · ${p.quantity}`, f: pq / 100 });
    return {
      key: "o" + p.code, src: "off", ref: String(p.code), name,
      sub: [brands.split(",")[0].trim(), p.quantity].filter(Boolean).join(" · ") || "Producto",
      n: { kcal: Math.round(kcal), p: +(n.proteins_100g || 0), c: +(n.carbohydrates_100g || 0), f: +(n.fat_100g || 0) },
      m: microsOf(n),
      units, def: sq > 0 ? 1 : 0, qty: sq > 0 ? 1 : 100,
    };
  }

  async function search(q, page) {
    const key = q.toLowerCase().trim() + "|" + (page || 1);
    if (cache.has(key)) return cache.get(key);
    const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=24&page=${page || 1}&sort_by=unique_scans_n&fields=${FIELDS}`;
    let products;
    try {
      const r = await withTimeout(url, 15000);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      products = j.products || [];
    } catch (e) {
      // fallback: the newer search service
      const r = await withTimeout(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=24&page=${page || 1}&fields=${FIELDS}`, 15000);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      products = j.hits || [];
    }
    const foods = products.map(toFood).filter(Boolean);
    const res = { foods, more: products.length >= 24 };
    cache.set(key, res);
    return res;
  }

  async function barcode(code) {
    const r = await withTimeout(`${BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`, 15000);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    if (!j || j.status !== 1 || !j.product) return null;
    return toFood({ code, ...j.product });
  }

  window.OFF = { search, barcode };
})();
