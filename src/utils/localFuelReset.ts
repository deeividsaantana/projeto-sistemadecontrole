export const LOCAL_FUEL_RESET_VERSION = '2026-09-18';
export const LOCAL_FUEL_RESET_STORAGE_KEY = 'renea_local_fuel_reset_version';

export const shouldResetLocalFuel = (storedVersion?: string | null) =>
  storedVersion !== LOCAL_FUEL_RESET_VERSION;
