import 'server-only';
import {db} from './store';

const sessionCookie='__Host-verdex-session';
const sessionSeconds=12*60*60;
const passwordIterations=210000;
const encoder=new TextEncoder();

export type PasswordFields={password_hash:string;password_salt:string;password_iterations:number};
export type SessionIdentity={id:string;email:string;name:string};

function cookieValue(cookieHeader:string|null,name:string){
 if(!cookieHeader)return null;
 for(const item of cookieHeader.split(';')){
  const value=item.trim();
  if(value.startsWith(name+'='))return value.slice(name.length+1);
 }
 return null;
}
function bytesToBase64(bytes:Uint8Array){let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary);}
function base64ToBytes(value:string){try{return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}catch{return new Uint8Array();}}
function randomToken(bytes=32){return Array.from(crypto.getRandomValues(new Uint8Array(bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');}
async function sha256(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))).map(n=>n.toString(16).padStart(2,'0')).join('');}
async function derive(password:string,salt:Uint8Array,iterations:number){
 const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},material,256));
}
function equalBytes(a:Uint8Array,b:Uint8Array){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;}

export function validPassword(password:string){return password.length>=10&&password.length<=128;}
export async function makePassword(password:string):Promise<PasswordFields>{
 if(!validPassword(password))throw Error('Password must be at least 10 characters.');
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const hash=await derive(password,salt,passwordIterations);
 return {password_hash:bytesToBase64(hash),password_salt:bytesToBase64(salt),password_iterations:passwordIterations};
}
export async function verifyPassword(password:string,row:Partial<PasswordFields>){
 if(!row.password_hash||!row.password_salt||!row.password_iterations)return false;
 const salt=base64ToBytes(row.password_salt),expected=base64ToBytes(row.password_hash);
 if(salt.length!==16||expected.length!==32||row.password_iterations<100000)return false;
 const actual=await derive(password,salt,row.password_iterations);
 return equalBytes(actual,expected);
}

export function hasAppSession(request:Request){return !!cookieValue(request.headers.get('cookie'),sessionCookie);}
export async function sessionIdentityFromCookie(cookieHeader:string|null):Promise<SessionIdentity|null>{
 const token=cookieValue(cookieHeader,sessionCookie);
 if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
 const hash=await sha256(token),now=Date.now();
 const row=await db().prepare(`SELECT u.email,u.user_id,u.name FROM workspace_sessions s JOIN workspace_users u ON u.user_id=s.user_id WHERE s.hash=? AND s.expires>? AND u.active=1`).bind(hash,now).first<{email:string;user_id:string|null;name:string}>();
 if(!row?.user_id)return null;
 return {id:row.user_id,email:row.email,name:row.name};
}
export async function sessionIdentity(request:Request){return sessionIdentityFromCookie(request.headers.get('cookie'));}
export async function createSession(userId:string,userVersion:number){
 const token=randomToken(),hash=await sha256(token),now=Date.now(),expires=now+sessionSeconds*1000;
 await db().prepare('DELETE FROM workspace_sessions WHERE expires<=?').bind(now).run();
 await db().prepare('INSERT INTO workspace_sessions (hash,user_id,user_version,expires,created) VALUES (?,?,?,?,?)').bind(hash,userId,userVersion,expires,now).run();
 return `${sessionCookie}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${sessionSeconds}`;
}
export async function destroySession(cookieHeader:string|null){
 const token=cookieValue(cookieHeader,sessionCookie);
 if(token&&/^[a-f0-9]{64}$/.test(token))await db().prepare('DELETE FROM workspace_sessions WHERE hash=?').bind(await sha256(token)).run();
 return `${sessionCookie}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
}
export async function revokeUserSessions(userId:string){await db().prepare('DELETE FROM workspace_sessions WHERE user_id=?').bind(userId).run();}
export async function dummyPasswordCheck(password:string){
 const salt=encoder.encode('verdex-login-dummy').slice(0,16);
 await derive(password||'invalid-password',salt,passwordIterations);
}

export async function loginAllowed(email:string){
 const row=await db().prepare('SELECT attempts,window_start,locked_until FROM auth_login_attempts WHERE email=?').bind(email).first<{attempts:number;window_start:number;locked_until:number}>();
 return !row||row.locked_until<=Date.now();
}
export async function recordLoginFailure(email:string){
 const now=Date.now(),windowMs=15*60*1000;
 const row=await db().prepare('SELECT attempts,window_start,locked_until FROM auth_login_attempts WHERE email=?').bind(email).first<{attempts:number;window_start:number;locked_until:number}>();
 const attempts=!row||row.window_start<=now-windowMs?1:row.attempts+1;
 const windowStart=!row||row.window_start<=now-windowMs?now:row.window_start;
 const lockedUntil=attempts>=8?now+15*60*1000:0;
 await db().prepare('INSERT INTO auth_login_attempts (email,attempts,window_start,locked_until) VALUES (?,?,?,?) ON CONFLICT(email) DO UPDATE SET attempts=excluded.attempts,window_start=excluded.window_start,locked_until=excluded.locked_until').bind(email,attempts,windowStart,lockedUntil).run();
}
export async function clearLoginFailures(email:string){await db().prepare('DELETE FROM auth_login_attempts WHERE email=?').bind(email).run();}
