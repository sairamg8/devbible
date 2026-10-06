// Shared by crawl.mjs (batch) and jobs.mjs (single company / preset).
export const REGIONS = {
  india: /india|bengaluru|bangalore|hyderabad|pune|mumbai|gurgaon|gurugram|noida|delhi|chennai|kolkata|ahmedabad|kochi|coimbatore|remote.*india/i,
  us: /\b(usa?|united states)\b|, (ca|ny|wa|tx|ma|il)\b|san francisco|new york|seattle|austin|boston|remote.*(us|united states)/i,
  canada: /canada|toronto|vancouver|montreal|ottawa|calgary/i,
  europe: /europe|london|uk\b|united kingdom|berlin|germany|amsterdam|netherlands|dublin|ireland|paris|france|spain|poland|sweden|zurich|switzerland/i,
  any: /./,
};
const TRACKS = [
  ['java', /\b(java|spring ?boot|spring)\b(?!script)/i],
  ['node', /\b(node(\.?js)?|mern|pern|express)\b/i],
  ['ui', /\b(front[- ]?end|ui (engineer|developer)|ui\/ux engineer|react|angular|web (ui )?developer|javascript|typescript)\b/i],
  ['fullstack', /\bfull[- ]?stack\b/i],
];
const DESC_TRACKS = [
  ['java', /\b(java|spring ?boot|hibernate)\b/gi],
  ['node', /\b(node\.?js|express\.?js|nestjs|mern|pern)\b/gi],
  ['ui', /\b(react(\.?js)?|angular|vue|next\.?js|css3?|front[- ]?end)\b/gi],
];
const ENG = /\b(engineer|developer|sde|programmer|architect|software|swe)\b/i;
const NOISE = /\b(intern|recruit|sales|marketing|designer|analyst|support|qa\b|sdet|data scientist|devops|sre|ios|android|manager of|director|vp\b)/i;
const level = (t) => /\b(intern|internship|stagiaire|apprenti|apprentice|werkstudent|trainee|vie\b|graduate programme)\b/i.test(t) ? 'intern' : /\b(staff|principal|architect)\b/i.test(t) ? 'staff+' : /\b(sr|senior|lead)\b/i.test(t) ? 'senior' : /\b(sde[- ]?1|junior|associate|graduate|fresher|entry)\b/i.test(t) ? 'junior' : /\b(sde[- ]?(2|ii)|engineer ii|developer ii)\b/i.test(t) ? 'mid' : 'unspecified';

const FUNCTIONS = [
  ['compliance', /\b(aml|kyc|kyb|cft|ctf|anti[- ]?money|financial crime|fin(ancial)? crime|sanctions?|compliance|mlro|know your|conformit|due diligence)\b/i],
  ['legal', /\b(legal|counsel|attorney|lawyer|paralegal|juriste|regulatory affairs|company secretary)\b/i],
  ['data', /\b(data (scientist|analyst|engineer|science|architect|steward|governance)|analytics|machine learning|\bml\b|\bai\b|\bbi\b|quant|statistic|business intelligence)\b/i],
  ['engineering', /\b(engineer|developer|sde|software|devops|sre|architect|programmer|qa\b|sdet|ios|android|full[- ]?stack|front[- ]?end|back[- ]?end|cyber|infosec|security analyst|sysadmin|network admin|dba|technical lead|tech lead)\b/i],
  ['design', /\b(designer|ux|ui\/ux|creative director|illustrator|art director|brand design)\b/i],
  ['product', /\b(product (manager|owner|lead|analyst)|program(me)? manager|project manager|project coordinator|scrum|business analyst|delivery manager|pmo|transformation)\b/i],
  ['risk', /\b(risk|credit (analyst|officer|manager)|audit|auditor|internal control|controls?|fraud|assurance|underwrit|actuar|claims)\b/i],
  ['finance', /\b(financ|account(ant|ing| payable| receivable)|treasury|controller|tax|payroll|fp&a|billing|bookkeep|investor relations|equity research|analyst.*(bank|invest)|investment|trader|trading|portfolio|asset manage|wealth)\b/i],
  ['hr', /\b(recruit|talent|human resources|\bhr\b|people (partner|operations|business)|learning and development|l&d|compensation|benefits|onboarding|employer brand)\b/i],
  ['sales', /\b(sales|account (executive|manager)|business development|relationship manager|customer success|partnership|bd\b|client (partner|advisor|manager)|pre-?sales|solutions consultant|banker)\b/i],
  ['marketing', /\b(marketing|brand|content|seo|communications?|\bpr\b|social media|community manager|growth|copywriter|campaign)\b/i],
  ['support', /\b(support|service desk|customer (service|care|experience)|helpdesk|help desk|contact cent|call cent|agent)\b/i],
  ['ops', /\b(operations?|logistics|supply chain|procurement|facilities|administrat|assistant|coordinator|warehouse|driver|technician|office manager|executive assistant|back office|middle office|settlement|processing)\b/i],
];
export const FUNCTION_LABELS = { compliance: 'Compliance / AML / KYC', legal: 'Legal', data: 'Data & analytics', engineering: 'Engineering', design: 'Design', product: 'Product & projects', risk: 'Risk, audit & insurance', finance: 'Finance & banking', hr: 'HR & recruiting', sales: 'Sales & business development', marketing: 'Marketing & comms', support: 'Customer support', ops: 'Operations & admin', other: 'Other' };
const functionOf = (t) => FUNCTIONS.find(([, rx]) => rx.test(t))?.[0] ?? 'other';

