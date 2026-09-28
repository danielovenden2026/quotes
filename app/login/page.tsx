import {Suspense} from 'react';
import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {sessionIdentityFromCookie} from '@/lib/password-auth';
import LoginForm from './login-form';
export const dynamic='force-dynamic';
export default async function LoginPage(){const h=await headers();if(await sessionIdentityFromCookie(h.get('cookie')))redirect('/workspace');return <main className="login-page"><Suspense fallback={<div className="login-card"><p>Opening sign in…</p></div>}><LoginForm/></Suspense></main>;}
