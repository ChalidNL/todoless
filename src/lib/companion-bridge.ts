import { useEffect } from 'react';
import type { User } from '../types';
import { pb } from './pocketbase';
import {
  addNativeNotificationActionListener,
  getNativeCompanionDeviceContext,
  isNativeCompanionAvailable,
  requestNativeNotificationPermission,
  scheduleNativeCompanionNotification,
} from './companion-native';

type CompanionNotificationRecord = {
  id: string;
  device_id?: string;
  title?: string;
  body?: string;
  type?: string;
  task_id?: string;
  path?: string;
  source?: string;
  created_at?: string;
};

const APP_VERSION = '0.1.0';

const normalizePath = (path: string | undefined, taskId: string | undefined) => {
  const trimmed = String(path || '').trim();
  if (trimmed) return trimmed;
  const task = String(taskId || '').trim();
  return task ? `/tasks/${task}` : '';
};

const openPath = (path: string) => {
  const target = normalizePath(path, '');
  if (!target) return;
  if (window.location.pathname !== target) {
    window.history.pushState({}, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
};

export function useCompanionBridge(user: User | null) {
  useEffect(() => {
    if (!isNativeCompanionAvailable()) return;

    let dispose = () => {};

    void addNativeNotificationActionListener(async (route) => {
      openPath(route);
    }).then((unsubscribe) => {
      dispose = () => {
        void unsubscribe();
      };
    }).catch((error) => {
      console.warn('[Doneday Companion] notification action listener failed', error);
    });

    return () => dispose();
  }, []);

  useEffect(() => {
    if (!isNativeCompanionAvailable()) return;
    if (!pb.authStore.isValid || !pb.authStore.token || !user) return;

    let cancelled = false;
    let activeDeviceId = '';

    const registerDevice = async () => {
      const device = await getNativeCompanionDeviceContext(APP_VERSION);
      if (!device?.deviceId) {
        throw new Error('Native companion device context unavailable');
      }

      activeDeviceId = device.deviceId;

      const response = await fetch(`${pb.baseURL}/api/companion/devices/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pb.authStore.token}`,
        },
        body: JSON.stringify({
          deviceId: device.deviceId,
          deviceName: device.deviceName || '',
          platform: device.platform || 'android',
          osVersion: device.osVersion || '',
          appVersion: device.appVersion || APP_VERSION,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || `Device registration failed with ${response.status}`);
      }

      const permission = await requestNativeNotificationPermission();
      console.info('[Doneday Companion] device registered', {
        deliveryMode: payload?.deliveryMode || 'pocketbase-realtime',
        permission,
      });
    };

    const subscribe = async () => {
      await pb.collection('companion_notifications').subscribe('*', async (event) => {
        if (cancelled || event.action !== 'create') return;

        const record = event.record as CompanionNotificationRecord;
        if (activeDeviceId && record.device_id && record.device_id !== activeDeviceId) {
          return;
        }

        const path = normalizePath(record.path, record.task_id);
        await scheduleNativeCompanionNotification({
          id: record.id,
          title: record.title || 'Doneday',
          body: record.body || '',
          type: record.type || 'task',
          taskId: record.task_id || '',
          path,
          source: record.source || 'backend',
          createdAt: record.created_at || new Date().toISOString(),
        });
      });
    };

    void registerDevice()
      .then(subscribe)
      .catch((error) => {
        console.error('[Doneday Companion] native bridge setup failed', error);
      });

    return () => {
      cancelled = true;
      pb.collection('companion_notifications').unsubscribe('*');
    };
  }, [user?.id, pb.authStore.isValid]);
}
