export interface Row31 { id: string; qty: number; tags: string[] }
export function total31(rows: Row31[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample31: Row31 = { id: 'r31', qty: 31, tags: ['a', 'b'] };
