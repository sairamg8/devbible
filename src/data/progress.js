/**
 * Single source of truth for "how much of the bible is written".
 *
 * Update the `pages` number on a phase the moment its explanations land, and
 * every progress indicator on the site follows — the homepage bar, the card
 * stats, and the `<Progress />` block inside the docs. Nothing else is
 * hand-maintained, so the UI can never disagree with itself.
 *
 * `topics`       syllabus row count for that phase (they sum to 248 for Node).
 * `pages`        explanation pages written so far; 0 means not started.
 * `pagesPlanned` set only while a phase is mid-flight, so the bar can show
 *                partial credit. Remove it when the phase is finished.
 */

export const LANGUAGES = {
  css: {
    label: 'CSS',
    docsPath: '/docs/css',
    pagesPath: '/docs/css/pages',
    phases: [
      {n: 0, slug: 'phase-0-how-css-runs', name: 'How CSS runs', part: 'How CSS resolves', topics: 5, pages: 12},
      {n: 1, slug: 'phase-1-selectors', name: 'Selectors', part: 'How CSS resolves', topics: 6, pages: 16},
      {n: 2, slug: 'phase-2-cascade', name: 'Cascade control', part: 'How CSS resolves', topics: 5, pages: 5},
      {n: 3, slug: 'phase-3-custom-properties', name: 'Custom properties and modern values', part: 'Values and layout', topics: 6, pages: 4},
      {n: 4, slug: 'phase-4-flexbox', name: 'Flexbox, deeply', part: 'Values and layout', topics: 6, pages: 13},
      {n: 5, slug: 'phase-5-grid', name: 'Grid, deeply', part: 'Values and layout', topics: 6, pages: 10},
      {n: 6, slug: 'phase-6-container-queries', name: 'Container queries and intrinsic responsive', part: 'Adaptive and visual', topics: 6, pages: 3},
      {n: 7, slug: 'phase-7-positioning', name: 'Positioning, stacking and overlay', part: 'Adaptive and visual', topics: 6, pages: 4},
      {n: 8, slug: 'phase-8-color-theming', name: 'Colour and theming', part: 'Adaptive and visual', topics: 6, pages: 3},
      {n: 9, slug: 'phase-9-motion', name: 'Motion and the cost model', part: 'Adaptive and visual', topics: 6, pages: 3},
      {n: 10, slug: 'phase-10-scss', name: 'SCSS, practically', part: 'SCSS', topics: 6, pages: 8},
    ],
  },
  javascript: {
    label: 'JavaScript',
    docsPath: '/docs/javascript',
    pagesPath: '/docs/javascript/pages',
    phases: [
      {n: 0, slug: 'phase-0-how-javascript-runs', name: 'How JavaScript runs', part: 'Language core', topics: 12, pages: 12},
      {n: 1, slug: 'phase-1-values-and-coercion', name: 'Values, types and coercion', part: 'Language core', topics: 17, pages: 17},
      {n: 2, slug: 'phase-2-operators', name: 'Operators, expressions and control flow', part: 'Language core', topics: 15, pages: 15},
      {n: 3, slug: 'phase-3-functions', name: 'Functions, scope and closures', part: 'Language core', topics: 20, pages: 8, pagesPlanned: 20},
      {n: 4, slug: 'phase-4-objects-and-classes', name: 'Objects, prototypes and classes', part: 'Language core', topics: 20, pages: 7, pagesPlanned: 20},
      {n: 5, slug: 'phase-5-built-in-library', name: 'The built-in library', part: 'Data & async', topics: 26, pages: 8, pagesPlanned: 26},
      {n: 6, slug: 'phase-6-iteration-and-destructuring', name: 'Iteration, destructuring and generators', part: 'Data & async', topics: 13, pages: 3, pagesPlanned: 13},
      {n: 7, slug: 'phase-7-async', name: 'Asynchronous JavaScript', part: 'Data & async', topics: 22, pages: 11, pagesPlanned: 22},
      {n: 8, slug: 'phase-8-modules-errors', name: 'Modules, errors, memory and the toolchain', part: 'Data & async', topics: 18, pages: 4, pagesPlanned: 18},
      {n: 9, slug: 'phase-9-dom', name: 'The DOM', part: 'Web APIs', topics: 19, pages: 6, pagesPlanned: 19},
      {n: 10, slug: 'phase-10-events', name: 'Events and user input', part: 'Web APIs', topics: 14, pages: 2, pagesPlanned: 14},
      {n: 11, slug: 'phase-11-network-storage', name: 'Network, storage and data transfer', part: 'Web APIs', topics: 4, pages: 0},
      {n: 12, slug: 'phase-12-browser-platform', name: 'The browser platform', part: 'Web APIs', topics: 3, pages: 0},
      {n: 13, slug: 'phase-13-complexity', name: "Complexity and JavaScript's real costs", part: 'DSA & machine coding', topics: 10, pages: 0},
      {n: 14, slug: 'phase-14-data-structures', name: 'Core data structures in JavaScript', part: 'DSA & machine coding', topics: 6, pages: 0},
      {n: 15, slug: 'phase-15-algorithm-patterns', name: 'Algorithmic patterns', part: 'DSA & machine coding', topics: 20, pages: 0},
      {n: 16, slug: 'phase-16-dynamic-programming', name: 'Dynamic programming and the harder set', part: 'DSA & machine coding', topics: 16, pages: 0},
      {n: 17, slug: 'phase-17-machine-coding', name: 'Machine coding: implement it yourself', part: 'DSA & machine coding', topics: 18, pages: 0},
      {n: 18, slug: 'phase-18-storefront', name: 'Building the store front end', part: 'Applied storefront', topics: 18, pages: 0},
    ],
  },
  typescript: {
    label: 'TypeScript',
    docsPath: '/docs/typescript',
    pagesPath: '/docs/typescript/pages',
    phases: [
      {n: 0, slug: 'phase-0-how-typescript-runs', name: 'How TypeScript runs', part: 'The type system', topics: 13, pages: 13},
      {n: 1, slug: 'phase-1-type-vocabulary', name: 'The type vocabulary', part: 'The type system', topics: 17, pages: 17},
      {n: 2, slug: 'phase-2-narrowing', name: 'Narrowing and control flow analysis', part: 'The type system', topics: 13, pages: 0},
      {n: 3, slug: 'phase-3-generics', name: 'Generics', part: 'The type system', topics: 14, pages: 0},
      {n: 4, slug: 'phase-4-classes-declarations', name: 'Classes, objects and declaration merging', part: 'Types at scale', topics: 14, pages: 0},
      {n: 5, slug: 'phase-5-type-level', name: 'Type-level programming', part: 'Types at scale', topics: 16, pages: 0},
      {n: 6, slug: 'phase-6-modules-build', name: 'Modules, declarations and the build', part: 'Types at scale', topics: 16, pages: 0},
      {n: 7, slug: 'phase-7-server', name: 'TypeScript on the server', part: 'In the stack', topics: 15, pages: 0},
      {n: 8, slug: 'phase-8-react', name: 'TypeScript in React', part: 'In the stack', topics: 14, pages: 0},
      {n: 9, slug: 'phase-9-boundary', name: 'Types at the boundary', part: 'In the stack', topics: 15, pages: 0},
      {n: 10, slug: 'phase-10-strictness', name: 'Strictness and correctness', part: 'Rigour and tooling', topics: 13, pages: 0},
      {n: 11, slug: 'phase-11-migration', name: 'Migration and legacy', part: 'Rigour and tooling', topics: 12, pages: 0},
      {n: 12, slug: 'phase-12-tooling', name: 'Tooling, performance and testing', part: 'Rigour and tooling', topics: 15, pages: 0},
    ],
  },
  mongodb: {
    label: 'MongoDB',
    docsPath: '/docs/mongodb',
    pagesPath: '/docs/mongodb/pages',
    phases: [
      {n: 0, slug: 'phase-0-how-mongodb-runs', name: 'How MongoDB runs', part: 'The document model', topics: 5, pages: 5},
      {n: 1, slug: 'phase-1-documents-and-bson', name: 'Documents, BSON types and _id', part: 'The document model', topics: 6, pages: 0},
      {n: 2, slug: 'phase-2-mongosh', name: 'mongosh, mastered', part: 'The document model', topics: 5, pages: 0},
      {n: 3, slug: 'phase-3-schema-design', name: 'Schema design and modelling', part: 'The document model', topics: 6, pages: 0},
      {n: 4, slug: 'phase-4-crud', name: 'CRUD and DML', part: 'Querying', topics: 6, pages: 0},
      {n: 5, slug: 'phase-5-query-operators', name: 'Query operators and projection', part: 'Querying', topics: 6, pages: 0},
      {n: 6, slug: 'phase-6-aggregation', name: 'The aggregation pipeline', part: 'Querying', topics: 6, pages: 0},
      {n: 7, slug: 'phase-7-indexes', name: 'Indexes and the query planner', part: 'Querying', topics: 6, pages: 0},
      {n: 8, slug: 'phase-8-node-driver', name: 'The Node.js driver, end to end', part: 'From Node', topics: 6, pages: 0},
      {n: 9, slug: 'phase-9-mongoose', name: 'Mongoose', part: 'From Node', topics: 6, pages: 0},
      {n: 10, slug: 'phase-10-transactions', name: 'Transactions, sessions and consistency', part: 'From Node', topics: 6, pages: 0},
      {n: 11, slug: 'phase-11-replication-sharding', name: 'Replication, sharding and the cluster', part: 'Production', topics: 4, pages: 0},
      {n: 12, slug: 'phase-12-performance-ops', name: 'Performance, monitoring and operations', part: 'Production', topics: 3, pages: 0},
      {n: 13, slug: 'phase-13-security', name: 'Security and deployment', part: 'Production', topics: 5, pages: 0},
      {n: 14, slug: 'phase-14-storefront', name: 'The storefront data layer', part: 'Production', topics: 6, pages: 0},
    ],
  },
  react: {
    label: 'React',
    docsPath: '/docs/react',
    pagesPath: '/docs/react/pages',
    phases: [
      {n: 0, slug: 'phase-0-how-react-runs', name: 'How React runs', part: 'The React model', topics: 17, pages: 14},
      {n: 1, slug: 'phase-1-jsx', name: 'JSX and what a component returns', part: 'The React model', topics: 15, pages: 15},
      {n: 2, slug: 'phase-2-components', name: 'Components, props and composition', part: 'The React model', topics: 16, pages: 16},
      {n: 3, slug: 'phase-3-state', name: 'State and the render cycle', part: 'The React model', topics: 17, pages: 17},
      {n: 4, slug: 'phase-4-effects', name: 'Effects and synchronization', part: 'Hooks, completely', topics: 18, pages: 18},
      {n: 5, slug: 'phase-5-refs-context-reducers', name: 'Refs, context and reducers', part: 'Hooks, completely', topics: 16, pages: 16},
      {n: 6, slug: 'phase-6-performance', name: 'Rendering performance and the React Compiler', part: 'Hooks, completely', topics: 17, pages: 8, pagesPlanned: 17},
      {n: 7, slug: 'phase-7-custom-hooks', name: 'Custom hooks and the Rules of React', part: 'Hooks, completely', topics: 12, pages: 0},
      {n: 8, slug: 'phase-8-concurrent-suspense', name: 'Concurrent rendering, Suspense and transitions', part: 'Concurrent and server', topics: 18, pages: 0},
      {n: 9, slug: 'phase-9-forms-actions', name: 'Forms, Actions and optimistic UI', part: 'Concurrent and server', topics: 14, pages: 0},
      {n: 10, slug: 'phase-10-server-components', name: 'Server Components and Server Functions', part: 'Concurrent and server', topics: 19, pages: 0},
      {n: 11, slug: 'phase-11-ssr-hydration', name: 'Server rendering, hydration and the DOM APIs', part: 'Concurrent and server', topics: 17, pages: 0},
      {n: 12, slug: 'phase-12-data-state', name: 'Data and state in a real app', part: 'Building a real app', topics: 16, pages: 0},
      {n: 13, slug: 'phase-13-routing', name: 'Routing, structure and the app shell', part: 'Building a real app', topics: 14, pages: 0},
      {n: 14, slug: 'phase-14-correctness', name: 'Correctness, testing and delivery', part: 'Building a real app', topics: 18, pages: 0},
    ],
  },
  nodejs: {
    label: 'Node.js',
    docsPath: '/docs/nodejs',
    pagesPath: '/docs/nodejs/pages',
    phases: [
      {n: 0, slug: 'phase-0-runtime-model', name: 'The runtime model', part: 'Foundations', topics: 13, pages: 10},
      {n: 1, slug: 'phase-1-modules', name: 'Modules and packages', part: 'Foundations', topics: 16, pages: 14},
      {n: 2, slug: 'phase-2-async', name: 'Async and the event loop', part: 'Foundations', topics: 26, pages: 22},
      {n: 3, slug: 'phase-3-buffers-streams', name: 'Buffers and streams', part: 'Core I/O', topics: 21, pages: 19},
      {n: 4, slug: 'phase-4-filesystem', name: 'Filesystem, paths, URLs', part: 'Core I/O', topics: 16, pages: 14},
      {n: 5, slug: 'phase-5-http-processes', name: 'Networking, HTTP, processes', part: 'Core I/O', topics: 30, pages: 26},
      {n: 6, slug: 'phase-6-data-access', name: 'Data access', part: 'Application', topics: 16, pages: 16},
      {n: 7, slug: 'phase-7-background-work', name: 'Background work and resilience', part: 'Application', topics: 16, pages: 16},
      {n: 8, slug: 'phase-8-security', name: 'Security', part: 'Application', topics: 27, pages: 27},
      {n: 9, slug: 'phase-9-testing', name: 'Testing', part: 'Application', topics: 20, pages: 20},
      {n: 10, slug: 'phase-10-observability', name: 'Observability and performance', part: 'Production', topics: 23, pages: 23},
      {n: 11, slug: 'phase-11-deployment', name: 'Deployment and operations', part: 'Production', topics: 14, pages: 14},
      {n: 12, slug: 'phase-12-native', name: 'Native and advanced', part: 'Production', topics: 10, pages: 10},
    ],
  },
  expressjs: {
    label: 'Express.js',
    docsPath: '/docs/expressjs',
    pagesPath: '/docs/expressjs/pages',
    phases: [
      // `pages` here counts topics brought to the bible's standard — explained to
      // depth and carrying a `> Verified:` line — NOT files on disk. Every phase
      // below already has outline files (78 of them, linked from the phase READMEs);
      // counting those as finished is what made Express read 100% while the claims
      // table called it a draft. Do not "correct" these back to file counts.
      {n: 0, slug: 'phase-0-express-basics', name: 'Express over node:http', part: 'Foundations', topics: 8, pages: 8},
      {n: 1, slug: 'phase-1-routing', name: 'Routing and path matching', part: 'Foundations', topics: 9, pages: 9},
      {n: 2, slug: 'phase-2-middleware', name: 'Middleware architecture', part: 'Foundations', topics: 9, pages: 9},
      {n: 3, slug: 'phase-3-requests', name: 'Requests and body parsing', part: 'HTTP surface', topics: 12, pages: 12},
      {n: 4, slug: 'phase-4-responses', name: 'Responses and static files', part: 'HTTP surface', topics: 12, pages: 12},
      {n: 5, slug: 'phase-5-errors', name: 'Error handling', part: 'HTTP surface', topics: 9, pages: 9},
      {n: 6, slug: 'phase-6-rest-surface', name: 'REST surface and API features', part: 'API product', topics: 14, pages: 14},
      {n: 7, slug: 'phase-7-layering', name: 'Layering at the edge', part: 'API product', topics: 8, pages: 8},
      {n: 8, slug: 'phase-8-validation-authz', name: 'Validation and authorization', part: 'Edge & ops', topics: 13, pages: 13},
      {n: 9, slug: 'phase-9-hardening', name: 'Hardening middleware', part: 'Edge & ops', topics: 9, pages: 9},
      {n: 10, slug: 'phase-10-app-factory', name: 'Testable app and ops boundary', part: 'Edge & ops', topics: 11, pages: 11},
    ],
  },
  postgresql: {
    label: 'PostgreSQL',
    docsPath: '/docs/postgresql',
    pagesPath: '/docs/postgresql/pages',
    phases: [
      {n: 0, slug: 'phase-0-architecture', name: 'PostgreSQL and its architecture', part: 'Foundations', topics: 12, pages: 13},
      {n: 1, slug: 'phase-1-psql', name: 'psql, mastered', part: 'Foundations', topics: 15, pages: 15},
      {n: 2, slug: 'phase-2-types', name: 'Data types and the relational model', part: 'Foundations', topics: 18, pages: 19},
      {n: 3, slug: 'phase-3-ddl', name: 'DDL: tables, constraints, schema design', part: 'Foundations', topics: 20, pages: 22},
      {n: 4, slug: 'phase-4-crud', name: 'CRUD and DML', part: 'SQL', topics: 20, pages: 22},
      {n: 5, slug: 'phase-5-joins', name: 'Joins and set operations', part: 'SQL', topics: 13, pages: 16},
      {n: 6, slug: 'phase-6-aggregation', name: 'Aggregation, windows and CTEs', part: 'SQL', topics: 16, pages: 40},
      {n: 7, slug: 'phase-7-pg-driver', name: 'The pg driver, end to end', part: 'Node + raw pg', topics: 16, pages: 16},
      {n: 8, slug: 'phase-8-schema-from-node', name: 'Schema and data from Node', part: 'Node + raw pg', topics: 14, pages: 16},
      {n: 9, slug: 'phase-9-api-crud', name: 'CRUD patterns for a real API', part: 'Node + raw pg', topics: 18, pages: 24},
      {n: 10, slug: 'phase-10-indexes', name: 'Indexes and the query planner', part: 'Performance & production', topics: 18, pages: 18},
      {n: 11, slug: 'phase-11-mvcc', name: 'Transactions, MVCC and concurrency', part: 'Performance & production', topics: 16, pages: 16},
      {n: 12, slug: 'phase-12-beyond-tables', name: 'Beyond plain tables', part: 'Performance & production', topics: 19, pages: 21},
      {n: 13, slug: 'phase-13-ops', name: 'Security, operations and production', part: 'Performance & production', topics: 18, pages: 40},
    ],
  },
  redis: {
    label: 'Redis',
    docsPath: '/docs/redis',
    pagesPath: '/docs/redis/pages',
    phases: [
      {n: 0, slug: 'phase-0-how-redis-runs', name: 'How Redis runs', part: 'How Redis works', topics: 6, pages: 0},
      {n: 1, slug: 'phase-1-keys-and-expiry', name: 'Keys, expiry and the keyspace', part: 'How Redis works', topics: 6, pages: 0},
      {n: 2, slug: 'phase-2-redis-cli', name: 'redis-cli, mastered', part: 'How Redis works', topics: 5, pages: 0},
      {n: 3, slug: 'phase-3-strings', name: 'Strings, numbers and bitmaps', part: 'Data types', topics: 6, pages: 0},
      {n: 4, slug: 'phase-4-collections', name: 'Hashes, lists, sets and sorted sets', part: 'Data types', topics: 8, pages: 0},
      {n: 5, slug: 'phase-5-streams', name: 'Streams', part: 'Data types', topics: 6, pages: 0},
      {n: 6, slug: 'phase-6-node-client', name: 'The Node client, end to end', part: 'From Node', topics: 7, pages: 0},
      {n: 7, slug: 'phase-7-caching', name: 'Caching, properly', part: 'From Node', topics: 8, pages: 0},
      {n: 8, slug: 'phase-8-patterns', name: 'Sessions, rate limits, locks and queues', part: 'From Node', topics: 8, pages: 0},
      {n: 9, slug: 'phase-9-memory-persistence', name: 'Memory, eviction and persistence', part: 'Production', topics: 7, pages: 0},
      {n: 10, slug: 'phase-10-operations', name: 'Operations', part: 'Production', topics: 7, pages: 0},
    ],
  },
  git: {
    label: 'Git',
    docsPath: '/docs/git',
    pagesPath: '/docs/git/pages',
    phases: [
      {n: 0, slug: 'phase-0-how-git-stores-things', name: 'How Git stores things', part: 'How Git works', topics: 14, pages: 14},
      {n: 1, slug: 'phase-1-everyday-loop', name: 'The everyday loop', part: 'How Git works', topics: 16, pages: 0},
      {n: 2, slug: 'phase-2-branching-merging', name: 'Branching, merging and rebasing', part: 'How Git works', topics: 17, pages: 0},
      {n: 3, slug: 'phase-3-reading-history', name: 'Reading history', part: 'How Git works', topics: 14, pages: 0},
      {n: 4, slug: 'phase-4-remotes', name: 'Remotes and syncing', part: 'Working with other people', topics: 16, pages: 0},
      {n: 5, slug: 'phase-5-undo-recover', name: 'Undo, recover and rewrite', part: 'Working with other people', topics: 16, pages: 0},
      {n: 6, slug: 'phase-6-team-workflow', name: 'Team workflow and code review', part: 'Working with other people', topics: 15, pages: 0},
      {n: 7, slug: 'phase-7-fullstack-repo', name: 'The repository in a fullstack project', part: 'In a real project', topics: 15, pages: 0},
      {n: 8, slug: 'phase-8-hooks-ci', name: 'Hooks, CI and automation', part: 'In a real project', topics: 14, pages: 0},
      {n: 9, slug: 'phase-9-speed-scale', name: 'Speed, scale and daily ergonomics', part: 'In a real project', topics: 13, pages: 0},
      {n: 10, slug: 'phase-10-plumbing', name: 'Plumbing and internals', part: 'Depth and repair', topics: 14, pages: 0},
      {n: 11, slug: 'phase-11-history-surgery', name: 'History surgery and migration', part: 'Depth and repair', topics: 13, pages: 0},
      {n: 12, slug: 'phase-12-when-git-goes-wrong', name: 'When Git goes wrong', part: 'Depth and repair', topics: 14, pages: 0},
    ],
  },
};

