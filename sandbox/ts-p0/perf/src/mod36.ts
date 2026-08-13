export interface Row36 { id: string; qty: number; tags: string[] }
export function total36(rows: Row36[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample36: Row36 = { id: 'r36', qty: 36, tags: ['a', 'b'] };
