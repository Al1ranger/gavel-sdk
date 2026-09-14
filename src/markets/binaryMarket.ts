import { MarketLifecycle, type LifecycleConfig } from '../core/lifecycle.ts';
export function binaryMarket(config: Omit<LifecycleConfig, 'outcomes'>): MarketLifecycle { return new MarketLifecycle({ ...config, outcomes: ['YES', 'NO'] }); }
