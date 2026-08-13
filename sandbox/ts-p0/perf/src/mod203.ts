export interface Row203 { id: string; qty: number; tags: string[] }
export function total203(rows: Row203[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample203: Row203 = { id: 'r203', qty: 203, tags: ['a', 'b'] };
