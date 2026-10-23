"""Build data/foods.json from USDA National Nutrient Database for Standard Reference, Release 28.

Input: ABBREV.txt and FOOD_DES.txt from SR28 (public domain, USDA ARS).
Usage: python3 tools/build_foods.py <dir with SR28 txt files> data/foods.json
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from glossary_es import GROUPS, PHRASES, WORDS  # noqa: E402

WORD_RE = re.compile(r"[A-Za-z][A-Za-z'\-]*")

# multi-word keys in WORDS behave like phrases
ALL_PHRASES = {**{k: v for k, v in WORDS.items() if " " in k}, **PHRASES}
PHRASE_LIST = sorted(ALL_PHRASES.items(), key=lambda kv: -len(kv[0]))
PHRASE_RES = [(re.compile(r"(?<![A-Za-z])" + re.escape(k) + r"(?![A-Za-z])", re.I), v) for k, v in PHRASE_LIST]


def split_alts(value):
    parts = value.split("|")
    return parts[0], parts[1:]


def translate(text):
    """Return (spanish, [extra search synonyms])."""
    alts = []
    slots = []

    def protect(value):
        main, extra = split_alts(value)
        alts.extend(extra)
        slots.append(main)
        return f"\x00{len(slots) - 1}\x00"

    s = text.replace("w/o", "without").replace("W/O", "without").replace("w/", "with ").replace("W/", "with ")
    s = s.replace("&", " and ")
    for rx, value in PHRASE_RES:
        s = rx.sub(lambda m, v=value: protect(v), s)

    def word(m):
        w = m.group(0)
        key = w.lower()
        if len(w) > 1 and w.isupper() and key not in ("oz", "lb"):
            return w  # brand names are written in capitals
        if key not in WORDS and key.endswith("'s"):
            return w
        if key in WORDS:
            main, extra = split_alts(WORDS[key])
            alts.extend(extra)
            return main
        return w

    out = []
    for i, chunk in enumerate(s.split("\x00")):
        out.append(slots[int(chunk)] if i % 2 else WORD_RE.sub(word, chunk))
    res = re.sub(r"\s+", " ", "".join(out)).strip()
    res = re.sub(r"\s+,", ",", res)
    if res:
        res = res[0].upper() + res[1:]
    return res, alts


def num(v):
    v = v.strip()
    return float(v) if v else 0.0


def main(src, dst):
    src = Path(src)
    des = {}
    for line in open(src / "FOOD_DES.txt", encoding="latin-1"):
        f = line.rstrip("\r\n").split("^")
        des[f[0].strip("~")] = {"grp": f[1].strip("~"), "long": f[2].strip("~"), "common": f[4].strip("~")}

    group_codes = sorted(GROUPS)
    foods = []
    for line in open(src / "ABBREV.txt", encoding="latin-1"):
        f = line.rstrip("\r\n").split("^")
        ndb = f[0].strip("~")
        d = des.get(ndb)
        if not d:
            continue
        en = d["long"]
        es, alts = translate(en)
        if d["common"]:
            alts.append(d["common"])
        portions = []
        for gi, di in ((48, 49), (50, 51)):
            g = num(f[gi])
            label = f[di].strip("~")
            if g > 0 and label:
                portions.append([round(g, 1), translate(label)[0]])
        alt = " ".join(dict.fromkeys(a for a in alts if a))
        foods.append([
            int(ndb), es, en, group_codes.index(d["grp"]) if d["grp"] in GROUPS else -1,
            round(num(f[3])), round(num(f[4]), 1), round(num(f[7]), 1), round(num(f[5]), 1),
            round(num(f[8]), 1), round(num(f[9]), 1), round(num(f[15])),
            portions, alt,
        ])

    out = {
        "v": 1,
        "source": "USDA National Nutrient Database for Standard Reference, Release 28 (public domain). Traducción automática al español.",
        "fields": ["id", "es", "en", "group", "kcal", "protein", "carbs", "fat", "fiber", "sugar", "sodium_mg", "portions", "alt"],
        "per": "100 g",
        "groups": [GROUPS[c] for c in group_codes],
        "foods": foods,
    }
    Path(dst).write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(foods)} foods -> {dst}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
