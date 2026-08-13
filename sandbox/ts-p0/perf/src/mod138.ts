export interface Row138 { id: string; qty: number; tags: string[] }
export function total138(rows: Row138[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample138: Row138 = { id: 'r138', qty: 138, tags: ['a', 'b'] };
