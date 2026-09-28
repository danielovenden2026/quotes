import {staffAccess,privateHeaders} from '@/lib/admin-access';
import {getExoCatalogue} from '@/lib/exo-catalogue';
export async function GET(request:Request){
 if(await staffAccess(request)!==200)return Response.json({error:'Sign in to search EXO stock items.'},{status:401,headers:privateHeaders});
 const term=(new URL(request.url).searchParams.get('q')||'').trim().toLowerCase();
 if(term.length>100)return Response.json({error:'Keep the search under 100 characters.'},{status:400,headers:privateHeaders});
 if(!term)return Response.json({products:[],total:0},{headers:privateHeaders});
 try{const data=await getExoCatalogue();const words=term.split(/\s+/);const matches=data.products.filter(p=>words.every(w=>(p.sku+' '+p.name).toLowerCase().includes(w))).sort((a,b)=>Number(b.sku.toLowerCase()===term)-Number(a.sku.toLowerCase()===term));
 return Response.json({products:matches.slice(0,60),total:matches.length,fetchedAt:data.fetchedAt},{headers:privateHeaders});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'EXO products could not be loaded.'},{status:503,headers:privateHeaders});}
}
