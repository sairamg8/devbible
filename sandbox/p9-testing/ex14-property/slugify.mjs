// v2: a 12-char cap was added later for the URL column. Examples still pass.
export function slugify(title) {
  return title.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 12);
}
