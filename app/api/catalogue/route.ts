import {getCatalogue} from '@/lib/catalogue-data';
export const dynamic='force-dynamic';
export async function GET(){return Response.json(await getCatalogue(),{headers:{'Cache-Control':'no-store'}});}
