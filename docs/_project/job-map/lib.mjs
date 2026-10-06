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
const level = (t) => /\b(staff|principal|architect)\b/i.test(t) ? 'staff+' : /\b(sr|senior|lead)\b/i.test(t) ? 'senior' : /\b(sde[- ]?1|junior|associate|graduate|fresher|entry)\b/i.test(t) ? 'junior' : /\b(sde[- ]?(2|ii)|engineer ii|developer ii)\b/i.test(t) ? 'mid' : 'unspecified';

/** raw ATS job -> classified job, or null if it is not an engineering role in the region. */
export function classify(j, region = 'india') {
  const loc = j.location ?? '';
  if (!(REGIONS[region].test(loc) || /^\d+ locations?$/i.test(loc) || !loc) || NOISE.test(j.title) || !ENG.test(j.title)) return null;
  // Workday titles are generic but the URL slug often carries the real one ("...Engineer---Frontend--...").
  const slug = decodeURIComponent(j.url ?? '').replace(/[-_]+/g, ' ');
  const byTitle = TRACKS.find(([, rx]) => rx.test(j.title)) ?? TRACKS.find(([, rx]) => rx.test(slug));
  const byDesc = !byTitle && DESC_TRACKS.map(([t, rx]) => [t, (j.desc ?? '').match(rx)?.length ?? 0]).sort((a, b) => b[1] - a[1])[0];
  const track = byTitle ? byTitle[0] : byDesc && byDesc[1] >= 2 ? byDesc[0] : 'other-eng';
  const { desc, ...rest } = j;
  return { track, how: byTitle ? 'title' : track === 'other-eng' ? '-' : 'jd', level: level(j.title), ...rest };
}
