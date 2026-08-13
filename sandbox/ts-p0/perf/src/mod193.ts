export interface Row193 { id: string; qty: number; tags: string[] }
export function total193(rows: Row193[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample193: Row193 = { id: 'r193', qty: 193, tags: ['a', 'b'] };
