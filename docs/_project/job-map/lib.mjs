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

// ISO-2 country detection from a free-text job location. Order matters (specific before generic).
const C2 = (code, rx) => [code, new RegExp(rx, 'i')];
const COUNTRIES = [
  C2('IN', 'india|bengaluru|bangalore|hyderabad|pune|mumbai|gurgaon|gurugram|noida|delhi|chennai|kolkata|ahmedabad|kochi|coimbatore|lucknow|jaipur|indore|chandigarh|thiruvananthapuram'),
  C2('CA', 'canada|toronto|vancouver|montreal|montréal|ottawa|calgary|waterloo|edmonton|, ?(ON|BC|AB|QC)\\b'),
  C2('DE', 'germany|deutschland|berlin|munich|münchen|hamburg|frankfurt|cologne|köln|stuttgart|düsseldorf|leipzig|nuremberg'),
  C2('GB', 'united kingdom|\\buk\\b|england|scotland|wales|london|manchester|edinburgh|glasgow|birmingham|bristol|leeds|cambridge, uk|belfast|cardiff'),
  C2('FR', 'france|paris|lyon|marseille|toulouse|lille|nantes|bordeaux|sophia antipolis|île-de-france|ile-de-france'),
  C2('NL', 'netherlands|nederland|amsterdam|rotterdam|utrecht|eindhoven|the hague|den haag'),
  C2('IE', 'ireland|dublin|cork|galway|limerick'),
  C2('ES', 'spain|españa|madrid|barcelona|valencia|seville|malaga|bilbao'),
  C2('IT', 'italy|italia|milan|milano|rome|roma|turin|torino|bologna'),
  C2('PT', 'portugal|lisbon|lisboa|porto'),
  C2('PL', 'poland|polska|warsaw|krakow|kraków|wroclaw|wrocław|gdansk|poznan'),
  C2('SE', 'sweden|stockholm|gothenburg|göteborg|malmö|malmo'),
  C2('DK', 'denmark|copenhagen|københavn|aarhus'),
  C2('NO', 'norway|oslo|bergen'),
  C2('FI', 'finland|helsinki|espoo|tampere'),
  C2('CH', 'switzerland|schweiz|suisse|zurich|zürich|geneva|genève|basel|lausanne|zug'),
  C2('AT', 'austria|österreich|vienna|wien|graz'),
  C2('BE', 'belgium|belgique|brussels|bruxelles|antwerp|ghent'),
  C2('LU', 'luxembourg'),
  C2('EE', 'estonia|tallinn'), C2('LT', 'lithuania|vilnius'), C2('LV', 'latvia|riga'),
  C2('CZ', 'czech|prague|praha|brno'), C2('RO', 'romania|bucharest|cluj'), C2('HU', 'hungary|budapest'), C2('GR', 'greece|athens'), C2('BG', 'bulgaria|sofia'), C2('UA', 'ukraine|kyiv|kiev'), C2('RS', 'serbia|belgrade'), C2('HR', 'croatia|zagreb'),
  C2('TR', 'turkey|türkiye|istanbul|ankara'),
  C2('AE', 'united arab emirates|\\buae\\b|dubai|abu dhabi'), C2('SA', 'saudi|riyadh|jeddah'), C2('QA', 'qatar|doha'), C2('IL', 'israel|tel aviv|jerusalem|haifa'), C2('EG', 'egypt|cairo'),
  C2('SG', 'singapore'), C2('MY', 'malaysia|kuala lumpur'), C2('ID', 'indonesia|jakarta'), C2('PH', 'philippines|manila|cebu'), C2('TH', 'thailand|bangkok'), C2('VN', 'vietnam|hanoi|ho chi minh'),
  C2('JP', 'japan|tokyo|osaka'), C2('KR', 'korea|seoul'), C2('CN', 'china|beijing|shanghai|shenzhen|hong kong|guangzhou'), C2('TW', 'taiwan|taipei'),
  C2('AU', 'australia|sydney|melbourne|brisbane|perth|canberra'), C2('NZ', 'new zealand|auckland|wellington'),
  C2('BR', 'brazil|brasil|são paulo|sao paulo|rio de janeiro'), C2('MX', 'mexico|méxico|mexico city|guadalajara|monterrey'), C2('AR', 'argentina|buenos aires'), C2('CO', 'colombia|bogot'), C2('CL', 'chile|santiago'),
  C2('ZA', 'south africa|johannesburg|cape town'), C2('NG', 'nigeria|lagos'), C2('KE', 'kenya|nairobi'),
  C2('PK', 'pakistan|karachi|lahore|islamabad'), C2('BD', 'bangladesh|dhaka'), C2('LK', 'sri lanka|colombo'),
  C2('US', '\\b(usa?|united states)\\b|, ?(AL|AK|AZ|AR|CA|CO|CT|DC|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY)\\b|san francisco|new york|nyc|seattle|austin|boston|chicago|los angeles|denver|atlanta|bay area|mountain view|palo alto|sunnyvale|san jose|dallas|houston|miami|washington|philadelphia|phoenix|portland|san diego|remote.*(us|united states)'),
];
export const EUROPE = new Set(['GB', 'FR', 'NL', 'IE', 'ES', 'IT', 'PT', 'PL', 'SE', 'DK', 'NO', 'FI', 'CH', 'AT', 'BE', 'LU', 'EE', 'LT', 'LV', 'CZ', 'RO', 'HU', 'GR', 'BG', 'UA', 'RS', 'HR', 'DE']);
export const countryOf = (loc = '') => {
  if (/\b(europe|emea)\b/i.test(loc) && !COUNTRIES.some(([, rx]) => rx.test(loc))) return 'EUROPE';
  return COUNTRIES.find(([, rx]) => rx.test(loc))?.[0] ?? (/remote|anywhere|worldwide/i.test(loc) ? 'REMOTE' : 'OTHER');
};

/** Position (what an engineering job is) from the title plus the URL slug, which on Workday often carries the real title. */
export function position(j) {
  const t = `${j.title} ${decodeURIComponent(j.url ?? '').replace(/[-_]+/g, ' ')}`;
  if (/full[- ]?stack/i.test(t)) return 'fullstack';
  if (/front[- ]?end|\bui\b|\bux\b|web (developer|engineer)|\breact|angular|\bvue\b|design systems?/i.test(t)) return 'frontend';
  if (/back[- ]?end|server[- ]?side|\bapi\b|\bjava\b|spring|node|golang|\bgo\b|distributed|platform|infrastructure|payments?|services?/i.test(t)) return 'backend';
  return 'software';
}
