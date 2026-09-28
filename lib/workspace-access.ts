import 'server-only';
import {requireSecondFactor} from './two-factor';
import {env} from 'cloudflare:workers';
import {db} from './store';
import {hasAppSession,sessionIdentity} from './password-auth';
import {noPermissions,effectivePermissions,type Permissions,type Permission} from './permissions';
export type WorkspaceUser={email:string;user_id:string|null;name:string;phone:string;mobile:string;permissions:string;active:number;version:number;updated:string;updated_by:string;password_hash?:string;password_salt?:string;password_iterations?:number};
export type Actor={id:string;email:string;name:string;permissions:Permissions;bootstrap:boolean};
export const bootstrapIds=()=>new Set((env.COST_ADMIN_USER_IDS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));
function permissionsFrom(raw:string){const parsed=JSON.parse(raw),permissions={...noPermissions};for(const key of Object.keys(permissions) as Permission[])permissions[key]=parsed[key]===true;return effectivePermissions(permissions);}
export async function identityActor(request:Request):Promise<Actor>{
 const session=await sessionIdentity(request);
 if(!session)throw Error('Sign in to the Sales Workspace.');
 const row=await db().prepare('SELECT * FROM workspace_users WHERE user_id=? AND email=? AND active=1').bind(session.id,session.email).first<WorkspaceUser>();
 if(!row)throw Error('Your account does not have workspace access. Ask a Super Administrator to add or enable your email in Users.');
 return {id:session.id,email:row.email,name:row.name,permissions:permissionsFrom(row.permissions),bootstrap:bootstrapIds().has(row.email)||bootstrapIds().has(session.id.toLowerCase())};
}
export async function actor(request:Request):Promise<Actor>{const user=await identityActor(request);await requireSecondFactor(request,user);return user;}
export async function requirePermission(request:Request,permission:Permission){const user=await actor(request);if(!user.permissions[permission])throw Error('You do not have permission to '+({createEdit:'create or edit quotes',sendQuotes:'send or approve quotes for customers',createOnBehalf:'create quotes on behalf of other users',viewCosts:'view costs or GP',viewTeam:'view team quotes',applyDiscounts:'apply item discounts',approveRestricted:'approve restricted quotes',superAdmin:'manage workspace settings and users'}[permission])+'.');return user;}
export async function accessStatus(request:Request,permission?:Permission):Promise<200|401|403>{if(!hasAppSession(request))return 401;try{const user=await actor(request);return !permission||user.permissions[permission]?200:403;}catch{return 403;}}
export async function readQuote(request:Request,id:string,user?:Actor){const who=user||await actor(request);const row=await db().prepare('SELECT data,version,owner FROM quotes WHERE id=?').bind(id).first<{data:string;version:number;owner:string}>();if(!row||(row.owner!==who.id&&!who.permissions.viewTeam))throw Error('Quote not found or team access is not permitted.');return {...row,quote:{...JSON.parse(row.data),version:row.version}};}
export async function productOwner(request:Request,id:string){const user=await actor(request);const row=await db().prepare('SELECT owner,quote_id FROM adhoc_products WHERE id=?').bind(id).first<{owner:string;quote_id:string}>();if(!row)return null;await readQuote(request,row.quote_id,user);return row.owner;}
