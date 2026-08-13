export interface Row33 { id: string; qty: number; tags: string[] }
export function total33(rows: Row33[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample33: Row33 = { id: 'r33', qty: 33, tags: ['a', 'b'] };
