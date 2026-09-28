import {SecondFactorRequired} from '@/lib/two-factor';
import {actor} from '@/lib/workspace-access';
import {privateHeaders} from '@/lib/admin-access';
import {getApprovalSettings} from '@/lib/approval-settings';
import {getGpSettings} from '@/lib/gp-settings';
export const dynamic='force-dynamic';
export async function GET(r:Request){try{const user=await actor(r);return Response.json({canViewCosts:user.permissions.viewCosts,canAddCustom:user.permissions.createEdit,permissions:user.permissions,name:user.name,...await getApprovalSettings(),...await getGpSettings()},{headers:privateHeaders});}catch(e){return Response.json({requiresTwoFactor:e instanceof SecondFactorRequired,error:e instanceof Error?e.message:'Access unavailable',canViewCosts:false,canAddCustom:false},{status:403,headers:privateHeaders});}}
