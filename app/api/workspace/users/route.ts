import {requirePermission,bootstrapIds,type WorkspaceUser} from '@/lib/workspace-access';
import {permissionLabels,type Permission} from '@/lib/permissions';
import {db,fail} from '@/lib/store';
import {privateHeaders} from '@/lib/admin-access';
import {z} from 'zod';
import {phoneSchema,mobileSchema} from '@/lib/user-contact';
import {mfaConfigured,mfaRequired} from '@/lib/two-factor';
const permissions=z.object({createEdit:z.boolean(),sendQuotes:z.boolean(),createOnBehalf:z.boolean().default(false),viewCosts:z.boolean(),viewTeam:z.boolean(),applyDiscounts:z.boolean(),approveRestricted:z.boolean(),superAdmin:z.boolean()});
const userSchema=z.object({email:z.string().trim().toLowerCase().email().max(254),name:z.string().trim().min(1).max(150),phone:phoneSchema,mobile:mobileSchema,permissions,active:z.boolean(),version:z.number().int().min(0)});
export async function GET(r:Request){try{const who=await requirePermission(r,'superAdmin');const rows=await db().prepare('SELECT * FROM workspace_users ORDER BY name,email').all<WorkspaceUser>();return Response.json({users:rows.results.map(row=>({email:row.email,name:row.name,phone:row.phone,mobile:row.mobile,permissions:JSON.parse(row.permissions),active:row.active===1,version:row.version,joined:!!row.user_id,protected:!!row.user_id&&bootstrapIds().has(row.user_id),self:row.user_id===who.id})),labels:permissionLabels,twoFactor:{configured:mfaConfigured(),enabled:mfaRequired()}},{headers:privateHeaders});}catch(e){return fail(e);}}
export async function POST(r:Request){try{const who=await requirePermission(r,'superAdmin');if(r.headers.get('origin')!==new URL(r.url).origin||!r.headers.get('content-type')?.startsWith('application/json'))throw Error('Invalid request origin.');const raw=await r.text();if(raw.length>8000)throw Error('Request too large.');const value=userSchema.parse(JSON.parse(raw));
 const old=await db().prepare('SELECT * FROM workspace_users WHERE email=?').bind(value.email).first<WorkspaceUser>();
 if(old?.user_id&&bootstrapIds().has(old.user_id)&&(!value.active||!value.permissions.superAdmin))throw Error('The original Super Administrator must remain enabled with Super Administrator access.');
 if(old?.user_id===who.id&&(!value.active||!value.permissions.superAdmin))throw Error('You cannot remove your own Super Administrator access.');
 const now=new Date().toISOString();
 if(old){if(value.version!==old.version)throw Error('This user changed. Refresh Users and try again.');const res=await db().prepare('UPDATE workspace_users SET name=?,phone=?,mobile=?,permissions=?,active=?,version=version+1,updated=?,updated_by=? WHERE email=? AND version=?').bind(value.name,value.phone,value.mobile,JSON.stringify(value.permissions),value.active?1:0,now,who.id,value.email,value.version).run();if(!res.meta.changes)throw Error('This user changed. Refresh and try again.');}
 else{if(value.version!==0)throw Error('User not found. Refresh and try again.');await db().prepare('INSERT INTO workspace_users (email,name,phone,mobile,permissions,active,version,updated,updated_by) VALUES (?,?,?,?,?,?,1,?,?)').bind(value.email,value.name,value.phone,value.mobile,JSON.stringify(value.permissions),value.active?1:0,now,who.id).run();}
 return Response.json({message:old?'User updated.':'User added. They can sign in with this email.'},{headers:privateHeaders});
 }catch(e){return fail(e);}}
