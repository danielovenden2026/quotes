import {env} from 'cloudflare:workers';
import {adminAccess, privateHeaders} from '@/lib/admin-access';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const status = adminAccess(request, env);
  return Response.json({canViewCosts:status === 200}, {status, headers:privateHeaders});
}
