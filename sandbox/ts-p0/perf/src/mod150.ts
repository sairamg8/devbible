export interface Row150 { id: string; qty: number; tags: string[] }
export function total150(rows: Row150[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample150: Row150 = { id: 'r150', qty: 150, tags: ['a', 'b'] };
