export type NavigationSyncTrigger = 'none' | 'refresh';

export function navigationSyncTrigger(options: { explicitRefresh?: boolean }): NavigationSyncTrigger {
  return options.explicitRefresh ? 'refresh' : 'none';
}
