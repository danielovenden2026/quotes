import { env } from 'cloudflare:workers';
export function db(){if(!env.DB)throw new Error('Quote storage is unavailable. Please try again.');return env.DB;}
export function owner(request:Request){const id=request.headers.get('oai-authenticated-user-id');if(id)return id;if(import.meta.env.DEV)return 'local-preview';throw new Error('Please sign in to access your quotes.');}
export function safeRequest(request:Request){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new Error('Request origin is not allowed.');}
export function fail(e:unknown){console.error(e);return Response.json({error:e instanceof Error?e.message:'Unable to save. Please try again.'},{status:400});}
