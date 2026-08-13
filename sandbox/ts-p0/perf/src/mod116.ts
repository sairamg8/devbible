export interface Row116 { id: string; qty: number; tags: string[] }
export function total116(rows: Row116[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample116: Row116 = { id: 'r116', qty: 116, tags: ['a', 'b'] };
