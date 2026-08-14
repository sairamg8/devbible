#!/usr/bin/env python3
"""Relative-link pre-check for the Express pages.

A CHEAP FIRST PASS ONLY. Docusaurus resolves links differently and a real build
is still owed at every phase boundary:

    DOCUSAURUS_GENERATED_FILES_DIR_NAME=.docusaurus-express \
      yarn build --out-dir build-express 2>&1 | grep -A1 expressjs

The isolated generated-files dir matters: other sessions build concurrently in
this checkout and a shared `.docusaurus` produces "Cannot find module" errors
that are theirs, not yours.

Why this script exists in this form: an earlier version matched only links
beginning with `.`, and therefore missed `[Chunk 03](03-the-boundary.md)` — a
bare sibling filename, which is the most common form inside a chunk directory.
The Docusaurus build caught it; this did not. It now matches any link ending in
`.md` that is not absolute and not a URL.
"""
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..',
                    'docs', 'expressjs', 'pages')
LINK = re.compile(r'\]\(([^)\s#]+?\.md)(#[^)]*)?\)')

bad = []
for dirpath, _, filenames in os.walk(os.path.normpath(ROOT)):
    for name in filenames:
        if not name.endswith('.md'):
            continue
        page = os.path.join(dirpath, name)
        with open(page, encoding='utf-8') as fh:
            body = fh.read()
        for match in LINK.finditer(body):
            target = match.group(1)
            if target.startswith(('/', 'http://', 'https://')):
                continue  # site-absolute or external; only the build can judge
            if not os.path.exists(os.path.normpath(os.path.join(dirpath, target))):
                bad.append((page, target))

print(f'broken relative .md links: {len(bad)}')
for page, target in bad:
    print(f'  {page} -> {target}')
sys.exit(1 if bad else 0)
