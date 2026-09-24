export const meta = {
  name: 'python-complete-lanes',
  description: 'Python track: fix the owed defects in closed topics, then author the 11 remaining phase-3 and phase-7 topics — 3 rolling slots, each slot runs author then gate/commit/wire',
  whenToUse: 'Continue the devbible Python lanes (phase 3 collections, phase 7 packaging) from their cursors',
  phases: [
    { title: 'Defects', detail: 'verify and fix owed factual defects and stale pins in closed topics (2 jobs)' },
    { title: 'Author', detail: 'one devbible-author agent per topic, 3 slots rolling, resume once if it stops short' },
    { title: 'Gate and wire', detail: 'serialised: topic-gate, commit, phase README, re-links, progress.js, pins, cursors' },
  ],
}

// ---------------------------------------------------------------------------------------------
// Run header — 2026-09-21, session d750a152. User: "focus on completing python".
// Standing orders honoured: max 3 agents in total across both python lanes (each slot runs ONE
// agent at a time; the wiring mutex holds a slot but no agent), one Workflow at a time, every
// dispatch names .agents/skills/devbible-topic/SKILL.md, bank first, README first, no forward
// links, per-file commits (py-autocommit.sh runs beside this in the coordinator session).
// A killed run loses nothing that was finished: see progress_python_pages.md and
// CURSOR-PYTHON-PHASE7.md. Salvage = bash shared/scripts/topic-gate.sh <dir>, then py-commit.sh.
// ---------------------------------------------------------------------------------------------

const REPO = '/mnt/Storage/Backup/Knowledge/devbible'
const STORE = '/mnt/Storage/my-learning/claude'
const SCRIPTS = STORE + '/shared/scripts'
const SCRATCH = '/tmp/claude-1000/-mnt-Storage-Backup-Knowledge-devbible/d750a152-0f24-4a85-bb9f-914bd681f96c/scratchpad'
const P3 = 'docs/python/pages/phase-3-collections'
const P7 = 'docs/python/pages/phase-7-packaging-tooling'

const SPINE_P3 = 'Python 3.14.7 (released 2026-08-05; docs.python.org/3.14 and CPython tag v3.14.7). src/data/pins.js pins python 3.14 and sortedcontainers 2.4.0. Every claim about CPython behaviour is checked against the 3.14 docs or the v3.14.7 source, never against memory.'
const SPINE_P7 = 'Python 3.14.7 · uv 0.12.12 (pre-1.0 and ships weekly: name the version a flag landed in and say where behaviour may not survive) · ruff 0.16.6 · pre-commit 4.6.2 · pip 26.2.1 · pypa/installer 1.0.1. GitHub Actions pins checked 2026-09-10: actions/checkout@v7 exists; astral-sh/setup-uv has published NO floating major tag since v8, so write @v10.0.1 or a commit SHA, never @v10 or @v5; astral-sh/ruff-action has no v4 tag; peter-evans/create-pull-request latest major is v8. Verify any other version or action pin against its releases page the day you write it, and say so on the Verified line.'

const LANES = {
  p3: { phaseDir: P3, ph: 'ph3', phaseN: 3, spine: SPINE_P3, cursor: STORE + '/devbible/progress_python_pages.md',
        closed: ['01-list-internals', '02-tuple', '03-dict', '04-set-and-frozenset', '05-slicing', '06-collections-module', '07-heapq-and-bisect'] },
  p7: { phaseDir: P7, ph: 'ph7', phaseN: 7, spine: SPINE_P7, cursor: STORE + '/devbible/CURSOR-PYTHON-PHASE7.md',
        closed: ['01-pyproject-toml', '02-uv', '03-dependencies', '04-project-layout', '05-ruff', '06-entry-points'] },
}

const P7_BANK_NOTE = 'Reusable, already-verified quotes for this topic are banked in ' + STORE + '/devbible/research_python_p07_t06_entry_points.md (pip MissingCallableSuffix, the pyproject dynamic-scripts rule, the setuptools editable re-install sentence, uv 0.12.0 reserved names). Read it before you research and do not re-fetch what it already quotes. Other banks: ls ' + STORE + '/devbible/research_python_*.md'
const P3_BANK_NOTE = 'Banks for the closed topics exist: ls ' + STORE + '/devbible/research_python_p03_*.md — read the ones next to your subject before you research and do not re-fetch what they already quote.'

