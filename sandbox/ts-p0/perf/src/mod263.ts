export interface Row263 { id: string; qty: number; tags: string[] }
export function total263(rows: Row263[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample263: Row263 = { id: 'r263', qty: 263, tags: ['a', 'b'] };
