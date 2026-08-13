export interface Row166 { id: string; qty: number; tags: string[] }
export function total166(rows: Row166[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample166: Row166 = { id: 'r166', qty: 166, tags: ['a', 'b'] };
