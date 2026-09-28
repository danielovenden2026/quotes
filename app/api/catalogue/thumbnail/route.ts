import {fetchPublicPdfImage,publicPdfImageUrl,pdfImageType} from '@/lib/pdf-images';
export async function GET(request:Request){
 const url=publicPdfImageUrl(new URL(request.url).searchParams.get('image')||'');
 if(!url)return new Response(null,{status:400});
 const bytes=await fetchPublicPdfImage(url);
 if(!bytes)return new Response(null,{status:404});
 return new Response(bytes as BodyInit,{headers:{'Content-Type':pdfImageType(bytes)==='png'?'image/png':'image/jpeg','Cache-Control':'public, max-age=900','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}
