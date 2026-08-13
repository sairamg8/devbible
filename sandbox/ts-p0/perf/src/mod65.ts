export interface Row65 { id: string; qty: number; tags: string[] }
export function total65(rows: Row65[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample65: Row65 = { id: 'r65', qty: 65, tags: ['a', 'b'] };