const TOPICS = [
  {
    id: 'p3-08', lane: 'p3', slug: '08-copy-and-deepcopy', n: 8, title: 'copy vs deepcopy', label: '08 · copy vs deepcopy',
    tier: 'Understand', tierClass: 't-understand', bank: 'research_python_p03_t08_copy_and_deepcopy.md',
    syllabus: 'copy vs deepcopy — one level vs the whole graph, and the nested-dict config that two requests accidentally shared',
    phaseRow: 'One level vs the whole graph, and the config two requests shared',
    owns: 'The copy module end to end: copy.copy and copy.deepcopy, the memo dict and how cycles and shared sub-objects are handled (a shared child is copied once), copy.replace and __replace__ (new in 3.13 — verify), the __copy__ / __deepcopy__ / __reduce_ex__ / copyreg protocol and why __init__ is not called, what each builtin does (immutable atoms returned as is; a tuple of mutables; list/dict/set .copy(), list(), slicing and dict() as shallow copies; defaultdict, deque, OrderedDict, Counter, dataclasses, __slots__ classes, enums, functools.partial, and the things that cannot be copied: locks, files, sockets, generators, modules), the real-world bug of a nested-dict config shared between two requests (show the symptom and every fix), dataclasses.replace, alternatives to deepcopy (rebuild explicitly, frozen or immutable data, MappingProxyType, pickle or JSON round trips and what they lose), deepcopy cost and recursion-limit behaviour with only documented facts (no invented timings), deepcopy is not atomic under threads, and interview-style questions.',
    notOwn: 'Aliasing and mutability in general (phase 1 — find and link the relevant phase-1 pages after ls-verifying them), slicing as copying (topic 05), list/dict/set internals (topics 01, 03, 04), pickle in depth (not written yet — de-link).',
    extra: P3_BANK_NOTE,
  },
  {
    id: 'p3-09', lane: 'p3', slug: '09-iteration-idioms', n: 9, title: 'Iteration idioms', label: '09 · Iteration idioms',
    tier: 'Master', tierClass: 't-master', bank: 'research_python_p03_t09_iteration_idioms.md',
    syllabus: 'Iteration idioms: enumerate (with start=), zip (stops at shortest — strict=True since 3.10), reversed, any/all, min/max with key=',
    phaseRow: 'enumerate, zip(strict=True), reversed, any/all, min/max',
    owns: 'enumerate (start=, on files and generators, index-arithmetic anti-patterns it replaces), zip (stops at the shortest and silently drops data — how the longer iterator loses one item; strict=True and its ValueError, added in 3.10; zip vs itertools.zip_longest; zip(*rows) transposition and its empty-input trap; unzip), reversed (needs __reversed__ or the sequence protocol; not generators or sets; dicts since 3.8; reversed vs [::-1] vs .reverse()), any/all (short-circuiting, the empty-iterable results, generator expression vs list comprehension inside them, any/all on non-booleans), min/max (key=, default= for empty input, the empty ValueError, ties return the first, mixed-type comparison TypeError, the key function called once per item), sum and its float and string traps, next(it, default), iter(callable, sentinel), for/else, unpacking in for headers, iterating dicts and .items(), and the mutation-during-iteration bugs (lists skip items, dicts and sets raise RuntimeError). This is a Master topic: exhaust every gotcha and show every fix.',
    notOwn: 'The iterator protocol, generators and itertools in depth (phase 5 — not written yet, de-link), sorting (topic 10 — being written, de-link), list/dict internals (topics 01/03 — link).',
    extra: P3_BANK_NOTE,
  },
  {
    id: 'p3-10', lane: 'p3', slug: '10-sorting-compound-data', n: 10, title: 'Sorting compound data', label: '10 · Sorting compound data',
    tier: 'Understand', tierClass: 't-understand', bank: 'research_python_p03_t10_sorting_compound_data.md',
    syllabus: 'Sorting compound data: key= with lambdas, operator.itemgetter/attrgetter, multi-key sorts, stability as a feature',
    phaseRow: 'key=, itemgetter/attrgetter, multi-key sorts, stability as a feature',
    owns: 'key= with lambdas and why the key is computed once per element; operator.itemgetter, attrgetter and methodcaller (single and multiple fields, nested attribute paths); multi-key sorts (tuple keys, mixed ascending and descending by stable multi-pass sorting or negation, functools.cmp_to_key and when it is the wrong tool); stability as a feature (sort by the secondary key first) and reverse=True preserving the order of equal items; None and mixed-type TypeError and the (x is None, x) key idiom; str.casefold, locale.strxfrm and natural-sort keys; sorting dicts by value and records by field; __lt__, functools.total_ordering and dataclass(order=True) as the alternative; heapq.nlargest/nsmallest key=, bisect key= (3.10) on compound data; decorate-sort-undecorate; and when the honest answer is ORDER BY in the database.',
    notOwn: 'Timsort internals, sorted() vs list.sort() mechanics and the x = x.sort() bug (topic 01 — link, do not repeat), heapq/bisect mechanics (topic 07 — link).',
    extra: P3_BANK_NOTE,
  },
  {
    id: 'p3-11', lane: 'p3', slug: '11-choosing-a-structure', n: 11, title: 'Choosing a structure', label: '11 · Choosing a structure',
    tier: 'Understand', tierClass: 't-understand', bank: 'research_python_p03_t11_choosing_a_structure.md',
    syllabus: 'Choosing a structure — the decision table: by lookup pattern, ordering need, mutation — and the honest note that at scale the answer becomes a database or numpy, not a bigger dict',
    phaseRow: 'The decision table — and when the answer is a database, not a bigger dict',
    owns: 'The decision table by lookup pattern, ordering need, mutation, uniqueness and memory: list, tuple, namedtuple, dataclass, __slots__ classes, TypedDict, dict, defaultdict, Counter, set, frozenset, deque, array, heapq, a bisect-maintained sorted list, sortedcontainers (external, pinned 2.4.0), queue.Queue vs deque across threads; documented time complexities only (no invented timings); how to measure memory and speed yourself (a script, never invented output); the anti-patterns this phase exists to kill — list as a queue, in-tests against a big list inside a loop, a nested loop where set difference does it, a dict of parallel lists instead of a list of records; worked case studies (leaderboard, sliding-window rate limiter, de-duplicating a stream, LRU cache, graph adjacency, inverted index) each ending on the chosen structure and why; and the honest note that at scale the answer is a database, numpy or Redis, not a bigger dict. This topic is the phase capstone: link every earlier topic that is on disk.',
    notOwn: 'The internals of any single structure (link its topic), sorting (topic 10), array/memoryview (topic 12 — being written or not yet written, de-link).',
    extra: P3_BANK_NOTE,
  },
  {
    id: 'p3-12', lane: 'p3', slug: '12-array-and-memoryview', n: 12, title: 'array and memoryview', label: '12 · array and memoryview',
    tier: 'When Needed', tierClass: 't-when', bank: 'research_python_p03_t12_array_and_memoryview.md',
    syllabus: 'array, memoryview — compact numeric storage below numpy',
    phaseRow: 'Compact numeric storage below numpy, and buffers without copies',
    owns: 'array.array (typecodes and itemsize, construction, tobytes/frombytes/fromfile/tofile, byteswap, tolist, the u typecode deprecation and the w typecode — verify against the 3.14 docs, memory vs a list of ints with documented facts only), the buffer protocol and collections.abc.Buffer (PEP 688, 3.12), memoryview (slicing without copying, cast, format, itemsize, shape, tobytes, toreadonly, release and the context manager, exports blocking resize with BufferError, multidimensional casts), bytes vs bytearray interplay, struct.pack_into/unpack_from with buffers, readinto and socket recv_into, mmap, endianness, comparison with numpy and when to stop and use it. Tier is When Needed: keep the scope to what a fullstack service actually meets, but stay exhaustive inside that scope.',
    notOwn: 'numpy (not a track here), struct in depth beyond the buffer use (phase 10 — de-link), file and socket I/O (phase 10 — de-link).',
    extra: P3_BANK_NOTE,
  },
  {
    id: 'p7-07', lane: 'p7', slug: '07-wheels-and-sdists', n: 7, title: 'Wheels vs sdists', label: '07 · Wheels vs sdists',
    tier: 'Understand', tierClass: 't-understand', bank: 'research_python_p07_t07_wheels_and_sdists.md',
    syllabus: 'Wheels vs sdists, and native extensions — why pip install sometimes compiles C, and what a missing wheel for your platform looks like',
    phaseRow: 'Why pip install sometimes compiles C, and what a missing wheel looks like',
    owns: 'What a wheel is (a zip; the .dist-info directory with METADATA, WHEEL, RECORD and entry_points.txt; the binary distribution format spec) and how to read the filename tags {name}-{version}-{python}-{abi}-{platform}.whl (py3-none-any, cp314, abi3, the free-threaded cp314t tag, manylinux_2_x, musllinux, macosx, win_amd64/arm64; PEP 425, 600, 656); what an sdist is (PEP 625 naming, PKG-INFO, the build-backend hooks of PEP 517/518); why pip install sometimes compiles (no matching wheel means the sdist is built in an isolated environment, and the compiler, headers or Rust are your problem) and what a missing wheel looks like, using only error text you can quote from primary sources; pip flags --only-binary, --no-binary, --prefer-binary, --no-build-isolation, pip download, pip wheel, the wheel cache; the uv equivalents (--no-build, --no-binary, --no-build-isolation, uv build --wheel and --sdist); checking which tags an interpreter accepts (pip debug --verbose, packaging.tags); PEP 658 metadata files on the index; native extensions (C, Cython, Rust with maturin, the stable ABI) and why Alpine/musl and Apple silicon and Windows ARM produce missing-wheel surprises, and the Docker consequences; running arbitrary build code at install time is the security difference between an sdist and a wheel; auditwheel, delocate and cibuildwheel as the maker-side tools (Know-level mention).',
    notOwn: 'pyproject.toml fields (topic 01 — link), dependency resolution and locking (topic 03 — link), the installed command (topic 06 — link), building and uploading for release (topic 12 — not written yet, de-link), editable installs (topic 10 — de-link).',
    extra: P7_BANK_NOTE,
  },
  {
    id: 'p7-08', lane: 'p7', slug: '08-config-and-secrets', n: 8, title: 'Config and secrets', label: '08 · Config and secrets',
    tier: 'Understand', tierClass: 't-understand', bank: 'research_python_p07_t08_config_and_secrets.md',
    syllabus: 'Config and secrets: environment variables, .env in dev only, typed settings objects (pydantic-settings) — 12-factor as Python practises it',
    phaseRow: 'Environment variables, .env in dev only, typed settings — 12-factor in Python',
    owns: 'The twelve-factor config rule and what it means in a Python service; os.environ and os.getenv semantics (string-only values, unset vs empty, KeyError, the "false" string is truthy trap and safe bool/int parsing); .env files in development only (python-dotenv: format quirks, load_dotenv override and precedence, never loaded in production), uv run --env-file / UV_ENV_FILE (verify the version it landed in); typed settings — pydantic-settings BaseSettings and SettingsConfigDict, env_prefix, nested delimiters, SecretStr, secrets_dir, source priority — and a dependency-free dataclass + os.environ + tomllib alternative; layered precedence (defaults, file, environment, CLI) stated once and tested; fail fast at start-up with every missing key reported at once; secrets handling (never in git or in an image layer, leaks through repr, logging, tracebacks and error reporters, .gitignore and .dockerignore, injection through Docker or Kubernetes or CI secrets, rotation); a settings object built once vs lru_cache pitfalls; test isolation with monkeypatch.setenv and cleared caches; per-environment settings without if-production branches.',
    notOwn: 'pre-commit secret scanning hooks (topic 11 — de-link), Docker and Kubernetes secret mechanics beyond how a Python process reads them (other tracks — link only pages you have ls-verified), pyproject tool config (topic 01 — link).',
    extra: P7_BANK_NOTE + ' pydantic-settings and python-dotenv are not pinned yet: report both in pinsNeeded with versions you verified.',
  },
  {
    id: 'p7-09', lane: 'p7', slug: '09-inline-script-metadata', n: 9, title: 'PEP 723 inline script metadata', label: '09 · PEP 723 inline metadata',
    tier: 'Know', tierClass: 't-know', bank: 'research_python_p07_t09_inline_script_metadata.md',
    syllabus: 'Single-file scripts with inline metadata (PEP 723): uv run script.py resolving its own deps — automation scripts that carry their environment',
    phaseRow: 'A single-file script that carries its own dependencies',
    owns: 'PEP 723 and the PyPA inline script metadata specification: the # /// script block, its exact grammar and the reference regular expression, dependencies, requires-python and tool tables; uv run script.py, uv add --script, uv remove --script, uv lock --script and the sidecar lockfile, uv init --script, [tool.uv] exclude-newer for reproducibility, --with, --no-project, the shebang #!/usr/bin/env -S uv run --script, uv run on a remote URL and its security implication; other tools that read the block (pipx run, hatch, pdm, pip-run — only those the primary docs confirm); how uv finds or downloads a matching interpreter; what happens with a malformed or duplicated block; the interaction with a project pyproject.toml in the same directory; Windows; ephemeral environments and the cache; and when to graduate a script to a package.',
    notOwn: 'uv projects, lockfiles and sync (topic 02 — link), pyproject.toml fields (topic 01 — link), uvx and tools (topic 02 — link).',
    extra: P7_BANK_NOTE,
  },
  {
    id: 'p7-10', lane: 'p7', slug: '10-editable-installs', n: 10, title: 'Editable installs', label: '10 · Editable installs',
    tier: 'Know', tierClass: 't-know', bank: 'research_python_p07_t10_editable_installs.md',
    syllabus: 'Editable installs (-e .), path dependencies, simple monorepos',
    phaseRow: '-e ., path dependencies, simple monorepos and workspaces',
    owns: 'PEP 660 editable wheels and how an editable install works (a .pth file vs a finder hook; setuptools lenient and strict modes and compat mode; hatchling; uv_build), pip install -e with extras, the legacy setup.py develop path; static analysers and IDEs failing to follow finder-based editables (quote the mypy and pyright documentation), uv: uv sync installs the project editable by default, --no-editable, uv pip install -e, [tool.uv.sources] path dependencies with editable = true, and uv workspaces ([tool.uv.workspace] members, { workspace = true }, one lockfile) as the simple-monorepo answer; namespace packages; running tests against the installed vs the editable copy; Docker images and layer order with editable installs; PYTHONPATH as the alternative and its costs; uninstalling an editable. Gotchas to exhaust: metadata frozen at install time, an editable install silently masking a packaging bug that the built wheel has.',
    notOwn: 'The stale-wrapper angle (topic 06 chunk 09 — link, do not repeat), how an editable install reopens the flat-layout hole (topic 04 — link), uv sync mechanics (topic 02 — link), building wheels (topic 07 — de-link until it lands).',
    extra: P7_BANK_NOTE,
  },
  {
    id: 'p7-11', lane: 'p7', slug: '11-pre-commit', n: 11, title: 'pre-commit', label: '11 · pre-commit',
    tier: 'Know', tierClass: 't-know', bank: 'research_python_p07_t11_pre_commit.md',
    syllabus: 'pre-commit — the hook harness the ecosystem standardised on',
    phaseRow: 'The hook harness the ecosystem standardised on',
    owns: 'pre-commit 4.6.2: .pre-commit-config.yaml (repos, rev pinned to a tag or SHA, hooks, id, args, files/exclude, types, stages, language, additional_dependencies, pass_filenames, always_run, fail_fast, default_language_version, minimum_pre_commit_version); pre-commit install and the hook types (commit-msg, pre-push), install-hooks, uninstall; run --all-files, --files, --from-ref/--to-ref, SKIP=; how hook environments are built and cached (PRE_COMMIT_HOME, clean, gc); local hooks and language: system; autoupdate (--freeze) and try-repo; pre-commit.ci and its limits; the ruff hooks (verify the current ids ruff-check and ruff-format) and uv-based hooks (verify what exists); running it in CI; why a hook that modifies files fails the first commit; the unstaged-changes stash behaviour and its conflicts; --no-verify; supply-chain risk (a hook repo executes code, pin rev); monorepo and performance.',
    notOwn: 'ruff rules and configuration and the ruff CI runner and its pre-commit wiring (topic 05 — link the relevant chunks, do not repeat), secrets policy (topic 08 — de-link until it lands).',
    extra: P7_BANK_NOTE,
  },
  {
    id: 'p7-12', lane: 'p7', slug: '12-publishing-to-pypi', n: 12, title: 'Publishing to PyPI', label: '12 · Publishing to PyPI',
    tier: 'Know', tierClass: 't-know', bank: 'research_python_p07_t12_publishing_to_pypi.md',
    syllabus: 'Publishing to PyPI: build backends, uv build/twine, versioning, trusted publishing from CI',
    phaseRow: 'Build backends, uv build/twine, versioning, trusted publishing from CI',
    owns: 'Choosing a build backend (uv_build, hatchling, setuptools, flit-core, maturin — link topic 01 for the [build-system] fields); uv build and python -m build producing the sdist and wheel in dist/; checking before upload (twine check, and what it validates); TestPyPI; uv publish and twine upload; credentials (project-scoped API tokens, __token__, 2FA); trusted publishing (OIDC, pending publishers, the id-token: write permission, GitHub environments, the pypa/gh-action-pypi-publish action — verify its current tag) and attestations (PEP 740 — verify what is generated by default); versioning (PEP 440 rules, dynamic versions from git tags with hatch-vcs or setuptools-scm, uv version, the rule that a filename can never be re-uploaded even after deletion); yanking (PEP 592) vs deleting; name normalisation and typosquatting; classifiers and license-expression (PEP 639); README rendering; a smoke test that installs from TestPyPI into a clean environment (the extra-index-url dependency-confusion trap); a release workflow that splits build from publish and passes artifacts between jobs; private indexes (mention).',
    notOwn: 'What a wheel or sdist contains (topic 07 — link if landed, else de-link), pyproject fields (topic 01), dependency locking (topic 03), the ruff/pre-commit gates (topics 05, 11).',
    extra: P7_BANK_NOTE + ' Verify the current releases of actions/checkout, astral-sh/setup-uv, actions/upload-artifact, actions/download-artifact and pypa/gh-action-pypi-publish on the day you write, and name them on the Verified line.',
  },
]
const TOPIC_BY_ID = {}
for (const t of TOPICS) TOPIC_BY_ID[t.id] = t

