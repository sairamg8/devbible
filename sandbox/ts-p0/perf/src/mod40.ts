export interface Row40 { id: string; qty: number; tags: string[] }
export function total40(rows: Row40[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample40: Row40 = { id: 'r40', qty: 40, tags: ['a', 'b'] };
