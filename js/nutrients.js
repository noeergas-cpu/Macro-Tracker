// Micronutrients: the list, daily targets and number formatting.
// Targets are the US Dietary Reference Intakes (RDA or AI) for men aged 19 to 30, and the
// Dietary Guidelines limits for sodium, saturated fat and cholesterol. Fiber (14 g per 1000 cal)
// and saturated fat (under 10 % of calories) follow the calorie goal.
(function () {
  const LIST = [
    { k: "fib", l: "Fibra", u: "g", g: "carb", goal: cal => 14 * cal / 1000 },
    { k: "sug", l: "Azúcares totales", u: "g", g: "carb" },
    { k: "sat", l: "Grasa saturada", u: "g", g: "fat", max: cal => cal * 0.10 / 9 },
    { k: "mono", l: "Grasa monoinsaturada", u: "g", g: "fat" },
    { k: "poly", l: "Grasa poliinsaturada", u: "g", g: "fat" },
    { k: "chol", l: "Colesterol", u: "mg", g: "fat", max: () => 300 },
    { k: "na", l: "Sodio", u: "mg", g: "min", max: () => 2300 },
    { k: "k", l: "Potasio", u: "mg", g: "min", goal: () => 3400 },
    { k: "ca", l: "Calcio", u: "mg", g: "min", goal: () => 1000 },
    { k: "fe", l: "Hierro", u: "mg", g: "min", goal: () => 8 },
    { k: "mg", l: "Magnesio", u: "mg", g: "min", goal: () => 400 },
    { k: "phos", l: "Fósforo", u: "mg", g: "min", goal: () => 700 },
    { k: "zn", l: "Zinc", u: "mg", g: "min", goal: () => 11 },
    { k: "cu", l: "Cobre", u: "mg", g: "min", goal: () => 0.9 },
    { k: "mn", l: "Manganeso", u: "mg", g: "min", goal: () => 2.3 },
    { k: "se", l: "Selenio", u: "µg", g: "min", goal: () => 55 },
    { k: "va", l: "Vitamina A", u: "µg", g: "vit", goal: () => 900 },
    { k: "vc", l: "Vitamina C", u: "mg", g: "vit", goal: () => 90 },
    { k: "vd", l: "Vitamina D", u: "µg", g: "vit", goal: () => 15 },
    { k: "ve", l: "Vitamina E", u: "mg", g: "vit", goal: () => 15 },
    { k: "vk", l: "Vitamina K", u: "µg", g: "vit", goal: () => 120 },
    { k: "b1", l: "Tiamina (B1)", u: "mg", g: "vit", goal: () => 1.2 },
    { k: "b2", l: "Riboflavina (B2)", u: "mg", g: "vit", goal: () => 1.3 },
    { k: "b3", l: "Niacina (B3)", u: "mg", g: "vit", goal: () => 16 },
    { k: "b5", l: "Ácido pantoténico (B5)", u: "mg", g: "vit", goal: () => 5 },
    { k: "b6", l: "Vitamina B6", u: "mg", g: "vit", goal: () => 1.3 },
    { k: "fol", l: "Folato (B9)", u: "µg", g: "vit", goal: () => 400 },
    { k: "b12", l: "Vitamina B12", u: "µg", g: "vit", goal: () => 2.4 },
    { k: "chl", l: "Colina", u: "mg", g: "vit", goal: () => 550 },
    { k: "bcar", l: "Betacaroteno", u: "µg", g: "other" },
    { k: "lyc", l: "Licopeno", u: "µg", g: "other" },
    { k: "lut", l: "Luteína y zeaxantina", u: "µg", g: "other" },
  ];
  const BY_KEY = Object.fromEntries(LIST.map(n => [n.k, n]));
  const GROUPS = [
    ["carb", "Fibra y azúcares"], ["fat", "Grasas"], ["min", "Minerales"], ["vit", "Vitaminas"], ["other", "Otros compuestos"],
  ];
  // shown on the home screen
  const TOP = ["fib", "sug", "sat", "na"];

  function target(n, cal) {
    if (n.goal) return { kind: "goal", v: n.goal(cal) };
    if (n.max) return { kind: "max", v: n.max(cal) };
    return null;
  }

  // about three significant digits, enough for storage
  function round(v) {
    if (!(v > 0)) return 0;
    const d = v >= 100 ? 0 : v >= 10 ? 1 : v >= 1 ? 2 : 3;
    const f = Math.pow(10, d);
    return Math.round(v * f) / f;
  }

  function scale(m, k) {
    const out = {};
    if (!m) return out;
    for (const key in m) if (BY_KEY[key] && m[key] != null && isFinite(m[key])) out[key] = round(m[key] * k);
    return out;
  }

  function clean(m) {
    const out = {};
    if (!m || typeof m !== "object") return out;
    for (const key in m) { const v = +m[key]; if (BY_KEY[key] && v >= 0 && isFinite(v)) out[key] = round(v); }
    return out;
  }

  function fmt(v) {
    const d = v >= 10 ? 0 : v >= 1 ? 1 : v > 0 ? 2 : 0;
    return (+v || 0).toLocaleString("es-ES", { maximumFractionDigits: d, minimumFractionDigits: 0 });
  }

  // an item counts as detailed when it carries vitamins or minerals beyond what labels usually show
  function detailed(nu) {
    if (!nu) return false;
    let n = 0;
    for (const key in nu) if (BY_KEY[key] && !TOP.includes(key)) n++;
    return n >= 6;
  }

  window.Nutri = { LIST, BY_KEY, GROUPS, TOP, target, round, scale, clean, fmt, detailed };
})();
