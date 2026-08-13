export interface Row169 { id: string; qty: number; tags: string[] }
export function total169(rows: Row169[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample169: Row169 = { id: 'r169', qty: 169, tags: ['a', 'b'] };
