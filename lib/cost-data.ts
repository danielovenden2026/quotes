import 'server-only';
import {env} from 'cloudflare:workers';
import {createCostCache, createCostSource} from './cost-source';

let load: ReturnType<typeof createCostCache> | undefined;
export function getCosts() {
  load ??= createCostCache(createCostSource(env));
  return load();
}
