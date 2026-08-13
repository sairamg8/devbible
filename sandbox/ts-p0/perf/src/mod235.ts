export interface Row235 { id: string; qty: number; tags: string[] }
export function total235(rows: Row235[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample235: Row235 = { id: 'r235', qty: 235, tags: ['a', 'b'] };
