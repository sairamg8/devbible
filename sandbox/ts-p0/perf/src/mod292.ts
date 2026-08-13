export interface Row292 { id: string; qty: number; tags: string[] }
export function total292(rows: Row292[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample292: Row292 = { id: 'r292', qty: 292, tags: ['a', 'b'] };
