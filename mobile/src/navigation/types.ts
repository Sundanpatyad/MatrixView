import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Home: undefined;
  Board: undefined;
  Chat: undefined;
  Alerts: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: { inviteToken?: string } | undefined;

  Tabs: NavigatorScreenParams<TabParamList> | undefined;

  TaskDetail: { taskId: string };
  CreateTask: { projectId: string; status?: string };
  CreateProject: undefined;
  ProjectMembers: { projectId: string };
  ManageTeams: { projectId: string };

  ChatThread: { conversationId: string };
  NewChat: undefined;
  NewGroup: undefined;
  ConversationInfo: { conversationId: string };

  EditProfile: undefined;
  Settings: undefined;
  TeamActivity: { projectId?: string } | undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
