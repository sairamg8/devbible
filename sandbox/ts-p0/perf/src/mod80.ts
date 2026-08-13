export interface Row80 { id: string; qty: number; tags: string[] }
export function total80(rows: Row80[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample80: Row80 = { id: 'r80', qty: 80, tags: ['a', 'b'] };
