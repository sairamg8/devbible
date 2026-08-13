export interface Row99 { id: string; qty: number; tags: string[] }
export function total99(rows: Row99[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample99: Row99 = { id: 'r99', qty: 99, tags: ['a', 'b'] };
