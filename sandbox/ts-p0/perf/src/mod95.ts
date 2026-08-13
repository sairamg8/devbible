export interface Row95 { id: string; qty: number; tags: string[] }
export function total95(rows: Row95[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample95: Row95 = { id: 'r95', qty: 95, tags: ['a', 'b'] };
