import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export type NotificationNavData = {
  conversationId?: string | null;
  taskId?: string | null;
  projectId?: string | null;
};

export function navigateToNotification(data: NotificationNavData) {
  let attempts = 0;
  const go = () => {
    if (!navigationRef.isReady()) {
      if (attempts++ < 25) setTimeout(go, 200);
      return;
    }
    const conversationId = data.conversationId?.trim();
    const taskId = data.taskId?.trim();
    const projectId = data.projectId?.trim();
    if (conversationId) {
      navigationRef.navigate('ChatThread', { conversationId });
      return;
    }
    if (taskId) {
      navigationRef.navigate('TaskDetail', { taskId });
      return;
    }
    if (projectId) {
      navigationRef.navigate('ProjectMembers', { projectId });
      return;
    }
    navigationRef.navigate('Tabs', { screen: 'Alerts' });
  };
  go();
}

export function dataFromNotificationPayload(
  data: Record<string, unknown> | undefined,
): NotificationNavData {
  const str = (key: string) => {
    const value = data?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  };
  return {
    conversationId: str('conversationId'),
    taskId: str('taskId'),
    projectId: str('projectId'),
  };
}
