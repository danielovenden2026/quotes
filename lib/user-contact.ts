import {z} from 'zod';
export const phoneSchema=z.string().trim().min(1,'Phone number is required.').max(40).refine(s=>/^[+()\d .-]+$/.test(s)&&s.replace(/\D/g,'').length>=7&&s.replace(/\D/g,'').length<=15,'Enter a valid phone number.');
export function normaliseMobile(value:string){const s=value.replace(/[\s().-]/g,'');return /^04\d{8}$/.test(s)?'+61'+s.slice(1):s;}
export const mobileSchema=z.string().trim().max(30).default('').transform(normaliseMobile).refine(s=>!s||/^\+[1-9]\d{7,14}$/.test(s),'Use an Australian mobile number or an international number starting with +.').refine(s=>!s.startsWith('+61')||/^\+614\d{8}$/.test(s),'Enter an Australian mobile number starting with 04 or +614.');
