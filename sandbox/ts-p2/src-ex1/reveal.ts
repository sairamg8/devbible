declare const v: string | number | null | undefined | string[];

if (typeof v === 'string')  { const r: 1 = v; }
if (typeof v === 'number')  { const r: 1 = v; }
if (typeof v === 'object')  { const r: 1 = v; }   // object INCLUDES null
if (v)                      { const r: 1 = v; }   // truthiness drops '' and 0 too
if (v != null)              { const r: 1 = v; }
if (Array.isArray(v))       { const r: 1 = v; }
