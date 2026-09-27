import QuoteApp from '../quote-app';
import { requireChatGPTUser } from '../chatgpt-auth';
export const dynamic = 'force-dynamic';
export default async function SamplePage() {
  if (!import.meta.env.DEV) await requireChatGPTUser('/sample');
  return <QuoteApp initialView="customer" freshSample />;
}
