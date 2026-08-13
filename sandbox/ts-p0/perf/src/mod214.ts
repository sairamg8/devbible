export interface Row214 { id: string; qty: number; tags: string[] }
export function total214(rows: Row214[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample214: Row214 = { id: 'r214', qty: 214, tags: ['a', 'b'] };
