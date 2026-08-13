export interface Row163 { id: string; qty: number; tags: string[] }
export function total163(rows: Row163[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample163: Row163 = { id: 'r163', qty: 163, tags: ['a', 'b'] };
