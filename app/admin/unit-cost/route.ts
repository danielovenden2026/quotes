import {productOwner} from '@/lib/workspace-access';
import {costCell as cell} from '@/lib/metric-html';
import {getAdhoc} from '@/lib/adhoc-products';
import {costAccess} from '@/lib/admin-access';
import {getCosts} from '@/lib/cost-data';
import {getCatalogue} from '@/lib/catalogue-data';
import {normaliseSku} from '@/lib/cost-source';
export const dynamic = 'force-dynamic';


export async function GET(request: Request) {
  const access = await costAccess(request);
  if (access !== 200) return cell('Sign in', access);
  const sku = normaliseSku(new URL(request.url).searchParams.get('sku') || '');
  if (!sku || sku.length > 100) return cell('N/A', 400);
  try {
    const adhocId=new URL(request.url).searchParams.get('adhocId');
    if(adhocId){const owner=await productOwner(request,adhocId);const row=owner?await getAdhoc(adhocId,owner):null;if(!row||normaliseSku(row.sku)!==sku)return cell('N/A');if(!row.source_sku||row.cost_from_feed!==1)return cell(new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(row.cost/100),200,'Entered product cost · AUD');}
    // Do not expose EXO-only products which are outside the Magento catalogue.
    const catalogue = await getCatalogue();
    if (!catalogue.products.some(p => normaliseSku(p.sku) === sku)) return cell('N/A', 200, 'SKU not in the Magento catalogue');
    const row = (await getCosts()).get(sku);
    if (!row || row.averageCost === null) return cell('N/A', 200, row?.duplicate ? 'Duplicate cost SKU: check the source sheet' : 'Average Cost is missing or invalid');
    return cell(new Intl.NumberFormat('en-AU', {style:'currency', currency:'AUD'}).format(row.averageCost), 200, 'Average Cost · AUD');
  } catch { return cell('Unavailable', 503, 'Cost source unavailable. Try again shortly.'); }
}
