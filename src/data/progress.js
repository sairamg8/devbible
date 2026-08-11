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
      {n: 9, slug: 'phase-9-testing', name: 'Testing', part: 'Application', topics: 20, pages: 0},
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
      {n: 0, slug: 'phase-0-express-basics', name: 'Express over node:http', part: 'Foundations', topics: 8, pages: 7},
      {n: 1, slug: 'phase-1-routing', name: 'Routing and path matching', part: 'Foundations', topics: 9, pages: 7},
      {n: 2, slug: 'phase-2-middleware', name: 'Middleware architecture', part: 'Foundations', topics: 9, pages: 7},
      {n: 3, slug: 'phase-3-requests', name: 'Requests and body parsing', part: 'HTTP surface', topics: 12, pages: 8},
      {n: 4, slug: 'phase-4-responses', name: 'Responses and static files', part: 'HTTP surface', topics: 12, pages: 8},
      {n: 5, slug: 'phase-5-errors', name: 'Error handling', part: 'HTTP surface', topics: 9, pages: 6},
      {n: 6, slug: 'phase-6-rest-surface', name: 'REST surface and API features', part: 'API product', topics: 14, pages: 9},
      {n: 7, slug: 'phase-7-layering', name: 'Layering at the edge', part: 'API product', topics: 8, pages: 6},
      {n: 8, slug: 'phase-8-validation-authz', name: 'Validation and authorization', part: 'Edge & ops', topics: 13, pages: 8},
      {n: 9, slug: 'phase-9-hardening', name: 'Hardening middleware', part: 'Edge & ops', topics: 9, pages: 6},
      {n: 10, slug: 'phase-10-app-factory', name: 'Testable app and ops boundary', part: 'Edge & ops', topics: 11, pages: 6},
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
