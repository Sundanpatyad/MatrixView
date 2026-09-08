import { useCallback, useEffect, useState } from 'react';

const busyListeners = new Set<(busy: boolean) => void>();
let requestManualCheck: (() => void) | null = null;

export function setUpdateCheckBusy(busy: boolean) {
  busyListeners.forEach((listener) => listener(busy));
}

export function bindManualUpdateCheck(fn: (() => void) | null) {
  requestManualCheck = fn;
}

export function useManualUpdateCheck() {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    busyListeners.add(setBusy);
    return () => {
      busyListeners.delete(setBusy);
    };
  }, []);

  const checkNow = useCallback(() => {
    setUpdateCheckBusy(true);
    requestManualCheck?.();
  }, []);

  return { busy, checkNow };
}
