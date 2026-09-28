import {env} from 'cloudflare:workers';
import {db} from '@/lib/store';
import {clearLoginFailures,createSession,dummyPasswordCheck,loginAllowed,makePassword,recordLoginFailure,verifyPassword} from '@/lib/password-auth';
import {privateHeaders} from '@/lib/admin-access';
import {allPermissions} from '@/lib/permissions';
type LoginUser={email:string;user_id:string|null;name:string;active:number;version:number;password_hash:string;password_salt:string;password_iterations:number};
const json=(body:unknown,status=200,headers:Record<string,string>={})=>Response.json(body,{status,headers:{...privateHeaders,...headers}});
const bootstrapEmails=()=>new Set((env.COST_ADMIN_USER_IDS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));
export async function POST(request:Request){
 try{
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Request origin is not allowed.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Send a JSON request.'},415);
  const raw=await request.text();if(raw.length>3000)return json({error:'Request is too large.'},413);
  let body:any;try{body=JSON.parse(raw);}catch{return json({error:'Enter your email and password.'},400);}
  const email=typeof body?.email==='string'?body.email.trim().toLowerCase():'',password=typeof body?.password==='string'?body.password:'';
  if(!/^\S+@\S+\.\S+$/.test(email)||password.length<1||password.length>128)return json({error:'Email or password is incorrect.'},401);
  if(!await loginAllowed(email))return json({error:'Too many sign-in attempts. Wait 15 minutes and try again.'},429);
  let user=await db().prepare('SELECT * FROM workspace_users WHERE email=? AND active=1').bind(email).first<LoginUser>();
  if(!user){
   const initial=env.VERDEX_INITIAL_ADMIN_PASSWORD||'';
   if(bootstrapEmails().has(email)&&initial.length>=10&&password===initial){
    const passwordData=await makePassword(password),now=new Date().toISOString();
    await db().prepare('INSERT INTO workspace_users (email,user_id,name,phone,mobile,permissions,active,password_hash,password_salt,password_iterations,version,updated,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?)').bind(email,email,email,'','',JSON.stringify(allPermissions),1,passwordData.password_hash,passwordData.password_salt,passwordData.password_iterations,now,email).run();
    user=await db().prepare('SELECT * FROM workspace_users WHERE email=? AND active=1').bind(email).first<LoginUser>();
   }else{await dummyPasswordCheck(password);await recordLoginFailure(email);return json({error:'Email or password is incorrect.'},401);}
  }
  if(!user)return json({error:'Sign-in is temporarily unavailable. Please try again.'},503);
  let version=user.version,userId=user.user_id||user.email;
  if(!user.password_hash){
   const bootstrap=bootstrapEmails().has(email),initial=env.VERDEX_INITIAL_ADMIN_PASSWORD||'';
   if(!bootstrap||initial.length<10||password!==initial){await dummyPasswordCheck(password);await recordLoginFailure(email);return json({error:'A password has not been set for this user yet. Ask a Super Administrator to set one in Users.'},403);}
   const passwordData=await makePassword(password);version=user.version+1;
   await db().prepare('UPDATE workspace_users SET user_id=COALESCE(user_id,?),password_hash=?,password_salt=?,password_iterations=?,version=?,updated=?,updated_by=? WHERE email=?').bind(userId,passwordData.password_hash,passwordData.password_salt,passwordData.password_iterations,version,new Date().toISOString(),userId,email).run();
  }else if(!await verifyPassword(password,user)){await recordLoginFailure(email);return json({error:'Email or password is incorrect.'},401);}
  if(!user.user_id)await db().prepare('UPDATE workspace_users SET user_id=? WHERE email=? AND user_id IS NULL').bind(userId,user.email).run();
  await clearLoginFailures(email);
  return json({ok:true,name:user.name},200,{'Set-Cookie':await createSession(userId,version)});
 }catch(error){console.error(error);return json({error:'Sign-in is temporarily unavailable. Please try again.'},503);}
}
