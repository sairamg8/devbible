export interface Row174 { id: string; qty: number; tags: string[] }
export function total174(rows: Row174[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample174: Row174 = { id: 'r174', qty: 174, tags: ['a', 'b'] };
