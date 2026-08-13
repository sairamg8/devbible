export interface Row176 { id: string; qty: number; tags: string[] }
export function total176(rows: Row176[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample176: Row176 = { id: 'r176', qty: 176, tags: ['a', 'b'] };
