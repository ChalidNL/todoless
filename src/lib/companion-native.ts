export type CompanionDeviceContext = {
  deviceId: string;
  deviceName?: string;
  platform?: string;
  osVersion?: string;
  appVersion?: string;
};

export type CompanionNotificationPayload = {
  id?: string;
  title?: string;
  body?: string;
  type?: string;
  taskId?: string;
  path?: string;
  url?: string;
  source?: string;
  createdAt?: string;
};

type CapacitorPluginMap = {
  Device?: {
    getInfo?: () => Promise<{
      platform?: string;
      operatingSystem?: string;
      osVersion?: string;
    }>;
    getId?: () => Promise<{ identifier?: string }>;
  };
  LocalNotifications?: {
    checkPermissions?: () => Promise<{ display?: string }>;
    requestPermissions?: () => Promise<{ display?: string }>;
    schedule?: (options: {
      notifications: Array<Record<string, unknown>>;
    }) => Promise<void>;
    addListener?: (
      eventName: string,
      listener: (event: { notification?: { extra?: Record<string, unknown> } }) => void | Promise<void>,
    ) => Promise<{ remove: () => Promise<void> } | { remove: () => void }> | { remove: () => Promise<void> } | { remove: () => void };
  };
};

type CapacitorBridge = {
  isNativePlatform?: () => boolean;
  Plugins?: CapacitorPluginMap;
};

const getCapacitorBridge = (): CapacitorBridge | null => {
  if (typeof window === 'undefined') return null;
  return ((window as typeof window & { Capacitor?: CapacitorBridge }).Capacitor ?? null);
};

const getPlugins = (): CapacitorPluginMap => getCapacitorBridge()?.Plugins ?? {};

export const extractRouteFromCompanionPayload = (notificationData: Partial<CompanionNotificationPayload> = {}) => {
  if (typeof notificationData.path === 'string' && notificationData.path) {
    return notificationData.path;
  }

  if (typeof notificationData.taskId === 'string' && notificationData.taskId) {
    return `/tasks/${notificationData.taskId}`;
  }

  if (typeof notificationData.url === 'string' && notificationData.url.startsWith('/')) {
    return notificationData.url;
  }

  return '';
};

export const isNativeCompanionAvailable = () => {
  const bridge = getCapacitorBridge();
  const plugins = getPlugins();
  return Boolean(bridge?.isNativePlatform?.() && plugins.Device && plugins.LocalNotifications);
};

export const getNativeCompanionDeviceContext = async (appVersion: string): Promise<CompanionDeviceContext | null> => {
  const plugins = getPlugins();
  if (!isNativeCompanionAvailable() || !plugins.Device?.getInfo || !plugins.Device?.getId) {
    return null;
  }

  const [info, deviceId] = await Promise.all([
    plugins.Device.getInfo(),
    plugins.Device.getId(),
  ]);

  const identifier = String(deviceId?.identifier ?? '').trim();
  if (!identifier) return null;

  const platform = String(info?.platform ?? 'android').trim() || 'android';
  const operatingSystem = String(info?.operatingSystem ?? platform).trim() || platform;
  const osVersion = String(info?.osVersion ?? '').trim();

  return {
    deviceId: identifier,
    deviceName: 'Doneday Companion',
    platform,
    osVersion: [operatingSystem, osVersion].filter(Boolean).join(' ').trim(),
    appVersion,
  };
};

export const checkNativeNotificationPermission = async () => {
  const plugins = getPlugins();
  if (!isNativeCompanionAvailable() || !plugins.LocalNotifications?.checkPermissions) {
    return 'unsupported';
  }

  const status = await plugins.LocalNotifications.checkPermissions();
  return String(status?.display ?? 'unknown');
};

export const requestNativeNotificationPermission = async () => {
  const plugins = getPlugins();
  if (!isNativeCompanionAvailable() || !plugins.LocalNotifications?.checkPermissions) {
    return 'unsupported';
  }

  let status = await plugins.LocalNotifications.checkPermissions();
  if (status?.display === 'prompt' && plugins.LocalNotifications.requestPermissions) {
    status = await plugins.LocalNotifications.requestPermissions();
  }

  return String(status?.display ?? 'unknown');
};

export const scheduleNativeCompanionNotification = async (notification: Partial<CompanionNotificationPayload>) => {
  const plugins = getPlugins();
  if (!isNativeCompanionAvailable() || !plugins.LocalNotifications?.schedule) {
    return false;
  }

  const route = extractRouteFromCompanionPayload(notification);
  const id = Math.floor(Date.now() % 2147483647);

  await plugins.LocalNotifications.schedule({
    notifications: [{
      id,
      title: notification.title || 'Doneday',
      body: notification.body || '',
      extra: {
        path: route,
        taskId: notification.taskId || '',
        type: notification.type || 'task',
      },
    }],
  });

  return true;
};

export const addNativeNotificationActionListener = async (
  listener: (route: string) => void | Promise<void>,
) => {
  const plugins = getPlugins();
  if (!isNativeCompanionAvailable() || !plugins.LocalNotifications?.addListener) {
    return () => {};
  }

  const subscription = await plugins.LocalNotifications.addListener(
    'localNotificationActionPerformed',
    async (event) => {
      const route = extractRouteFromCompanionPayload((event.notification?.extra ?? {}) as Partial<CompanionNotificationPayload>);
      if (route) {
        await listener(route);
      }
    },
  );

  return async () => {
    if (!subscription) return;
    await subscription.remove();
  };
};
