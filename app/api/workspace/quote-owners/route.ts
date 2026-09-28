import {requirePermission,type WorkspaceUser} from '@/lib/workspace-access';
import {effectivePermissions,noPermissions} from '@/lib/permissions';
import {db,fail} from '@/lib/store';
import {privateHeaders} from '@/lib/admin-access';
export async function GET(r:Request){try{await requirePermission(r,'createOnBehalf');const rows=await db().prepare('SELECT * FROM workspace_users WHERE active=1 ORDER BY name,email').all<WorkspaceUser>();return Response.json({users:rows.results.filter(u=>effectivePermissions({...noPermissions,...JSON.parse(u.permissions)}).createEdit).map(u=>({email:u.email,name:u.name,phone:u.phone}))},{headers:privateHeaders});}catch(e){return fail(e);}}
