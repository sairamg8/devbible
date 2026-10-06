// Public job-board adapters. list(slug) -> [{title, location, url, team}] or null when the board does not exist.
const get = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'devbible-jobmap/1.0' } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};

const strip = (h = '') => h.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');

export const ATS = {
  greenhouse: {
    async list(slug) {
      const d = await get(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
      return d && d.jobs.map((j) => ({ title: j.title, location: j.location?.name ?? '', url: j.absolute_url, team: '', desc: strip(j.content) }));
    },
  },
  lever: {
    async list(slug) {
      const d = await get(`https://api.lever.co/v0/postings/${slug}?mode=json`);
      return d && d.map((j) => ({ title: j.text, location: j.categories?.location ?? '', url: j.hostedUrl, team: j.categories?.team ?? '', desc: j.descriptionPlain ?? '' }));
    },
  },
  ashby: {
    async list(slug) {
      const d = await get(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
      return d && d.jobs.map((j) => ({ title: j.title, location: j.location ?? '', url: j.jobUrl, team: j.team ?? '', desc: j.descriptionPlain ?? '' }));
    },
  },
  smartrecruiters: {
    async list(slug) {
      const out = [];
      for (let off = 0; off < 1000; off += 100) {
        const d = await get(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100&offset=${off}`);
        if (!d || !d.content?.length) return off === 0 && !d?.totalFound ? null : out;
        out.push(...d.content.map((j) => ({ title: j.name, location: [j.location?.city, j.location?.country].filter(Boolean).join(', '), url: `https://jobs.smartrecruiters.com/${slug}/${j.id}`, team: j.department?.label ?? '' })));
        if (out.length >= d.totalFound) break;
      }
      return out;
    },
  },
};
