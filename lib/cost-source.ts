import 'server-only';

export type ProductCost = { averageCost: number | null; latestCost: number | null; duplicate?: boolean };
export type CostRecords = Map<string, ProductCost>;
export type CostSource = { load(): Promise<CostRecords> };
export type CostSourceConfig = { COST_SHEET_ID?: string; COST_SHEET_TAB?: string; COST_SOURCE_MODE?: string };
export const normaliseSku = (sku: string) => sku.trim().toUpperCase();

// RFC 4180-style quoted fields, including embedded commas, quotes and line breaks.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], field = '', quoted = false, closed = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"') { if (input[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } }
      else field += c;
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(field); field = ''; closed = false;
      if (c !== ',') { rows.push(row); row = []; if (c === '\r' && input[i + 1] === '\n') i++; }
    } else if (c === '"' && field === '' && !closed) quoted = true;
    else { if (closed || c === '"') throw new Error('Invalid cost CSV'); field += c; }
  }
  if (quoted) throw new Error('Incomplete cost CSV');
  if (field || row.length || closed) { row.push(field); rows.push(row); }
  return rows;
}

function costNumber(value: string | undefined): number | null {
  const text = (value || '').trim().replace(/^AUD\s*/i, '').replace(/^\$\s*/, '').replace(/\s*AUD$/i, '');
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text)) return null;
  const number = Number(text.replaceAll(',', ''));
  return Number.isFinite(number) && Math.abs(number) <= 1e9 ? number : null;
}

export function costRecords(rows: string[][]): CostRecords {
  const populated = rows.filter(row => row.some(cell => cell.trim()));
  const header = populated.shift()?.map(s => s.trim().toLowerCase());
  if (!header || header[0] !== 'sku' || header[1] !== 'average cost' || header[2] !== 'latest cost') throw new Error('Cost column headings do not match');
  const records: CostRecords = new Map();
  for (const row of populated) {
    const sku = normaliseSku(row[0] || '');
    if (!sku || sku.length > 100) continue;
    // Ambiguous duplicate SKUs must never select an arbitrary cost.
    records.set(sku, records.has(sku) ? {averageCost:null, latestCost:null, duplicate:true} : {averageCost:costNumber(row[1]), latestCost:costNumber(row[2])});
  }
  return records;
}

export async function limitedText(response: Response): Promise<string> {
  const max = 5_000_000;
  if (Number(response.headers.get('content-length')) > max || !response.body) throw new Error('Invalid cost response');
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let text = '', size = 0;
  try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > max) throw new Error('Cost response too large'); text += decoder.decode(part.value, {stream:true}); } return text + decoder.decode(); }
  finally { await reader.cancel(); reader.releaseLock(); }
}

export class GooglePublicSheetSource implements CostSource {
  constructor(private sheetId: string, private tab: string) {}
  async load(): Promise<CostRecords> {
    const url = new URL('https://docs.google.com/spreadsheets/d/' + this.sheetId + '/gviz/tq');
    url.search = new URLSearchParams({tqx:'out:csv', sheet:this.tab, range:'A:C', headers:'1'}).toString();
    const response = await fetch(url, {headers:{Accept:'text/csv'}, redirect:'manual', signal:AbortSignal.timeout(15000), cache:'no-store'});
    if (!response.ok || !response.headers.get('content-type')?.includes('text/csv')) throw new Error('Cost source unavailable');
    return costRecords(parseCsv(await limitedText(response)));
  }
}

// Replace only this provider with a Google Sheets API/OAuth implementation later.
// Authentication and rendering remain independent; never fall back to public access.
export function createCostSource(config: CostSourceConfig): CostSource {
  if ((config.COST_SOURCE_MODE || 'public-sheet') !== 'public-sheet') throw new Error('Cost provider is not configured');
  if (!config.COST_SHEET_ID || !/^[A-Za-z0-9_-]+$/.test(config.COST_SHEET_ID)) throw new Error('Cost source is not configured');
  return new GooglePublicSheetSource(config.COST_SHEET_ID, config.COST_SHEET_TAB || 'Costs');
}

export function createCostCache(source: CostSource, now = Date.now) {
  let records: CostRecords | undefined, expires = 0;
  return async (): Promise<CostRecords> => {
    if (records && now() < expires) return records;
    // Cache completed data only. A pending fetch belongs to its Worker request;
    // sharing it can strand later requests when its owner disconnects on refresh.
    try {
      const result = await source.load();
      records = result; expires = now() + 15 * 60_000;
      return result;
    } catch {
      // Another request may have successfully refreshed while this one failed.
      if (records && now() < expires) return records;
      // No stale costs and no failed promise/backoff preventing a manual retry.
      throw new Error('Cost source unavailable');
    }
  };
}
