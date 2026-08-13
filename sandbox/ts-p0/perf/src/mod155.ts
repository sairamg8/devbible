export interface Row155 { id: string; qty: number; tags: string[] }
export function total155(rows: Row155[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample155: Row155 = { id: 'r155', qty: 155, tags: ['a', 'b'] };
