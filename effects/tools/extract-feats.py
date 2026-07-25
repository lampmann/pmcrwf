#!/usr/bin/env python3
"""
Dev-only helper: flattens data/feats.json (user-supplied, gitignored 5e.tools
data) into plain-text {name, text} pairs for feeding to an LLM conversion
pass over the effects database (see DOCS.md "Feature effects" section).

Not part of the shipped app and not committed output — data/ is gitignored
because it's sourcebook content, so anything derived from its prose (this
script's output included) stays out of git too. Run it yourself:

    python3 effects/tools/extract-feats.py > /tmp/feats-extracted.json
"""
import json
import re
import sys

def strip_tags(s):
    if not isinstance(s, str):
        return s
    # {@tag text|...} -> text (5e.tools' renderer markup: dice, filters, conditions, etc.)
    def repl(m):
        body = m.group(1)
        parts = body.split("|")
        # {@tag display|target|...} - first segment after the tag name is the display text
        first = parts[0]
        bits = first.split(" ", 1)
        return bits[1] if len(bits) > 1 else bits[0]
    prev = None
    while prev != s:
        prev = s
        s = re.sub(r"\{@(\w+)\s*([^{}]*)\}", lambda m: strip_tags_inner(m), s)
    return s

def strip_tags_inner(m):
    tag, body = m.group(1), m.group(2)
    parts = body.split("|")
    return parts[0] if parts else ""

def entries_to_text(entries, indent=""):
    out = []
    for e in entries:
        if isinstance(e, str):
            out.append(indent + strip_tags(e))
        elif isinstance(e, dict):
            if e.get("type") == "list":
                for item in e.get("items", []):
                    if isinstance(item, str):
                        out.append(indent + "- " + strip_tags(item))
                    elif isinstance(item, dict):
                        name = item.get("name")
                        prefix = (indent + "- " + strip_tags(name) + ": ") if name else (indent + "- ")
                        sub = entries_to_text(item.get("entries", [item.get("entry", "")]), "")
                        out.append(prefix + " ".join(sub))
            elif e.get("type") == "entries":
                if e.get("name"):
                    out.append(indent + strip_tags(e["name"]) + ".")
                out.extend(entries_to_text(e.get("entries", []), indent))
            elif "entries" in e:
                out.extend(entries_to_text(e["entries"], indent))
    return out

def main():
    with open("data/feats.json") as f:
        data = json.load(f)
    feats = data.get("feat", [])
    out = []
    for feat in feats:
        name = feat.get("name", "")
        lines = entries_to_text(feat.get("entries", []))
        prereq = feat.get("prerequisite")
        ability = feat.get("ability")
        out.append({
            "name": name,
            "source": feat.get("source", ""),
            "hasAbilityIncrease": bool(ability),
            "text": "\n".join(lines),
        })
    json.dump(out, sys.stdout, indent=2)

if __name__ == "__main__":
    main()
