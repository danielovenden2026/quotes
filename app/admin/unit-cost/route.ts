import {env} from 'cloudflare:workers';
import {adminAccess, privateHeaders, escapeHtml} from '@/lib/admin-access';
import {getCosts} from '@/lib/cost-data';
import {getCatalogue} from '@/lib/catalogue-data';
import {normaliseSku} from '@/lib/cost-source';
export const dynamic = 'force-dynamic';

function cell(text: string, status = 200, title = text) {
  return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unit Cost</title><style>html,body{margin:0;background:transparent;color:#233746;font:14px Arial,sans-serif}body{display:flex;align-items:center;min-height:38px}span{white-space:nowrap}</style></head><body><span title="' + escapeHtml(title) + '">' + escapeHtml(text) + '</span></body></html>', {
    status, headers:{...privateHeaders, 'Content-Type':'text/html; charset=utf-8', 'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'; sandbox", 'X-Frame-Options':'SAMEORIGIN'},
  });
}

export async function GET(request: Request) {
  const access = adminAccess(request, env);
  if (access !== 200) return cell('Admin only', access);
  const sku = normaliseSku(new URL(request.url).searchParams.get('sku') || '');
  if (!sku || sku.length > 100) return cell('N/A', 400);
  try {
    // Do not expose EXO-only products which are outside the Magento catalogue.
    const catalogue = await getCatalogue();
    if (!catalogue.products.some(p => normaliseSku(p.sku) === sku)) return cell('N/A', 200, 'SKU not in the Magento catalogue');
    const row = (await getCosts()).get(sku);
    if (!row || row.averageCost === null) return cell('N/A', 200, row?.duplicate ? 'Duplicate cost SKU: check the source sheet' : 'Average Cost is missing or invalid');
    return cell(new Intl.NumberFormat('en-AU', {style:'currency', currency:'AUD'}).format(row.averageCost), 200, 'Average Cost · AUD');
  } catch { return cell('Unavailable', 503, 'Cost source unavailable. Try again shortly.'); }
}
