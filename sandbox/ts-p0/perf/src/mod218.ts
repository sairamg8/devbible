export interface Row218 { id: string; qty: number; tags: string[] }
export function total218(rows: Row218[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample218: Row218 = { id: 'r218', qty: 218, tags: ['a', 'b'] };
