export interface Row17 { id: string; qty: number; tags: string[] }
export function total17(rows: Row17[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample17: Row17 = { id: 'r17', qty: 17, tags: ['a', 'b'] };
