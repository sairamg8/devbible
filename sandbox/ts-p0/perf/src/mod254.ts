export interface Row254 { id: string; qty: number; tags: string[] }
export function total254(rows: Row254[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample254: Row254 = { id: 'r254', qty: 254, tags: ['a', 'b'] };
