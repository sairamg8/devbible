#!/usr/bin/env python3
"""Append a "Further reading" section to each written page, from the track's link map.

Purely additive and idempotent:
  - reads docs/<track>/link-map/*.md blocks marked "✅ written `docs/<track>/pages/...md`"
  - renders that block's "Read this" / "Also good" links as a list
  - inserts it just before the page footer, between two MDX comment markers, so a
    re-run replaces only its own section and never touches anything else
  - skips a page when the insert would push it past 300 lines (reported, never trimmed)

Usage:  python3 scripts/linkmap-inject.py <track> [<track> ...] [--dry-run]
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
START = "{/* LINKMAP:START */}"
END = "{/* LINKMAP:END */}"
CAP = 300

BLOCK = re.compile(r"^### (T[\w-]+) · (.+?) — .*?· (✅(?: written)?|🔲 not written)(.*)$", re.M)
PATH = re.compile(r"`((?:docs/[^`]+?|…/[^`]+?)\.md)`")
LINK = re.compile(r"\[([^\]]+)\]\((https://[^)\s]+)\)")


def clean(text: str) -> str:
    """Keep MDX safe: no raw angle brackets or braces outside code."""
    text = text.replace("<", "&lt;").replace(">", "&gt;").replace("{", "&#123;").replace("}", "&#125;")
    return re.sub(r"\s+", " ", text).strip()


def parse_blocks(track_dir: Path):
    """Yield (topic_title, [page paths], [(label, title, url, note)]) per written block."""
    for f in sorted((track_dir / "link-map").glob("0*.md")):
        text = f.read_text()
        parts = re.split(r"(?m)^(?=### T)", text)
        last_dir = None
        for part in parts:
            m = BLOCK.match(part)
            if not m:
                continue
            head = m.group(0)
            status = m.group(3)
            paths = []
            for p in PATH.findall(head):
                if p.startswith("…/"):
                    if last_dir is None:
                        continue
                    paths.append(f"{last_dir}/{p[2:]}")
                else:
                    paths.append(p)
                    last_dir = str(Path(p).parent)
            if status.startswith("🔲") or not paths:
                continue
            links = []
            for line in part.splitlines()[1:]:
                lm = re.match(r"- \*\*(Read this(?: \(\d/\d\))?|Also good):\*\*\s*(.*)", line)
                if not lm:
                    continue
                label, rest = lm.group(1), lm.group(2)
                found = LINK.search(rest)
                if not found:
                    continue
                title, url = found.group(1), found.group(2)
                tail = rest[found.end():]
                # "· site · why it is best · covers our angle: ..." — keep site and the why, drop the rest
                segs = [s.strip() for s in tail.split("·") if s.strip()]
                site = segs[0] if segs else ""
                why = ""
                if len(segs) > 1 and not segs[1].lower().startswith(("covers our angle", "fetched")):
                    why = segs[1]
                links.append((label, title, url, site, why))
                for extra in LINK.finditer(rest[found.end():]):
                    links.append((label, extra.group(1), extra.group(2), "", ""))
            if links:
                yield m.group(2), paths, links


def render(links):
    out = [START, "", "## Further reading", "",
           "*Best explanations found elsewhere on the web — added alongside this page, nothing here replaces it.*", ""]
    for label, title, url, site, why in links:
        tag = "Read this" if label.startswith("Read") else "Also good"
        suffix = ""
        if site:
            suffix += f" — {clean(site)}"
        if why:
            suffix += f": {clean(why)[:230]}"
        out.append(f"- **{tag}:** [{clean(title)}]({url}){suffix}")
    out += ["", END, ""]
    return "\n".join(out)


FOOTER = re.compile(r"\n---\n\n(?=(?:←|Start →|Next|\[|\{/\* FOOTER))", re.M)


def inject(page: Path, section: str):
    text = page.read_text()
    if START in text:
        # remove exactly what a previous run inserted: "\n" + START ... END + "\n"
        text = re.sub(r"\n" + re.escape(START) + r".*?" + re.escape(END) + r"\n", "", text, count=1, flags=re.S)
    m = None
    for m in FOOTER.finditer(text):
        pass
    if m:
        new = text[: m.start()] + "\n" + section + text[m.start():]
    else:
        new = text.rstrip("\n") + "\n\n" + section
    return new


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    if not args:
        sys.exit(__doc__)
    total = changed = skipped_cap = missing = 0
    for track in args:
        track_dir = ROOT / "docs" / track
        per_page = {}
        for title, paths, links in parse_blocks(track_dir):
            for p in paths:
                bucket = per_page.setdefault(p, [])
                seen = {l[2] for l in bucket}
                for l in links:
                    if l[2] not in seen:
                        bucket.append(l)
                        seen.add(l[2])
        for p, links in per_page.items():
            section = render(links)
            total += 1
            page = ROOT / p
            if not page.exists():
                missing += 1
                print(f"MISSING {p}")
                continue
            new = inject(page, section)
            if new.count("\n") + 1 > CAP:
                skipped_cap += 1
                print(f"OVER-CAP {p} ({new.count(chr(10)) + 1} lines) — skipped")
                continue
            if new != page.read_text():
                changed += 1
                if not dry:
                    page.write_text(new)
    print(f"{'DRY RUN: ' if dry else ''}{total} page refs · {changed} changed · {skipped_cap} over cap · {missing} missing")


if __name__ == "__main__":
    main()
