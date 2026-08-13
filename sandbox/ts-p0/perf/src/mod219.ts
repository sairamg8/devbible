export interface Row219 { id: string; qty: number; tags: string[] }
export function total219(rows: Row219[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample219: Row219 = { id: 'r219', qty: 219, tags: ['a', 'b'] };
