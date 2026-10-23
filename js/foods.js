// Offline food database (USDA SR28, Spanish names) and search.
(function () {
  const DATA_URL = "data/foods.json?v=1";
  let db = null;        // { groups, foods: [{...}] }
  let loading = null;

  function norm(s) {
    return " " + String(s || "")
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9%]+/g, " ")
      .trim() + " ";
  }

  function unitLabel(label, grams) {
    const clean = label.replace(/^1\s+/, "");
    return `${clean} (${fmtG(grams)} g)`;
  }
  function fmtG(g) { return g >= 10 ? Math.round(g) : Math.round(g * 10) / 10; }

  // Shared food shape used by the whole app:
  // { key, src, ref, name, sub, n: {kcal,p,c,f} per base, units: [{l, f}], def, qty }
  function toFood(row, groups) {
    const [id, es, en, g, kcal, p, c, f, , , , portions] = row;
    const units = [{ l: "g", f: 0.01, g: true }];
    for (const [grams, label] of portions) units.push({ l: unitLabel(label, grams), f: grams / 100 });
    const hasPortion = units.length > 1;
    return {
      key: "u" + id, src: "usda", ref: id, name: es, sub: (groups[g] || "") + " · " + en,
      n: { kcal, p, c, f }, units, def: hasPortion ? 1 : 0, qty: hasPortion ? 1 : 100,
    };
  }

  function load() {
    if (db) return Promise.resolve(db);
    if (loading) return loading;
    loading = fetch(DATA_URL)
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(json => {
        const foods = json.foods.map(row => {
          const es = row[1], en = row[2];
          const es2 = es.split(","), en2 = en.split(",");
          return {
            row,
            first: norm(es2[0]),
            head: norm(es2[0] + " " + en2[0]),
            head2: norm(es2.slice(0, 2).join(" ") + " " + en2.slice(0, 2).join(" ")),
            text: norm(es + " " + en + " " + (row[12] || "") + " " + (json.groups[row[3]] || "")),
            len: es.length, group: row[3],
          };
        });
        db = { groups: json.groups, foods };
        return db;
      })
      .catch(err => { loading = null; throw err; });
    return loading;
  }

  // Spanish plurals and gender: "frijoles" -> "frijol", "asada" -> "asad" (matches "asado")
  function variants(t) {
    const v = [[t, 1]];
    if (t.length > 4 && t.endsWith("es")) v.push([t.slice(0, -2), 0.7]);
    if (t.length > 3 && t.endsWith("s")) v.push([t.slice(0, -1), 0.7]);
    const base = t.replace(/s$/, "");
    if (base.length > 4 && /[aoe]$/.test(base)) v.push([base.slice(0, -1), 0.6]);
    return v;
  }

  // group indexes follow SR28 code order: 2 baby food, 20 fast food, 23 Native American, 24 restaurants
  const GROUP_PENALTY = { 2: 30, 20: 6, 23: 10, 24: 6 };

  // whole word, also when the stored name is the plural ("aguacate" matches "aguacates")
  function hasWord(str, t) {
    return str.includes(" " + t + " ") || str.includes(" " + t + "s ") || str.includes(" " + t + "es ");
  }

  function tokenScore(it, t) {
    if (it.first.startsWith(" " + t + " ") || it.first.startsWith(" " + t + "s ") || it.first.startsWith(" " + t + "es ")) return 40;
    if (hasWord(it.head, t)) return 30;
    if (hasWord(it.head2, t)) return 20;
    if (it.head.includes(" " + t)) return 16;
    if (it.head2.includes(" " + t)) return 10;
    if (hasWord(it.text, t)) return 6;
    if (it.text.includes(" " + t)) return 2;
    return 0;
  }

  function search(query, boostKeys, limit) {
    if (!db) return [];
    const tokens = norm(query).trim().split(" ").filter(Boolean);
    if (!tokens.length) return [];
    const tv = tokens.map(variants);
    const out = [];
    for (const it of db.foods) {
      let score = 0, ok = true;
      for (const vs of tv) {
        let best = 0;
        for (const [t, w] of vs) best = Math.max(best, tokenScore(it, t) * w);
        if (!best) { ok = false; break; }
        score += best;
      }
      if (!ok) continue;
      if (it.text.includes(" crudo ")) score += 3;
      if (it.text.includes(" entero ")) score += 2;
      score -= it.len / 12;
      score -= GROUP_PENALTY[it.group] || 0;
      if (boostKeys && boostKeys.has("u" + it.row[0])) score += 40;
      out.push([score, it]);
    }
    out.sort((a, b) => b[0] - a[0]);
    return out.slice(0, limit || 40).map(([, it]) => toFood(it.row, db.groups));
  }

  function byId(id) {
    if (!db) return null;
    const it = db.foods.find(x => x.row[0] === id);
    return it ? toFood(it.row, db.groups) : null;
  }

  window.Foods = { load, search, byId, count: () => (db ? db.foods.length : 0), norm };
})();
