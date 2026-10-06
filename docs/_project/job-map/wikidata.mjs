// Largest companies per country from Wikidata (name, website, employees, industry). Public SPARQL endpoint, one query per country.
const COUNTRIES = { IN: 'Q668', US: 'Q30', CA: 'Q16', DE: 'Q183', GB: 'Q145', FR: 'Q142', NL: 'Q55', CH: 'Q39', IE: 'Q27', ES: 'Q29', IT: 'Q38', SE: 'Q34', PL: 'Q36', DK: 'Q35', NO: 'Q20', FI: 'Q33', BE: 'Q31', AT: 'Q40', LU: 'Q32', PT: 'Q45', SG: 'Q334', AE: 'Q878', AU: 'Q408', JP: 'Q17', BR: 'Q155', MX: 'Q96', ZA: 'Q258', IL: 'Q801' };
const CAT = [[/bank|financ|payment|credit|broker|invest|asset manag/i, 'bank'], [/insur/i, 'insurance'], [/software|internet|information tech|computer|cloud|data process|semiconductor|electronic/i, 'saas'], [/consult|account|audit|advis|staffing|outsourc/i, 'consulting'], [/pharma|biotech|health|medical|hospital/i, 'pharma'], [/retail|e-commerce|supermarket|department store|wholesale/i, 'retail'], [/food|beverage|consumer|cosmetic|tobacco|brew|apparel|fashion|household/i, 'fmcg'], [/oil|gas|energy|electric|utilit|power|mining|renewable|chemical|steel|metal/i, 'energy'], [/automotive|motor|vehicle|car manuf/i, 'auto'], [/aerospace|defen|aircraft|aviation manuf/i, 'aero'], [/telecom|mobile network|wireless/i, 'telecom'], [/airline|travel|hotel|touris|hospitality|transport|logistic|shipping|railway/i, 'travel'], [/media|entertain|broadcast|film|publish|gaming|video game|music/i, 'media'], [/construction|real estate|engineering|manufactur|industrial|machinery/i, 'industrial']];
export const categoryOf = (ind = '') => CAT.find(([rx]) => rx.test(ind))?.[1] ?? 'other';
export const tierOf = (emp) => (emp >= 50000 ? 1 : emp >= 10000 ? 2 : emp > 0 ? 3 : 0);

export async function fetchWikidata(perCountry = 250, log = () => {}) {
  const out = [];
  for (const [cc, q] of Object.entries(COUNTRIES)) {
    const query = `SELECT ?c ?cLabel ?site ?emp ?indLabel WHERE { VALUES ?t { wd:Q4830453 wd:Q891723 wd:Q6881511 } ?c wdt:P31 ?t; wdt:P17 wd:${q}; wdt:P856 ?site. OPTIONAL { ?c wdt:P1128 ?emp. } OPTIONAL { ?c wdt:P452 ?ind. } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY DESC(?emp) LIMIT ${perCountry * 2}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch('https://query.wikidata.org/sparql', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/sparql-results+json', 'user-agent': 'devbible-jobmap/1.0 (github.com/sairamg8/devbible)' }, body: new URLSearchParams({ query }), signal: AbortSignal.timeout(90000) });
        if (!r.ok) throw new Error(String(r.status));
        const seen = new Set(); let n = 0;
        for (const b of (await r.json()).results.bindings) {
          if (seen.has(b.c.value) || n >= perCountry) continue;
          seen.add(b.c.value); n++;
          const name = b.cLabel.value; if (/^Q\d+$/.test(name)) continue;
          const emp = Number(b.emp?.value) || 0;
          out.push({ name, hq: cc.toLowerCase(), website: b.site.value, size: emp || null, category: categoryOf(b.indLabel?.value), tier: tierOf(emp), src: 'wikidata' });
        }
        log(`${cc}: ${n}`); break;
      } catch (e) { log(`${cc}: retry (${e.message})`); await new Promise((r) => setTimeout(r, 5000 * (attempt + 1))); }
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return out;
}