/** raw ATS job -> classified job (every role is kept; the region filter only applies when asked). */
export function classify(j, region = 'any') {
  const loc = j.location ?? '';
  if (!(REGIONS[region].test(loc) || /^\d+ locations?$/i.test(loc) || !loc)) return null;
  const slug = decodeURIComponent(j.url ?? '').replace(/[-_]+/g, ' ');
  const fn = functionOf(j.title) !== 'other' ? functionOf(j.title) : functionOf(slug);
  const byTitle = TRACKS.find(([, rx]) => rx.test(j.title)) ?? TRACKS.find(([, rx]) => rx.test(slug));
  const byDesc = !byTitle && fn === 'engineering' && DESC_TRACKS.map(([t, rx]) => [t, (j.desc ?? '').match(rx)?.length ?? 0]).sort((a, b) => b[1] - a[1])[0];
  const track = byTitle ? byTitle[0] : byDesc && byDesc[1] >= 2 ? byDesc[0] : 'other-eng';
  const { desc, ...rest } = j;
  return { fn, track, how: byTitle ? 'title' : track === 'other-eng' ? '-' : 'jd', level: level(j.title), ...rest };
}

const COUNTRIES = [
  ['IN', /india|bengaluru|bangalore|hyderabad|pune|mumbai|gurgaon|gurugram|noida|delhi|chennai|kolkata|ahmedabad|kochi|coimbatore|lucknow|jaipur|indore|chandigarh|thiruvananthapuram|remote.*india/i],
  ['CA', /canada|toronto|vancouver|montreal|ottawa|calgary|waterloo|, ?(ON|BC|AB|QC)\b/i],
  ['DE', /germany|deutschland|berlin|munich|münchen|hamburg|frankfurt|cologne|köln|stuttgart|düsseldorf|leipzig/i],
  ['EU', /europe|emea|london|\buk\b|united kingdom|england|amsterdam|netherlands|dublin|ireland|paris|france|spain|barcelona|madrid|poland|warsaw|krakow|sweden|stockholm|zurich|switzerland|denmark|copenhagen|portugal|lisbon|austria|vienna|finland|helsinki|norway|oslo|belgium|brussels|estonia|tallinn|czech|prague|romania|bucharest|lithuania|vilnius|italy|milan/i],
  ['US', /\b(usa?|united states)\b|, ?(AL|AK|AZ|AR|CA|CO|CT|DC|FL|GA|IL|MA|MD|MI|MN|MO|NC|NJ|NV|NY|OH|OR|PA|TX|UT|VA|WA)\b|san francisco|new york|seattle|austin|boston|chicago|los angeles|denver|atlanta|remote.*(us|united states)|bay area|mountain view|palo alto|sunnyvale|san jose/i],
];
export const countryOf = (loc = '') => COUNTRIES.find(([, rx]) => rx.test(loc))?.[0] ?? (/remote/i.test(loc) ? 'REMOTE' : 'OTHER');

/** Position (what the job is) from the title plus the URL slug, which on Workday often carries the real title. */
export function position(j) {
  const t = `${j.title} ${decodeURIComponent(j.url ?? '').replace(/[-_]+/g, ' ')}`;
  if (/full[- ]?stack/i.test(t)) return 'fullstack';
  if (/front[- ]?end|\bui\b|\bux\b|web (developer|engineer)|\breact|angular|\bvue\b|design systems?/i.test(t)) return 'frontend';
  if (/back[- ]?end|server[- ]?side|\bapi\b|\bjava\b|spring|node|golang|\bgo\b|distributed|platform|infrastructure|payments?|services?/i.test(t)) return 'backend';
  return 'software';
}
