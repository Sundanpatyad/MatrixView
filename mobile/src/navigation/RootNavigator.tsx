import { DarkTheme, DefaultTheme, NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { RegisterScreen } from '@/screens/auth/RegisterScreen';
import { WelcomeScreen } from '@/screens/auth/WelcomeScreen';
import { CreateTaskScreen } from '@/screens/board/CreateTaskScreen';
import { ManageTeamsScreen } from '@/screens/board/ManageTeamsScreen';
import { ProjectMembersScreen } from '@/screens/board/ProjectMembersScreen';
import { TaskDetailScreen } from '@/screens/board/TaskDetailScreen';
import { ChatThreadScreen } from '@/screens/chat/ChatThreadScreen';
import { ConversationInfoScreen } from '@/screens/chat/ConversationInfoScreen';
import { NewChatScreen } from '@/screens/chat/NewChatScreen';
import { NewGroupScreen } from '@/screens/chat/NewGroupScreen';
import { CreateProjectScreen } from '@/screens/dashboard/CreateProjectScreen';
import { EditProfileScreen } from '@/screens/profile/EditProfileScreen';
import { SettingsScreen } from '@/screens/profile/SettingsScreen';
import { useTheme } from '@/theme';

import { TabNavigator } from './TabNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const linkingConfig: LinkingOptions<RootStackParamList>['config'] = {
  screens: {
    Register: 'register',
    Tabs: {
      screens: {
        Home: 'home',
        Board: 'board',
        Chat: 'chat',
        Alerts: 'notifications',
        Profile: 'profile',
      },
    },
    TaskDetail: 'task/:taskId',
    ChatThread: 'conversation/:conversationId',
  },
};

function getLinkingPrefixes(): string[] {
  const prefixes = ['dockx://', 'exp://'];
  try {
    const expoUrl = Linking.createURL('/');
    if (expoUrl) prefixes.unshift(expoUrl);
  } catch {
    // Expo Go can evaluate JS before expo-constants injects the manifest.
    // Keep static prefixes so the navigator still mounts.
  }
  return prefixes;
}

function BootstrapScreen() {
  const { colors } = useTheme();
  return (
    <View style={[styles.bootstrap, { backgroundColor: colors.bg }]}>
      <ActivityIndicator color={colors.brand} size="large" />
      <Text style={[styles.bootstrapText, { color: colors.textSubtle }]}>Restoring your session…</Text>
    </View>
  );
}

export function RootNavigator() {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const { colors, isDark } = useTheme();

  const linking = useMemo<LinkingOptions<RootStackParamList>>(
    () => ({ prefixes: getLinkingPrefixes(), config: linkingConfig }),
    [],
  );

  const navigationTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.brand,
        background: colors.bg,
        card: colors.bgElevated,
        text: colors.text,
        border: colors.border,
        notification: colors.danger,
      },
    };
  }, [colors, isDark]);

  if (isBootstrapping) {
    return <BootstrapScreen />;
  }

  return (
    <NavigationContainer theme={navigationTheme} linking={linking} fallback={<BootstrapScreen />}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        {isAuthenticated ? (
          <Stack.Group>
            <Stack.Screen name="Tabs" component={TabNavigator} />

            <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
            <Stack.Screen name="CreateTask" component={CreateTaskScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen
              name="CreateProject"
              component={CreateProjectScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
            <Stack.Screen name="ProjectMembers" component={ProjectMembersScreen} />
            <Stack.Screen name="ManageTeams" component={ManageTeamsScreen} />

            <Stack.Screen name="ChatThread" component={ChatThreadScreen} />
            <Stack.Screen name="NewChat" component={NewChatScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="NewGroup" component={NewGroupScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="ConversationInfo" component={ConversationInfoScreen} />

            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </Stack.Group>
        ) : (
          <Stack.Group screenOptions={{ animation: 'fade' }}>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ animation: 'slide_from_right' }}
            />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  bootstrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  bootstrapText: {
    fontSize: 14,
  },
});
