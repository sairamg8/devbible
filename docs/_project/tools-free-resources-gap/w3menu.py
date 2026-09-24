#!/usr/bin/env python3
"""Print a w3schools tutorial's full left-menu as markdown.

usage: python3 w3menu.py <tutorial-dir> [<tutorial-dir> ...]
  e.g. python3 w3menu.py js nodejs postgresql

Output per tutorial:  "# <dir>  (<n> pages)", then "## <section>" headings and
"- <title> | <absolute url>" lines, in menu order. Exit status 1 if any tutorial
404s or has no menu (that is itself a finding: w3schools has no such tutorial).
"""
import html
import re
import sys
import urllib.request

BASE = "https://www.w3schools.com/"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64)"}


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.geturl(), r.read().decode("utf-8", "ignore")


def text(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def menu(tut):
    final, s = fetch(f"{BASE}{tut}/default.asp")
    m = re.search(r"id=[\"']leftmenuinnerinner[\"']", s)
    if not m:
        return final, None
    i = m.start()
    mj = re.compile(r"id=[\"']main[\"']").search(s, i)
    seg = s[i : mj.start() if mj else i + 200000]
    out = []
    for m in re.finditer(r"<h2[^>]*>(.*?)</h2>|<a[^>]*href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>", seg, re.S):
        if m.group(1) is not None:
            t = text(m.group(1))
            if t:
                out.append(("h", t, None))
        else:
            href, t = m.group(2), text(m.group(3))
            if not t or href.startswith("javascript:") or t == "×":
                continue
            if not href.startswith("http"):
                href = f"{BASE}{tut}/{href}" if not href.startswith("/") else BASE + href.lstrip("/")
            out.append(("a", t, href))
    return final, out


bad = 0
for tut in sys.argv[1:]:
    try:
        final, items = menu(tut)
    except Exception as e:  # 404 and friends
        print(f"# {tut}  — NO TUTORIAL ({e})\n")
        bad = 1
        continue
    if not items:
        print(f"# {tut}  — NO MENU (landed on {final})\n")
        bad = 1
        continue
    n = sum(1 for k, *_ in items if k == "a")
    print(f"# {tut}  ({n} pages)  {final}")
    for k, t, h in items:
        print(f"\n## {t}" if k == "h" else f"- {t} | {h}")
    print()
sys.exit(bad)
