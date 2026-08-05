import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/ui/GlassSurface';
import { useChat } from '@/context/ChatContext';
import { useNotifications } from '@/context/NotificationContext';
import { BoardScreen } from '@/screens/board/BoardScreen';
import { ChatListScreen } from '@/screens/chat/ChatListScreen';
import { DashboardScreen } from '@/screens/dashboard/DashboardScreen';
import { NotificationsScreen } from '@/screens/notifications/NotificationsScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { useColors } from '@/theme';

import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

/** Height of the icon + label rows, before the device's bottom inset. */
export const TAB_BAR_CONTENT_HEIGHT = 58;

const ICONS: Record<keyof TabParamList, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Board: { active: 'grid', inactive: 'grid-outline' },
  Chat: { active: 'chatbubbles', inactive: 'chatbubbles-outline' },
  Alerts: { active: 'notifications', inactive: 'notifications-outline' },
  Profile: { active: 'person-circle', inactive: 'person-circle-outline' },
};

export function TabNavigator() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { totalUnread } = useChat();
  const { unreadCount } = useNotifications();

  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 8);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textSubtle,
        // Floating over the content is what makes the blur read as glass.
        tabBarBackground: () => <GlassSurface edge="top" style={StyleSheet.absoluteFill} />,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
          paddingTop: 8,
          paddingBottom: bottomInset,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarBadgeStyle: {
          backgroundColor: colors.danger,
          color: '#ffffff',
          fontSize: 10,
          fontWeight: '700',
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icon = ICONS[route.name as keyof TabParamList];
          return <Ionicons name={focused ? icon.active : icon.inactive} size={size - 1} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Board" component={BoardScreen} />
      <Tab.Screen
        name="Chat"
        component={ChatListScreen}
        options={{ tabBarBadge: totalUnread > 0 ? (totalUnread > 99 ? '99+' : totalUnread) : undefined }}
      />
      <Tab.Screen
        name="Alerts"
        component={NotificationsScreen}
        options={{ tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
