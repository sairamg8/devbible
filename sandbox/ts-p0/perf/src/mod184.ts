export interface Row184 { id: string; qty: number; tags: string[] }
export function total184(rows: Row184[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample184: Row184 = { id: 'r184', qty: 184, tags: ['a', 'b'] };
