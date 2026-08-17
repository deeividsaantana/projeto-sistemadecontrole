import type { AppNotification } from '../types';
import { writeStoredJson } from '../data/localStore';
import { STORAGE_KEYS } from '../data/storageKeys';

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type NotificationType = AppNotification['type'];
export type NotificationSource = AppNotification['source'];

const MAX_NOTIFICATIONS = 50;

const createNotificationId = (prefix = 'notif') =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

export const getInitialNotifications = (): AppNotification[] => [];

export const createNotification = (
  title: string,
  message: string,
  type: NotificationType = 'info',
  source: NotificationSource = 'Netlify App',
  idPrefix = 'notif',
): AppNotification => ({
  id: createNotificationId(idPrefix),
  title,
  message,
  type,
  timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  read: false,
  source,
});

export const prependNotifications = (
  current: AppNotification[],
  incoming: AppNotification[],
): AppNotification[] => [...incoming, ...current].slice(0, MAX_NOTIFICATIONS);

export const markAllNotificationsAsRead = (
  notifications: AppNotification[],
): AppNotification[] => notifications.map(notification => ({ ...notification, read: true }));

export const markNotificationAsRead = (
  notifications: AppNotification[],
  id: string,
): AppNotification[] => notifications.map(
  notification => notification.id === id ? { ...notification, read: true } : notification,
);

export const persistNotifications = (
  storage: BrowserStorage,
  notifications: AppNotification[],
): void => {
  writeStoredJson(storage, STORAGE_KEYS.notifications, notifications);
};
