export interface Row208 { id: string; qty: number; tags: string[] }
export function total208(rows: Row208[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample208: Row208 = { id: 'r208', qty: 208, tags: ['a', 'b'] };
