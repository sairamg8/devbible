export interface Row75 { id: string; qty: number; tags: string[] }
export function total75(rows: Row75[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample75: Row75 = { id: 'r75', qty: 75, tags: ['a', 'b'] };
