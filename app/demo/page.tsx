import {getGpSettings} from '@/lib/gp-settings';
export const dynamic='force-dynamic';
import QuoteApp from '../quote-app';
export const metadata={title:'Verdex Quotes — shared demo',description:'Try the Verdex quote experience with ABC Company and sample products.'};
export default async function DemoPage(){const {targetPct}=await getGpSettings();return <QuoteApp initialGpTarget={targetPct} initialView="customer" sharedDemo/>;}
