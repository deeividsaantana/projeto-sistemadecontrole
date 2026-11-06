import { useEffect, useRef } from 'react';
import { listenCloudVersions } from '../cloud/cloudSyncGateway';

interface CloudSyncLifecycleOptions {
  enabled: boolean;
  initialDelayMs: number;
  fallbackIntervalMs: number;
  noticeDelayMs: number;
  onInitialCheck: () => void;
  onCheck: () => void;
  onVersion: (version: string) => void;
  onChannelError: () => void;
}

export function useCloudSyncLifecycle({
  enabled,
  initialDelayMs,
  fallbackIntervalMs,
  noticeDelayMs,
  onInitialCheck,
  onCheck,
  onVersion,
  onChannelError,
}: CloudSyncLifecycleOptions): void {
  const callbacks = useRef({ onInitialCheck, onCheck, onVersion, onChannelError });
  callbacks.current = { onInitialCheck, onCheck, onVersion, onChannelError };

  useEffect(() => {
    if (!enabled) return;

    const initialCheck = window.setTimeout(() => callbacks.current.onInitialCheck(), initialDelayMs);
    let noticeTimeout: number | undefined;
    const stopListening = listenCloudVersions(version => {
      window.clearTimeout(noticeTimeout);
      if (document.visibilityState === 'hidden') return;
      noticeTimeout = window.setTimeout(() => callbacks.current.onVersion(version), noticeDelayMs);
    }, () => callbacks.current.onChannelError());
    const interval = window.setInterval(() => callbacks.current.onCheck(), fallbackIntervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') callbacks.current.onCheck();
    };
    const onReconnect = () => callbacks.current.onCheck();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onReconnect);
    window.addEventListener('focus', onReconnect);

    return () => {
      window.clearTimeout(initialCheck);
      window.clearTimeout(noticeTimeout);
      window.clearInterval(interval);
      stopListening();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onReconnect);
      window.removeEventListener('focus', onReconnect);
    };
  }, [enabled, fallbackIntervalMs, initialDelayMs, noticeDelayMs]);
}