/** 'written' | 'writing' | 'planned' for one phase. */
export function phaseStatus(p) {
  if (p.pages === 0) return 'planned';
  return p.pagesPlanned ? 'writing' : 'written';
}

/**
 * Totals for one language. A phase still being written counts pro rata —
 * `pages / pagesPlanned` of its topics — so the bar moves with every page
 * rather than jumping a whole phase at a time.
 */
export function summarise(langKey) {
  const lang = LANGUAGES[langKey];
  const phases = lang.phases;
  const finished = phases.filter((p) => phaseStatus(p) === 'written');
  const topicsTotal = phases.reduce((sum, p) => sum + p.topics, 0);
  const topicsDone = phases.reduce((sum, p) => {
    const status = phaseStatus(p);
    if (status === 'written') return sum + p.topics;
    if (status === 'writing') return sum + (p.topics * p.pages) / p.pagesPlanned;
    return sum;
  }, 0);
  const pagesWritten = phases.reduce((sum, p) => sum + p.pages, 0);
  const inFlight = phases.find((p) => phaseStatus(p) === 'writing') ?? null;
  return {
    ...lang,
    phases,
    phasesTotal: phases.length,
    phasesDone: finished.length,
    topicsTotal,
    topicsDone: Math.round(topicsDone),
    pagesWritten,
    percent: Math.round((topicsDone / topicsTotal) * 100),
    inFlight,
    nextPhase: inFlight ?? phases.find((p) => p.pages === 0) ?? null,
  };
}
