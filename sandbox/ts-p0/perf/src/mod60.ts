export interface Row60 { id: string; qty: number; tags: string[] }
export function total60(rows: Row60[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample60: Row60 = { id: 'r60', qty: 60, tags: ['a', 'b'] };
