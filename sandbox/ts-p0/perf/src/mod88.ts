export interface Row88 { id: string; qty: number; tags: string[] }
export function total88(rows: Row88[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample88: Row88 = { id: 'r88', qty: 88, tags: ['a', 'b'] };
