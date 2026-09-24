#!/usr/bin/env python3
"""devbible file path -> live URL, the way Docusaurus routes it.

usage: python3 route.py docs/react/pages/phase-2-components/02-purity/03-x.md [...]
       (paths relative to the repo root; a directory means its README.md)

Rules mirrored: leading `NN-` / `NN.` stripped from every segment (Docusaurus's
number-prefix parser), `.md`/`.mdx` dropped, README/index serve their directory,
front-matter `slug:` (absolute or relative) and `id:` override the last segment.
Prints "<path>\t<url>" or "<path>\tMISSING".
"""
import os
import re
import sys

REPO = "/mnt/Storage/Backup/Knowledge/devbible"
SITE = "https://sairamg8.github.io/devbible"
strip = lambda s: re.sub(r"^\d+\s*[-_.]+\s*", "", s)


def front(path):
    try:
        src = open(path, encoding="utf-8").read()
    except OSError:
        return {}
    m = re.match(r"---\n(.*?)\n---", src, re.S)
    if not m:
        return {}
    out = {}
    for line in m.group(1).splitlines():
        k, _, v = line.partition(":")
        if k.strip() in ("slug", "id"):
            out[k.strip()] = v.strip().strip("'\"")
    return out


def url(rel):
    p = os.path.join(REPO, rel)
    if os.path.isdir(p):
        for n in ("README.md", "index.md", "index.mdx"):
            if os.path.exists(os.path.join(p, n)):
                rel, p = os.path.join(rel, n), os.path.join(p, n)
                break
    if not os.path.isfile(p):
        return None
    parts = rel.split("/")
    assert parts[0] == "docs", rel
    dirs = [strip(s) for s in parts[1:-1]]
    name = parts[-1]
    fm = front(p)
    if "slug" in fm:
        s = fm["slug"]
        return SITE + ("/docs" + s if s.startswith("/") else "/docs/" + "/".join(dirs + [s]))
    stem = re.sub(r"\.mdx?$", "", name)
    if stem.lower() in ("readme", "index"):
        return SITE + "/docs/" + "/".join(dirs)  # trailingSlash: false in the config
    return SITE + "/docs/" + "/".join(dirs + [fm.get("id") or strip(stem)])


for a in sys.argv[1:]:
    print(f"{a}\t{url(a) or 'MISSING'}")
