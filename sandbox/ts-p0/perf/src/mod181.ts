export interface Row181 { id: string; qty: number; tags: string[] }
export function total181(rows: Row181[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample181: Row181 = { id: 'r181', qty: 181, tags: ['a', 'b'] };
