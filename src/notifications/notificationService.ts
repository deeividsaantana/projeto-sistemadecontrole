import type { AppNotification } from '../types';
import { writeStoredJson } from '../data/localStore';
import { STORAGE_KEYS } from '../data/storageKeys';

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type NotificationType = AppNotification['type'];
export type NotificationSource = AppNotification['source'];

const MAX_NOTIFICATIONS = 50;
// Um aviso de erro já levou 5,7 MB de texto para a nuvem e derrubou o banco.
export const MAX_NOTIFICATION_MESSAGE = 400;

const limitarMensagem = (message: string) => {
  const texto = String(message ?? '');
  return texto.length > MAX_NOTIFICATION_MESSAGE ? `${texto.slice(0, MAX_NOTIFICATION_MESSAGE - 1)}…` : texto;
};

const limitarAviso = (aviso: AppNotification): AppNotification => {
  const message = limitarMensagem(aviso.message);
  return message === aviso.message ? aviso : { ...aviso, message };
};

const createNotificationId = (prefix = 'notif') =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

export const getInitialNotifications = (): AppNotification[] => [];

export const createNotification = (
  title: string,
  message: string,
  type: NotificationType = 'info',
  source: NotificationSource = 'RENEA API',
  idPrefix = 'notif',
): AppNotification => ({
  id: createNotificationId(idPrefix),
  title,
  message: limitarMensagem(message),
  type,
  timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  read: false,
  source,
});

export const prependNotifications = (
  current: AppNotification[],
  incoming: AppNotification[],
): AppNotification[] => [...incoming, ...current].slice(0, MAX_NOTIFICATIONS).map(limitarAviso);

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
