import 'server-only';
import {requireSecondFactor} from './two-factor';
import {env} from 'cloudflare:workers';
import {db} from './store';
import {authenticatedEmail,authenticatedFullName,authenticatedUserId,isAuthenticated} from './request-auth';
import {allPermissions,noPermissions,effectivePermissions,type Permissions,type Permission} from './permissions';
export type WorkspaceUser={email:string;user_id:string|null;name:string;phone:string;mobile:string;permissions:string;active:number;version:number;updated:string;updated_by:string};
export type Actor={id:string;email:string;name:string;permissions:Permissions;bootstrap:boolean};
export const bootstrapIds=()=>new Set((env.COST_ADMIN_USER_IDS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));
export async function identityActor(request:Request):Promise<Actor>{
 const id=authenticatedUserId(request),email=authenticatedEmail(request);
 if(!id||!email)throw Error('Sign in to the Sales Workspace.');
 if(bootstrapIds().has(id.toLowerCase())){
  // Preserve the existing trusted administrator; never grant from a domain or first login.
  const name=authenticatedFullName(request)||email;
  await db().prepare('INSERT INTO workspace_users (email,user_id,name,permissions,active,version,updated,updated_by) VALUES (?,?,?,?,1,1,?,?) ON CONFLICT(email) DO UPDATE SET user_id=excluded.user_id WHERE workspace_users.user_id IS NOT excluded.user_id').bind(email,id,name,JSON.stringify(allPermissions),new Date().toISOString(),id).run();
  const stored=await db().prepare('SELECT name FROM workspace_users WHERE email=?').bind(email).first<{name:string}>();
  return {id,email,name:stored?.name||name,permissions:{...allPermissions},bootstrap:true};
 }
 let row=await db().prepare('SELECT * FROM workspace_users WHERE user_id=? OR (email=? AND user_id IS NULL)').bind(id,email).first<WorkspaceUser>();
 if(!row||row.active!==1)throw Error('Your account does not have workspace access. Ask a Super Administrator to add or enable your email in Users.');
 if(!row.user_id){await db().prepare('UPDATE workspace_users SET user_id=? WHERE email=? AND user_id IS NULL AND active=1').bind(id,row.email).run();row=await db().prepare('SELECT * FROM workspace_users WHERE email=?').bind(row.email).first<WorkspaceUser>();if(!row||row.user_id!==id||row.active!==1)throw Error('Workspace account could not be verified.');}
 const raw=JSON.parse(row.permissions);const permissions={...noPermissions};for(const key of Object.keys(permissions) as Permission[])permissions[key]=raw[key]===true;
 return {id,email,name:row.name,permissions:effectivePermissions(permissions),bootstrap:false};
}
export async function actor(request:Request):Promise<Actor>{const user=await identityActor(request);await requireSecondFactor(request,user);return user;}
export async function requirePermission(request:Request,permission:Permission){const user=await actor(request);if(!user.permissions[permission])throw Error('You do not have permission to '+({createEdit:'create or edit quotes',sendQuotes:'send or approve quotes for customers',createOnBehalf:'create quotes on behalf of other users',viewCosts:'view costs or GP',viewTeam:'view team quotes',applyDiscounts:'apply item discounts',approveRestricted:'approve restricted quotes',superAdmin:'manage workspace settings and users'}[permission])+'.');return user;}
export async function accessStatus(request:Request,permission?:Permission):Promise<200|401|403>{if(!isAuthenticated(request))return 401;try{const user=await actor(request);return !permission||user.permissions[permission]?200:403;}catch{return 403;}}
export async function readQuote(request:Request,id:string,user?:Actor){const who=user||await actor(request);const row=await db().prepare('SELECT data,version,owner FROM quotes WHERE id=?').bind(id).first<{data:string;version:number;owner:string}>();if(!row||(row.owner!==who.id&&!who.permissions.viewTeam))throw Error('Quote not found or team access is not permitted.');return {...row,quote:{...JSON.parse(row.data),version:row.version}};}
export async function productOwner(request:Request,id:string){const user=await actor(request);const row=await db().prepare('SELECT owner,quote_id FROM adhoc_products WHERE id=?').bind(id).first<{owner:string;quote_id:string}>();if(!row)return null;await readQuote(request,row.quote_id,user);return row.owner;}
