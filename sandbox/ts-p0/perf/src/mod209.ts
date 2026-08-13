export interface Row209 { id: string; qty: number; tags: string[] }
export function total209(rows: Row209[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample209: Row209 = { id: 'r209', qty: 209, tags: ['a', 'b'] };
