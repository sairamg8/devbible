export interface Row55 { id: string; qty: number; tags: string[] }
export function total55(rows: Row55[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample55: Row55 = { id: 'r55', qty: 55, tags: ['a', 'b'] };
