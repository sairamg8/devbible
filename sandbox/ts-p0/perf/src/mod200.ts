export interface Row200 { id: string; qty: number; tags: string[] }
export function total200(rows: Row200[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample200: Row200 = { id: 'r200', qty: 200, tags: ['a', 'b'] };
