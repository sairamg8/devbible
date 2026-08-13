export interface Row194 { id: string; qty: number; tags: string[] }
export function total194(rows: Row194[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample194: Row194 = { id: 'r194', qty: 194, tags: ['a', 'b'] };
