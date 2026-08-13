export interface Row215 { id: string; qty: number; tags: string[] }
export function total215(rows: Row215[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample215: Row215 = { id: 'r215', qty: 215, tags: ['a', 'b'] };
