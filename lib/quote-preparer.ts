import 'server-only';
import {db} from './store';
import {effectivePermissions,noPermissions} from './permissions';
import type {Actor,WorkspaceUser} from './workspace-access';
import type {Quote} from './quote';
export async function resolvePreparer(current:Quote,input:unknown,user:Actor){
 if(input===undefined)return current.salesperson;
 if(!input||typeof input!=='object')throw Error('Choose a valid Prepared By user.');
 const value=input as Record<string,unknown>;
 if(current.salesperson&&value.email===current.salesperson.email&&value.name===current.salesperson.name&&value.phone===current.salesperson.phone)return current.salesperson;
 if(!user.permissions.createOnBehalf)throw Error('You need permission to create quotes on behalf of other users to change Prepared By.');
 if(typeof value.email!=='string')throw Error('Choose a valid Prepared By user.');
 const row=await db().prepare('SELECT * FROM workspace_users WHERE email=? AND active=1').bind(value.email.trim().toLowerCase()).first<WorkspaceUser>();
 if(!row||!effectivePermissions({...noPermissions,...JSON.parse(row.permissions)}).createEdit)throw Error('Choose an enabled quote creator.');
 // Contact details are always taken from Users, never trusted from a browser payload.
 return {name:row.name,email:row.email,phone:row.phone};
}
