import { STORAGE_KEYS } from '../data/storageKeys';

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const SESSION_INACTIVITY_MS = 30 * 60 * 1000;

export const SESSION_ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'click',
  'keydown',
  'pointerdown',
  'touchstart',
];

export const recordSessionActivity = (
  storage: BrowserStorage,
  activityDate = new Date(),
): string => {
  const activityIso = activityDate.toISOString();
  storage.setItem(STORAGE_KEYS.sessionLastActivity, activityIso);
  return activityIso;
};
