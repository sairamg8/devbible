export interface Row236 { id: string; qty: number; tags: string[] }
export function total236(rows: Row236[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample236: Row236 = { id: 'r236', qty: 236, tags: ['a', 'b'] };
