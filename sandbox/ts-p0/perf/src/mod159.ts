export interface Row159 { id: string; qty: number; tags: string[] }
export function total159(rows: Row159[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample159: Row159 = { id: 'r159', qty: 159, tags: ['a', 'b'] };