const AUTHOR_SCHEMA = {
  type: 'object',
  properties: {
    topic: { type: 'string' },
    complete: { type: 'boolean', description: 'true only if every planned chunk is on disk, the README lists all of them, and mdx-compile-check plus linkcheck are clean for the whole directory' },
    chunks: { type: 'integer' },
    lines: { type: 'integer' },
    stars: { type: 'integer' },
    bankFile: { type: 'string' },
    plannedButNotWritten: { type: 'array', items: { type: 'string' } },
    defectsInOtherTopics: { type: 'array', items: { type: 'string' }, description: 'path:line plus what is wrong, for files OUTSIDE your directory' },
    pinsNeeded: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, version: { type: 'string' }, source: { type: 'string' } }, required: ['name', 'version', 'source'] } },
    tierDisagreement: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['topic', 'complete', 'chunks', 'lines', 'stars'],
}

const WIRE_SCHEMA = {
  type: 'object',
  properties: {
    topic: { type: 'string' },
    gatePassed: { type: 'boolean' },
    wired: { type: 'boolean', description: 'true only if the gate passed, the topic and the wiring are committed, and the phase README row, progress.js and the cursor are updated' },
    metrics: { type: 'string', description: 'the METRICS line of the final gate run' },
    topicCommit: { type: 'string' },
    wiringCommit: { type: 'string' },
    storeCommit: { type: 'string' },
    phaseCount: { type: 'integer', description: 'topics of this phase now linked in the phase README, out of its total' },
    relinked: { type: 'integer' },
    fixesMade: { type: 'array', items: { type: 'string' } },
    deferredRelinks: { type: 'array', items: { type: 'string' } },
    pinsAdded: { type: 'array', items: { type: 'string' } },
    unresolved: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['topic', 'gatePassed', 'wired'],
}

const DEFECT_SCHEMA = {
  type: 'object',
  properties: {
    job: { type: 'string' },
    fixed: { type: 'array', items: { type: 'string' }, description: 'file and what was changed and what source confirmed it' },
    alreadyCorrect: { type: 'array', items: { type: 'string' }, description: 'claims you verified and found already right, with the source' },
    notFixed: { type: 'array', items: { type: 'string' }, description: 'file and why' },
    commits: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['job', 'fixed', 'notFixed', 'commits'],
}

const RULES = `HARD RULES — every one was paid for by an earlier incident on this track.

1. OWNERSHIP. You own exactly one directory (given below) and nothing else. The only write allowed outside it is your research bank file. Never edit src/data/progress.js, src/data/pins.js, any phase README, any other topic, the syllabus, or any memory file. A defect you notice elsewhere goes in defectsInOtherTopics; you do not fix it.
2. BANK FIRST. Research the whole topic once from primary sources (docs.python.org/3.14, the PEPs and PyPA specifications, CPython source at tag v3.14.7, each tool's own documentation at the pinned version). Write the bank file BEFORE the first chunk: every load-bearing sentence quoted verbatim with its URL, marked "do not re-derive". Write every chunk from the bank; never re-fetch per chunk. If the bank file already exists, read it and continue from it.
3. README FIRST, and stay committable after every file. Write README.md before any chunk and update it as each chunk lands. README frontmatter: title (a full-sentence thesis, like the closed topics), sidebar_label: "Overview", sidebar_position: 0. Then the tier badge line, the > Verified: blockquote (bold the pinned version on its first line), a bold thesis paragraph, a ## Chunks table (# | Chunk | What it argues), ## Phase gate, ## Where this connects, and a footer line. Open docs/python/pages/phase-7-packaging-tooling/06-entry-points/README.md and two of its chunks first and match their shape.
4. NEVER LINK FORWARD. Add a chunk to the README table, and a Next link to a footer, only AFTER the target chunk exists on disk. A planned but unwritten chunk is written as bold text followed by *(not written yet)*, never as a link. One dangling link fails the whole site's deploy.
5. FOOTERS. Every chunk ends with a real footer written together with the chunk, in the corpus form: ← [prev label](prev.md) · [Topic index](README.md) · Next → [next label](next.md). The literal marker {/* FOOTER */} must never be left in a file. When chunk N+1 lands, edit chunk N's footer to point at it.
6. LINKS OUT. You may link only to a file that git tracks (check: git ls-files <path>) and that you have confirmed with ls. Sibling topics you may link are listed below, plus phases 0-2 (docs/python/pages/phase-0-runtime, phase-1-language-core, phase-2-functions). Any link to any other topic — including topics other agents are writing right now — is written as bold text plus *(not written yet)*; the coordinator re-links after that topic lands. The phase index ../README.md is always fine. Inside a > *"..."* quote every href belongs to the site being quoted: make relative hrefs absolute, and never point a quoted anchor at one of our headings.
7. THE 300-LINE CAP IS A FILE-SIZE CAP, NEVER A CONTENT BUDGET. Write it all, then split on a concept boundary into a lettered sibling (03b-...) that takes the next free integer sidebar_position. Renumbering positions is safe; renaming files is not. Never trim, merge or drop anything to fit; after any split both wc -l and grep -c '^[*][*]★' totals must go UP. Letters are IDs; sidebar_position carries reading order. Positions are integers, unique within the directory, never fractional. A run of near-identical gotcha counts, or pages clustering just under 300 lines, means you templated instead of exhausting the topic.
8. WHAT EVERY CHUNK CONTAINS. Frontmatter (title = the page's claim as a full sentence; sidebar_label "NN · Short label" with a middle dot; sidebar_position); the tier badge line; a > Verified: line naming the primary sources, the date (2026-09) and the pinned version in bold on its first line, saying honestly "documentation- and source-validated — no sandbox run"; the body; ## Gotchas, each entry Symptom -> Cause -> Fix with the fix SHOWN IN CODE and entries opening with **★ when frequently hit; ## Interview questions, 3 to 8, answers in prose, ★ on the frequently asked, preferring "why" and "what happens if". Both headings exact. Code is complete Python with realistic names and no "..." elisions; anything not runnable is labelled # pseudo-code. Never fabricate program output — this track carries code, not invented output.
9. DEPTH BAR. The bar is the reference page you wish you had at 2am with the thing broken in production. Closed topics on this track run 14-39 chunks and 3,000-9,000 lines; a topic that comes back at 5 chunks has not been exhausted. The tier is an effort label for readers, not permission for you to skim: cover every gotcha and failure mode the subject genuinely has and show the fix. Do not repeat a sibling topic — link it.
10. TIER is given below as a bare fact. Write exactly that badge even if you disagree, and record the disagreement in tierDisagreement.
11. MDX. The docs compile as MDX. Outside code fences and inline backticks, a bare < or <= or { or } breaks the build: put operators and placeholders such as <name> or {name} inside inline backticks or escape them; the only legal {...} outside code is {/* ... */}. Quoted upstream error messages bite hardest. After EVERY chunk, from the repo root, run: node /mnt/Storage/my-learning/claude/shared/scripts/mdx-compile-check.mjs <your dir>  (must end "0 failed" and print no EXPRESSION line) and node scripts/linkcheck.mjs <your dir>  (must say 0 problem(s)). yarn is not on PATH here; never run yarn build.
12. NO GIT WRITES. Never run git add, commit, stash, checkout, reset, restore or clean. A background committer commits each finished file once it has been untouched for 90 seconds and passes the two checks above — so finish a file, then leave it alone.
13. SCRATCH. Any helper script or scratch file goes under ${SCRATCH}/<slug>/ — never inside the topic directory (a stray .py or _scratch/ in docs/ is committed by accident and fails the gate).
14. PINS. Do not edit src/data/pins.js. Any library or tool you teach that has no pin (check: grep -n <name> src/data/pins.js) goes in pinsNeeded with the version you verified from its primary source (PyPI JSON API https://pypi.org/pypi/<name>/json or the GitHub releases page) and the URL.
15. REPORT HONESTLY. complete=true only if every chunk you planned is on disk, the README lists all of them, and both commands in rule 11 are clean for your whole directory. If you ran out of room, say complete=false and list plannedButNotWritten. Report chunks (count of .md files minus the README), lines (cat all .md | wc -l) and stars (cat all .md | grep -c '^[*][*]★').`

const landed = { p3: [], p7: [] }
const inFlight = new Set()
const results = []
const jobs = [
  { kind: 'defect', id: 'defects-p3', lane: 'p3' },
  { kind: 'defect', id: 'defects-p7', lane: 'p7' },
  ...['p3-08', 'p7-07', 'p3-09', 'p7-08', 'p3-10', 'p7-09', 'p3-11', 'p7-10', 'p3-12', 'p7-11', 'p7-12'].map((id) => ({ kind: 'topic', id, t: TOPIC_BY_ID[id] })),
]
let cursorIdx = 0

function authorPrompt(t, mode, prev) {
  const L = LANES[t.lane]
  const dir = L.phaseDir + '/' + t.slug
  const bank = STORE + '/devbible/' + t.bank
  const linkable = [...L.closed, ...landed[t.lane]].map((s) => L.phaseDir + '/' + s + '/').join('  ')
  const others = [...inFlight].filter((id) => id !== t.id).map((id) => LANES[TOPIC_BY_ID[id].lane].phaseDir + '/' + TOPIC_BY_ID[id].slug).join('  ')
  const owed = prev && prev.plannedButNotWritten && prev.plannedButNotWritten.length ? prev.plannedButNotWritten.join('; ') : 'work out from the README and the bank what is still owed'
  const head = mode === 'resume'
    ? 'RESUME. An earlier agent stopped partway through this topic. Before writing anything: ls the directory, read README.md and the headings, gotchas and footers of every chunk on disk, and read the bank file. Then EXTEND — never rewrite or trim what exists. Write the chunks still missing (' + owed + '), repair any file that fails the checks in rule 11, and finish with the README listing every chunk.'
    : 'FRESH TOPIC. The directory does not exist yet.'
  return [
    'You are writing ONE topic of the devbible Python track (phase ' + L.phaseN + '), repo ' + REPO + '. Read .agents/skills/devbible-topic/SKILL.md and follow it exactly — including the three references it names (authoring-contract.md, house-style.md, verification.md) — before you write anything.',
    '',
    head,
    '',
    'TOPIC: ' + t.title,
    'DIRECTORY (you own it): ' + dir,
    'TIER (bare fact): ' + t.tier + '  ->  badge line exactly: <span className="db-tier ' + t.tierClass + '">' + t.tier + '</span>',
    '_category_.json (exact content, one line): {"label":"' + t.label + '","position":' + t.n + ',"collapsed":true}',
    'BANK FILE (write it first, do not re-derive): ' + bank,
    'VERSION SPINE: ' + L.spine,
    '',
    'SYLLABUS ROW: ' + t.syllabus,
    'PHASE README ROW (one-liner, already fixed — the coordinator wires it): ' + t.phaseRow,
    '',
    'THIS TOPIC OWNS: ' + t.owns,
    '',
    'THIS TOPIC DOES NOT OWN (link the sibling, never repeat it): ' + t.notOwn,
    '',
    'NOTES: ' + t.extra,
    '',
    'SIBLING TOPICS YOU MAY LINK (on disk and committed): ' + linkable,
    'TOPICS BEING WRITTEN RIGHT NOW BY OTHER AGENTS — never link into them, and do not read them as if they were final: ' + (others || 'none'),
    '',
    RULES,
    '',
    'Finish by returning the structured report.',
  ].join('\n')
}

function wirePrompt(t, r) {
  const L = LANES[t.lane]
  const dir = L.phaseDir + '/' + t.slug
  const busy = [...inFlight].filter((id) => id !== t.id).map((id) => LANES[TOPIC_BY_ID[id].lane].phaseDir + '/' + TOPIC_BY_ID[id].slug)
  const remaining = jobs.slice(cursorIdx).filter((j) => j.kind === 'topic').map((j) => j.t.slug)
  const partial = results.filter((x) => x.status === 'partial').map((x) => x.id)
  const pins = r.pinsNeeded && r.pinsNeeded.length ? r.pinsNeeded.map((p) => p.name + ' ' + p.version + ' (' + p.source + ')').join('; ') : 'none reported'
  const other = r.defectsInOtherTopics && r.defectsInOtherTopics.length ? r.defectsInOtherTopics.join(' | ') : 'none reported'
  return [
    'You are the gate, commit and wiring step for ONE finished devbible Python topic: ' + dir + '  (' + t.title + ', tier ' + t.tier + '). Repo ' + REPO + '. You are the ONLY agent editing the shared wiring files (phase README, src/data/progress.js, src/data/pins.js, the memory-store cursors) right now — other agents are writing topic directories in parallel; leave those alone.',
    '',
    'The author reported: chunks=' + r.chunks + ' lines=' + r.lines + ' stars=' + r.stars + '. Pins the author says it needs: ' + pins + '. Defects the author saw in other topics: ' + other + '.',
    'Directories other agents are writing right now (never edit, never gate on them): ' + (busy.join('  ') || 'none'),
    'Topics not yet started in this phase queue: ' + (remaining.join(', ') || 'none') + '.  Topics that stopped partway earlier this run: ' + (partial.join(', ') || 'none') + '.',
    '',
    'HARD RULES: never git add -A; never git add/commit by hand in the devbible repo — use bash ' + SCRIPTS + '/py-commit.sh "<subject>" <explicit path>... which is flock-serialised and adds the attribution trailer; in the memory store use bash ' + SCRIPTS + '/store-commit.sh "<subject>" <explicit path>... ; never push; never run yarn (not on PATH) or yarn build; never edit content beyond what a step below allows.',
    '',
    'STEP 1 — GATE. From ' + REPO + ' run: bash ' + SCRIPTS + '/topic-gate.sh ' + dir + '   It prints ok/WARN/FAIL lines, a METRICS line and GATE PASS or GATE FAIL.',
    'STEP 2 — REPAIR, mechanical hygiene only, at most 3 rounds, re-running the gate after each. Allowed: (a) an unwired {/* FOOTER */} marker -> python3 ' + SCRIPTS + '/wire-footers.py ' + dir + ' (footer-only, idempotent); (b) a stray helper file or subdirectory in the topic dir -> MOVE it to ' + SCRATCH + '/stray/ (do not delete); (c) a dangling link to our own not-yet-written chunk -> de-link to bold text plus *(not written yet)*; a dangling relative href inside a > *"..."* quote -> make it an absolute upstream URL; (d) a bare < or { that MDX rejects -> wrap in inline backticks or escape it, the smallest edit; (e) a chunk missing from the README table -> add its row in the house style; (f) a file over 300 lines -> split on a concept boundary into a lettered sibling taking the next free integer sidebar_position, renumbering positions (safe) but never renaming files, and record wc -l and star totals before and after: BOTH must go up; (g) a fractional or duplicate sidebar_position -> renumber. Anything else (content errors, thin chunks, missing Gotchas or Interview sections shown as WARN) is NOT yours to rewrite: list it in unresolved. If after 3 rounds the gate still fails, do NOT commit and do NOT wire: return wired=false with the failing lines in unresolved.',
    'STEP 3 — COMMIT THE TOPIC. bash ' + SCRIPTS + '/py-commit.sh "python ' + L.ph + ': close ' + t.slug + ' (<chunks> chunks, <lines> lines, <stars> ★)" ' + dir + '   (a directory path is an explicit path; the background committer may have committed most files already — "nothing to commit" is fine). Record the hash from git log -1.',
    'STEP 4 — WIRE. Do these in order:',
    ' 4a. Phase README ' + L.phaseDir + '/README.md — this topic\'s table row currently shows the title in bold followed by *(not written yet)*. Rewrite it in the style of the closed rows directly above it (open one): the title becomes a link to ./' + t.slug + '/README.md followed by " · N chunks" where N is the METRICS chunks count; keep the tier badge and the one-liner. Count the rows that now link; update the line beginning "🚧 **In flight —" to the new n of 12. If n is 12, replace that line with "✅ **Complete — 12 of 12.**" and remove any remaining caution box or still-to-come text in that README.',
    ' 4b. Re-link sweep — ' + 'find every mention under docs/python of the form bold title plus *(not written yet)* (grep -rn "(not written yet)" docs/python), and for every one that names a topic or chunk that now exists on disk AND is tracked by git (this topic, or any earlier topic that landed since), turn it into a working relative link (README.md of the topic, or the specific chunk when the mention names one). Leave mentions of topics that do not exist yet. Never edit inside the directories listed as busy above (report those mentions in deferredRelinks) and never edit inside a > *"..."* quote. Count the mentions you re-linked.',
    ' 4c. src/data/progress.js — in the python entry, phase n:' + L.phaseN + ': set pages to the phase count from 4a; make sure the row carries pagesPlanned: 12 (phase 3 is missing it, which makes the dashboard credit all 12 topics while only some are written — add it; phase 7 already has it); set the python updated stamp to the current time in the existing format YYYY-MM-DD HH:MM (use date). Then node --check src/data/progress.js (an ESM-warning is fine, a syntax error is not).',
    ' 4d. src/data/pins.js — for every pin the author needs, verify the version yourself from the primary source (curl -s https://pypi.org/pypi/<name>/json | python3 -c ... for the version, or the GitHub releases API), skip any name already present, and add an entry after the last python entry in the shape of its neighbours (label, source in one of the forms npm:/eol:/gh: described in the file header — gh:owner/repo for a PyPI-only library, policy latest, pin, checked = today, tracks [\'python\'], names). If the author reported none, do nothing here.',
    ' 4e. Checks — run node /mnt/Storage/my-learning/claude/shared/scripts/mdx-compile-check.mjs and node scripts/linkcheck.mjs over the phase README and over every directory you edited a file in. Both must be clean. Do not gate on the busy directories.',
    ' 4f. Commit the wiring: bash ' + SCRIPTS + '/py-commit.sh "python ' + L.ph + ': wire ' + t.slug + ' — phase row, <n> of 12, progress.js, re-link <k> mentions" <every file you edited, listed explicitly>',
    'STEP 5 — MEMORY STORE (' + STORE + '). (i) In ' + L.cursor + ' edit the top block IN PLACE, never append a new block and never let the file pass 300 lines: add this topic to the CLOSED line as "' + t.slug + ' N chunks · L lines · S ★ (<topicCommit>)"; rewrite the "COLD START" / next-action line to say: topics in flight = (' + (busy.join(', ') || 'none') + '), next unstarted = (' + (remaining.join(', ') || 'none') + '), and that an interrupted topic is salvaged with bash ' + SCRIPTS + '/topic-gate.sh <dir> then py-commit.sh; add each defect the author reported in other topics as one line under the owed-defects list (path:line + what is wrong). (ii) In ' + STORE + '/devbible/LOCKS.md update only the counts and next-topic text of this lane\'s row, in place (that file has a 160-line budget). (iii) bash ' + SCRIPTS + '/store-commit.sh "devbible python ' + L.ph + ': closed ' + t.slug + ' — cursor and board" ' + L.cursor + ' ' + STORE + '/devbible/LOCKS.md ' + STORE + '/devbible/' + t.bank + '   (the bank file may already be committed; "nothing to commit" is fine).',
    'STEP 6 — return the structured report. wired=true only if the gate passed and steps 3-5 all completed.',
  ].join('\n')
}

function defectPrompt(job) {
  const common = 'You are fixing owed FACTUAL defects in already-published, closed devbible Python pages. Repo ' + REPO + '. Read .agents/skills/devbible-topic/SKILL.md (its re-validation job) and .agents/references/verification.md first. Rule of the project: a live page that is WRONG outranks a topic that is missing. For every item: open the file, read the surrounding chunk, verify the claim against the PRIMARY source named below (fetch it — curl -s works for raw.githubusercontent.com, GitHub API, PyPI JSON; WebFetch for docs), change the page only as far as the evidence supports, and quote the source on the page in the corpus style. Keep every file under 300 lines (if a fix needs room, split on a concept boundary into a lettered sibling that takes the next free integer sidebar_position; never trim; wc -l and star totals must both go up). MDX rules: outside code fences and inline backticks a bare < or { breaks the build; put placeholders in inline backticks. Links: only to files that git tracks; a link inside a > *"..."* quote belongs to the quoted site. Scratch files under ' + SCRATCH + '/defects/ only. After editing, run for each touched topic directory: bash ' + SCRIPTS + '/topic-gate.sh <dir> (must PASS). Commit with bash ' + SCRIPTS + '/py-commit.sh "<accurate subject>" <explicit file paths> — never git add -A, never push, never yarn. Do NOT edit any cursor or memory file and do NOT edit src/data/progress.js or src/data/pins.js; the coordinator does. If a claim turns out to be RIGHT, leave the page and report it under alreadyCorrect with the source.'
  if (job.lane === 'p3') {
    return common + '\n\nJOB defects-p3 — phase 3, directory ' + P3 + '\n' +
      '1. 05-slicing/10c-setitem-delitem-and-the-abcs.md implies UserList routes every write through __setitem__. In 3.14.7 append/extend/insert/+=/the constructor write self.data directly. Verify in https://raw.githubusercontent.com/python/cpython/v3.14.7/Lib/collections/__init__.py (class UserList), fix the claim, and link the 06-collections-module chunk that has it right (ls that topic to find the chunk on UserList — it is named 08 in the cursor).\n' +
      '2. 03-dict/02b-working-with-the-order.md near line 230 says next(iter(d)) is O(1). After many deletions from the front the iterator has to skip dead entries until the next resize (dictiter_iternextkey in Objects/dictobject.c at v3.14.7). Verify against that source and correct the complexity statement precisely (what is O(1), what is not, and when).\n' +
      '3. 01-list-internals/07b-merging-and-galloping.md: the sorted_stream fix keeps every sorted run in memory, which defeats the memory argument the page is making. Read the page, find the example and the claim, and fix the code or the claim so they agree, verifying against the heapq.merge documentation.\n' +
      '4. 04-set-and-frozenset/02-*.md near line 123 promises a chunk called 14b that is not written and whose intent is unclear. Find it; either point the promise at the existing chunk that already covers it, or reword the sentence so it promises nothing that does not exist. Report which you did.\n' +
      'Commit each topic\'s fixes separately with a subject like "python ph3: fix owed defect — <what> (<topic>)".'
  }
  return common + '\n\nJOB defects-p7 — phase 7, directory ' + P7 + '\n' +
    '1. 01-pyproject-toml/10-entry-points-and-console-scripts.md says a dot-for-colon value fails at RUN time with ModuleNotFoundError; pip 26.2.1, installer 1.0.1 and uv 0.12.12 reject it at INSTALL time. Same file: entry points are NOT how pip finds a PEP 517 backend (the build-backend string is imported), and the Packaging guide uses Flask as a naming-convention example, not an entry-point one. The verified quotes are banked in ' + STORE + '/devbible/research_python_p07_t06_entry_points.md and the closed topic 06-entry-points/01-what-the-installer-writes.md — read them, re-verify the load-bearing ones against the primary source, fix all three claims, and link topic 06 where it helps.\n' +
    '2. 02-uv/02c-uv-sync-makes-the-environment-match.md carries an "unconfirmed" caveat about whether uv re-syncs after [project.scripts] is edited. uv\'s cache documentation settles it and 06-entry-points/07-uv-run-and-the-project-command.md quotes it. Verify the quote, drop the caveat, state the settled behaviour, and link the 06 chunk.\n' +
    '3. 02-uv/09b-uv-build-and-uv-publish.md near line 92 still says 04 · Project layout (not written yet). That topic is written: re-link it to ../04-project-layout/README.md (or the specific chunk it means). Then sweep the whole phase: grep -rn "(not written yet)" ' + P7 + ' and re-link every mention that names something now on disk (topics 04, 05, 06 are on disk; 07-12 are not — leave those).\n' +
    '4. CURRENCY of CI snippets. Read .agents/skills/devbible-currency/SKILL.md first. Known stale action pins: 03-dependencies/20-the-ci-flags-that-refuse-to-re-resolve.md, 02-uv/05c-interpreter-upgrades-and-ci-matrices.md and 02-uv/03b-upgrading-the-lockfile.md (line 80 pins actions/checkout@v4) still use old pins such as astral-sh/setup-uv@v5, peter-evans/create-pull-request@v7 and actions/checkout@v4. Facts recorded 2026-09-10 (re-verify each on the GitHub releases page or API today before editing): actions/checkout@v7 exists; astral-sh/setup-uv has published NO floating major tag since v8 (its v8.0.0 release notes say you cannot use @v8 or @v8.0 any longer), so a snippet bumped to @v10 would break — use @v10.0.1 or a commit SHA; astral-sh/ruff-action has no v4 tag; peter-evans/create-pull-request latest major is v8. Then grep the whole phase for every other "uses: owner/action@ref" line (grep -rnE "uses: *[A-Za-z0-9_./-]+@" ' + P7 + ') and fix each stale pin the same way, checking the input names each action version still accepts before you change a ref. Do not touch pins that are already right.\n' +
    'Commit each topic\'s fixes separately with a subject like "python ph7: fix owed defect — <what> (<topic>)".'
}

const serial = (fn) => {
  const run = wiringChain.then(fn)
  wiringChain = run.then(() => {}, () => {})
  return run
}
let wiringChain = Promise.resolve()

async function runDefect(job, slot) {
  log('slot ' + slot + ': ' + job.id + ' — verifying and fixing owed defects')
  const r = await agent(defectPrompt(job), { label: job.id, phase: 'Defects', agentType: 'general-purpose', schema: DEFECT_SCHEMA })
  if (!r) return { id: job.id, status: 'died' }
  log(job.id + ': fixed ' + r.fixed.length + ', not fixed ' + r.notFixed.length + ', commits ' + r.commits.length)
  return { id: job.id, status: 'done', report: r }
}

async function runTopic(t, slot) {
  const L = LANES[t.lane]
  inFlight.add(t.id)
  try {
    log('slot ' + slot + ': authoring ' + t.id + ' ' + t.slug)
    let r = await agent(authorPrompt(t, 'fresh', null), { label: 'author ' + t.slug, phase: 'Author', agentType: 'devbible-author', schema: AUTHOR_SCHEMA })
    if (!r || !r.complete) {
      log(t.id + ': author ' + (r ? 'reported incomplete' : 'died') + ' — one resume pass')
      const r2 = await agent(authorPrompt(t, 'resume', r), { label: 'resume ' + t.slug, phase: 'Author', agentType: 'devbible-author', schema: AUTHOR_SCHEMA })
      if (r2) r = r2
    }
    if (!r || !r.complete) {
      log(t.id + ': NOT complete after resume — finished files stay committed by the background committer; topic is not wired')
      return { id: t.id, status: 'partial', author: r }
    }
    log(t.id + ': author done — ' + r.chunks + ' chunks, ' + r.lines + ' lines, ' + r.stars + ' ★; waiting for the wiring mutex')
    const w = await serial(() => agent(wirePrompt(t, r), { label: 'gate+wire ' + t.slug, phase: 'Gate and wire', agentType: 'general-purpose', schema: WIRE_SCHEMA }))
    if (w && w.wired) landed[t.lane].push(t.slug)
    log(t.id + ': ' + (w && w.wired ? 'CLOSED and wired' : 'NOT wired') + (w && w.unresolved && w.unresolved.length ? ' — unresolved: ' + w.unresolved.slice(0, 3).join(' | ') : ''))
    return { id: t.id, status: w && w.wired ? 'closed' : 'unwired', author: r, wire: w }
  } finally {
    inFlight.delete(t.id)
  }
}

async function worker(slot) {
  while (cursorIdx < jobs.length) {
    const job = jobs[cursorIdx++]
    try {
      results.push(job.kind === 'defect' ? await runDefect(job, slot) : await runTopic(job.t, slot))
    } catch (e) {
      log('slot ' + slot + ': ' + job.id + ' threw — ' + String(e).slice(0, 200))
      results.push({ id: job.id, status: 'error', error: String(e).slice(0, 300) })
    }
  }
}

phase('Defects')
await Promise.all([worker(1), worker(2), worker(3)])

const closed = results.filter((x) => x.status === 'closed').map((x) => x.id)
const notClosed = results.filter((x) => x.status !== 'closed' && x.status !== 'done').map((x) => x.id + ':' + x.status)
log('finished — closed ' + closed.length + ' topics (' + closed.join(', ') + '); not closed: ' + (notClosed.join(', ') || 'none'))
return {
  closed,
  notClosed,
  landed,
  summary: results.map((x) => ({
    id: x.id,
    status: x.status,
    metrics: x.wire ? x.wire.metrics : (x.author ? x.author.chunks + ' chunks / ' + x.author.lines + ' lines / ' + x.author.stars + ' stars' : undefined),
    unresolved: x.wire ? x.wire.unresolved : undefined,
    defectsFound: x.author ? x.author.defectsInOtherTopics : undefined,
    notFixed: x.report ? x.report.notFixed : undefined,
  })),
}
