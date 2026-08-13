export interface Row248 { id: string; qty: number; tags: string[] }
export function total248(rows: Row248[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample248: Row248 = { id: 'r248', qty: 248, tags: ['a', 'b'] };
