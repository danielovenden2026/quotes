import {requirePermission,bootstrapIds,type WorkspaceUser} from '@/lib/workspace-access';
import {permissionLabels,type Permission} from '@/lib/permissions';
import {db,fail} from '@/lib/store';
import {privateHeaders} from '@/lib/admin-access';
import {z} from 'zod';
import {phoneSchema,mobileSchema} from '@/lib/user-contact';
import {mfaConfigured,mfaRequired} from '@/lib/two-factor';
import {makePassword,revokeUserSessions,validPassword} from '@/lib/password-auth';
const permissions=z.object({createEdit:z.boolean(),sendQuotes:z.boolean(),createOnBehalf:z.boolean().default(false),viewCosts:z.boolean(),viewTeam:z.boolean(),applyDiscounts:z.boolean(),approveRestricted:z.boolean(),superAdmin:z.boolean()});
const userSchema=z.object({email:z.string().trim().toLowerCase().email().max(254),name:z.string().trim().min(1).max(150),phone:phoneSchema,mobile:mobileSchema,permissions,active:z.boolean(),version:z.number().int().min(0),password:z.string().max(128).optional().default('')});
type StoredUser=WorkspaceUser&{password_hash?:string;password_salt?:string;password_iterations?:number};
export async function GET(r:Request){try{const who=await requirePermission(r,'superAdmin');const rows=await db().prepare('SELECT * FROM workspace_users ORDER BY name,email').all<StoredUser>();return Response.json({users:rows.results.map(row=>({email:row.email,name:row.name,phone:row.phone,mobile:row.mobile,permissions:JSON.parse(row.permissions),active:row.active===1,version:row.version,joined:!!row.user_id,hasPassword:!!row.password_hash,protected:bootstrapIds().has(row.email)||!!row.user_id&&bootstrapIds().has(row.user_id),self:row.user_id===who.id})),labels:permissionLabels,twoFactor:{configured:mfaConfigured(),enabled:mfaRequired()}},{headers:privateHeaders});}catch(e){return fail(e);}}
export async function POST(r:Request){try{const who=await requirePermission(r,'superAdmin');if(r.headers.get('origin')!==new URL(r.url).origin||!r.headers.get('content-type')?.startsWith('application/json'))throw Error('Invalid request origin.');const raw=await r.text();if(raw.length>9000)throw Error('Request too large.');const value=userSchema.parse(JSON.parse(raw));
 const old=await db().prepare('SELECT * FROM workspace_users WHERE email=?').bind(value.email).first<StoredUser>();
 const protectedUser=!!old&&(bootstrapIds().has(old.email)||!!old.user_id&&bootstrapIds().has(old.user_id));
 if(protectedUser&&(!value.active||!value.permissions.superAdmin))throw Error('The original Super Administrator must remain enabled with Super Administrator access.');
 if(old?.user_id===who.id&&(!value.active||!value.permissions.superAdmin))throw Error('You cannot remove your own Super Administrator access.');
 if(!old&&!validPassword(value.password))throw Error('Set an initial password of at least 10 characters.');
 if(value.password&&!validPassword(value.password))throw Error('Password must be at least 10 characters.');
 const now=new Date().toISOString(),userId=old?.user_id||value.email,password=value.password?await makePassword(value.password):null;
 if(old){
  if(value.version!==old.version)throw Error('This user changed. Refresh Users and try again.');
  const sql=password?'UPDATE workspace_users SET user_id=COALESCE(user_id,?),name=?,phone=?,mobile=?,permissions=?,active=?,password_hash=?,password_salt=?,password_iterations=?,version=version+1,updated=?,updated_by=? WHERE email=? AND version=?':'UPDATE workspace_users SET user_id=COALESCE(user_id,?),name=?,phone=?,mobile=?,permissions=?,active=?,version=version+1,updated=?,updated_by=? WHERE email=? AND version=?';
  const stmt=password?db().prepare(sql).bind(userId,value.name,value.phone,value.mobile,JSON.stringify(value.permissions),value.active?1:0,password.password_hash,password.password_salt,password.password_iterations,now,who.id,value.email,value.version):db().prepare(sql).bind(userId,value.name,value.phone,value.mobile,JSON.stringify(value.permissions),value.active?1:0,now,who.id,value.email,value.version);
  const res=await stmt.run();if(!res.meta.changes)throw Error('This user changed. Refresh and try again.');
  if(value.password||!value.active)await revokeUserSessions(userId);
 }else{
  if(value.version!==0)throw Error('User not found. Refresh and try again.');
  const passwordData=await makePassword(value.password);
  await db().prepare('INSERT INTO workspace_users (email,user_id,name,phone,mobile,permissions,active,password_hash,password_salt,password_iterations,version,updated,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?)').bind(value.email,userId,value.name,value.phone,value.mobile,JSON.stringify(value.permissions),value.active?1:0,passwordData.password_hash,passwordData.password_salt,passwordData.password_iterations,now,who.id).run();
 }
 return Response.json({message:old?(value.password?'User updated and password reset.':'User updated.'):'User added. They can now sign in with their email and password.'},{headers:privateHeaders});
 }catch(e){return fail(e);}}
