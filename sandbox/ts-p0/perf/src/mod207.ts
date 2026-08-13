export interface Row207 { id: string; qty: number; tags: string[] }
export function total207(rows: Row207[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample207: Row207 = { id: 'r207', qty: 207, tags: ['a', 'b'] };
