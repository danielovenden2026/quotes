import 'server-only';
import {env} from 'cloudflare:workers';
import {db} from './store';
import type {Actor,WorkspaceUser} from './workspace-access';
export const mfaRequired=()=>env.TWO_FACTOR_REQUIRED==='true';
export const mfaConfigured=()=>/^AC[0-9a-f]{32}$/i.test(env.TWILIO_ACCOUNT_SID||'')&&!!env.TWILIO_AUTH_TOKEN&&/^VA[0-9a-f]{32}$/i.test(env.TWILIO_VERIFY_SERVICE_SID||'');
const cookieName='__Host-verdex-2fa';
export class SecondFactorRequired extends Error{constructor(){super('Verify your sign-in with an email or mobile code.');}}
async function profile(user:Actor){const row=await db().prepare('SELECT * FROM workspace_users WHERE user_id=? AND active=1').bind(user.id).first<WorkspaceUser>();if(!row)throw Error('Workspace user is disabled or unavailable.');return row;}
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(n=>n.toString(16).padStart(2,'0')).join('');
export async function requireSecondFactor(request:Request,user:Actor){
 if(!mfaRequired())return;
 const token=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
 if(!token||!/^[a-f0-9]{64}$/.test(token))throw new SecondFactorRequired();
 const row=await profile(user);const session=await db().prepare('SELECT hash FROM verification_sessions WHERE hash=? AND user_id=? AND user_version=? AND expires>?').bind(await hash(token),user.id,row.version,Date.now()).first();
 if(!session)throw new SecondFactorRequired();
}
export async function verificationStatus(user:Actor){const row=await profile(user);return {enabled:mfaRequired(),configured:mfaConfigured(),email:row.email.replace(/^(.).*(.@)/,'$1•••$2'),mobile:row.mobile?'•••• '+row.mobile.slice(-4):null};}
async function provider(path:string,body:URLSearchParams){
 if(!mfaConfigured())throw Error('Email/SMS verification is not connected. Ask your hosting administrator to configure it.');
 const response=await fetch('https://verify.twilio.com/v2/Services/'+env.TWILIO_VERIFY_SERVICE_SID+'/'+path,{method:'POST',headers:{Authorization:'Basic '+btoa(env.TWILIO_ACCOUNT_SID+':'+env.TWILIO_AUTH_TOKEN),'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(15000),redirect:'error'});
 if(!response.ok)throw Error(response.status===429?'Too many verification attempts. Please wait before trying again.':path==='VerificationCheck'?'The code is incorrect or has expired. Request a new code if needed.':'The code could not be sent. Try the other method or contact your administrator.');
 return await response.json() as {sid:string;status:string};
}
export async function sendCode(user:Actor,channel:'email'|'sms'){
 const row=await profile(user);if(!mfaConfigured())throw Error('Email/SMS verification is not connected.');
 const destination=channel==='sms'?row.mobile:row.email;if(!destination)throw Error('No mobile number is saved. Choose email or ask your administrator to add a mobile.');
 const now=Date.now();
 // Atomic reservation enforces cooldown and a shared per-user hourly budget across both channels.
 const reserved=await db().prepare(`INSERT INTO verification_challenges (user_id,sid,channel,user_version,expires,attempts,consumed,sends,window_start,last_sent) VALUES (?,'',?,?,?,0,0,1,?,?) ON CONFLICT(user_id) DO UPDATE SET sid='',channel=excluded.channel,user_version=excluded.user_version,expires=excluded.expires,attempts=0,consumed=0,sends=CASE WHEN verification_challenges.window_start<=? THEN 1 ELSE verification_challenges.sends+1 END,window_start=CASE WHEN verification_challenges.window_start<=? THEN excluded.window_start ELSE verification_challenges.window_start END,last_sent=excluded.last_sent WHERE verification_challenges.last_sent<=? AND (verification_challenges.window_start<=? OR verification_challenges.sends<5)`).bind(user.id,channel,row.version,now+600000,now,now,now-3600000,now-3600000,now-60000,now-3600000).run();
 if(!reserved.meta.changes)throw Error('Please wait at least 60 seconds between codes. Maximum five codes per hour.');
 const result=await provider('Verifications',new URLSearchParams({To:destination,Channel:channel}));
 if(result.status!=='pending'||!/^VE[0-9a-f]{32}$/i.test(result.sid))throw Error('The verification service did not accept the request.');
 await db().prepare('UPDATE verification_challenges SET sid=? WHERE user_id=? AND last_sent=? AND user_version=?').bind(result.sid,user.id,now,row.version).run();
 return {message:channel==='sms'?'A verification code was sent to your mobile.':'A verification code was sent to your email.',retryAfter:60};
}
export async function checkCode(user:Actor,code:string){
 if(!/^\d{4,10}$/.test(code))throw Error('Enter the verification code.');
 const row=await profile(user),now=Date.now();
 const claimed=await db().prepare("UPDATE verification_challenges SET attempts=attempts+1 WHERE user_id=? AND user_version=? AND expires>? AND attempts<5 AND consumed=0 AND sid<>'' RETURNING sid").bind(user.id,row.version,now).first<{sid:string}>();
 if(!claimed)throw Error('This code has expired or reached its attempt limit. Request a new code.');
 const result=await provider('VerificationCheck',new URLSearchParams({VerificationSid:claimed.sid,Code:code}));
 if(result.status!=='approved'||result.sid!==claimed.sid)throw Error('Incorrect code. Please try again.');
 const used=await db().prepare('UPDATE verification_challenges SET consumed=1 WHERE user_id=? AND sid=? AND consumed=0 AND user_version=? AND expires>?').bind(user.id,claimed.sid,row.version,Date.now()).run();
 if(!used.meta.changes)throw Error('This code was already used. Request a new code.');
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,'0')).join('');
 await db().prepare('DELETE FROM verification_sessions WHERE expires<=?').bind(now).run();
 await db().prepare('INSERT INTO verification_sessions (hash,user_id,user_version,expires) VALUES (?,?,?,?)').bind(await hash(token),user.id,row.version,now+28800000).run();
 return cookieName+'='+token+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800';
}
