#!/usr/bin/env bash
# QC gate for one directory: cap, real MDX compile, link check — exits non-zero on any failure
set -u; D="$1"; S=$(dirname "$0"); ok=0
for f in "$D"/*.md; do n=$(wc -l < "$f"); [ "$n" -gt 300 ] && { echo "OVER CAP: $f ($n)"; ok=1; }; done
yarn mdxcheck "$D" > "$S/mdx.log" 2>&1 || { tail -4 "$S/mdx.log"; ok=1; }
yarn linkcheck "$D" > "$S/lc.log" 2>&1 || { tail -6 "$S/lc.log"; ok=1; }
[ $ok -eq 0 ] && echo "gate ok: $(tail -1 "$S/mdx.log") · $(tail -1 "$S/lc.log")"
exit $ok
