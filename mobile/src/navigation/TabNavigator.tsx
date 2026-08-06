import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import React from 'react';
import { Platform } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Avatar } from '@/components/ui/Avatar';
import { canUseLiquidGlass } from '@/components/ui/GlassSurface';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useNotifications } from '@/context/NotificationContext';
import { BoardScreen } from '@/screens/board/BoardScreen';
import { ChatListScreen } from '@/screens/chat/ChatListScreen';
import { DashboardScreen } from '@/screens/dashboard/DashboardScreen';
import { NotificationsScreen } from '@/screens/notifications/NotificationsScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { useColors } from '@/theme';

import type { TabParamList } from './types';

const JsTab = createBottomTabNavigator<TabParamList>();
const NativeTab = createNativeBottomTabNavigator<TabParamList>();

/** Approx content height for layout helpers (native bar sizes itself). */
export const TAB_BAR_CONTENT_HEIGHT = 49;

const SF_ICONS: Record<
  Exclude<keyof TabParamList, 'Profile'>,
  { active: SFSymbol; inactive: SFSymbol }
> = {
  Home: { active: 'house.fill', inactive: 'house' },
  Board: { active: 'square.grid.2x2.fill', inactive: 'square.grid.2x2' },
  Chat: { active: 'bubble.left.and.bubble.right.fill', inactive: 'bubble.left.and.bubble.right' },
  Alerts: { active: 'bell.fill', inactive: 'bell' },
};

const JS_ICONS: Record<
  keyof TabParamList,
  { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Board: { active: 'grid', inactive: 'grid-outline' },
  Chat: { active: 'chatbubbles', inactive: 'chatbubbles-outline' },
  Alerts: { active: 'notifications', inactive: 'notifications-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

function badgeValue(count: number): number | string | undefined {
  if (count <= 0) return undefined;
  return count > 99 ? '99+' : count;
}

/** Native UITabBarController — real iOS 26 Liquid Glass + system selection animation. */
function NativeLiquidTabNavigator() {
  const colors = useColors();
  const { totalUnread } = useChat();
  const { unreadCount } = useNotifications();

  return (
    <NativeTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        // Keep the full system tab bar — 'onScrollDown' collapses it into the
        // tiny dark liquid capsule you saw after scrolling Home.
        tabBarMinimizeBehavior: 'none',
        tabBarControllerMode: 'tabBar',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
        tabBarBadgeStyle: {
          backgroundColor: colors.danger,
        },
      }}
    >
      <NativeTab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => ({
            type: 'sfSymbol',
            name: focused ? SF_ICONS.Home.active : SF_ICONS.Home.inactive,
          }),
        }}
      />
      <NativeTab.Screen
        name="Board"
        component={BoardScreen}
        options={{
          title: 'Board',
          tabBarLabel: 'Board',
          tabBarIcon: ({ focused }) => ({
            type: 'sfSymbol',
            name: focused ? SF_ICONS.Board.active : SF_ICONS.Board.inactive,
          }),
        }}
      />
      <NativeTab.Screen
        name="Chat"
        component={ChatListScreen}
        options={{
          title: 'Chats',
          tabBarLabel: 'Chat',
          tabBarBadge: badgeValue(totalUnread),
          tabBarIcon: ({ focused }) => ({
            type: 'sfSymbol',
            name: focused ? SF_ICONS.Chat.active : SF_ICONS.Chat.inactive,
          }),
        }}
      />
      <NativeTab.Screen
        name="Alerts"
        component={NotificationsScreen}
        options={{
          title: 'Notifications',
          tabBarLabel: 'Alerts',
          tabBarBadge: badgeValue(unreadCount),
          tabBarIcon: ({ focused }) => ({
            type: 'sfSymbol',
            name: focused ? SF_ICONS.Alerts.active : SF_ICONS.Alerts.inactive,
          }),
        }}
      />
      <NativeTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          // iOS 26+: `search` sits in a separate liquid-glass orb beside the main pill.
          // Circular SF Symbol only — remote photos aren't clipped by UITabBar and overflow.
          tabBarSystemItem: 'search',
          tabBarLabel: '',
          tabBarIcon: ({ focused }) => ({
            type: 'sfSymbol',
            name: focused ? 'person.crop.circle.fill' : 'person.crop.circle',
          }),
        }}
      />
    </NativeTab.Navigator>
  );
}

/** JS tabs for Android / older iOS without Liquid Glass. */
function JsTabNavigator() {
  const colors = useColors();
  const { user } = useAuth();
  const { totalUnread } = useChat();
  const { unreadCount } = useNotifications();

  return (
    <JsTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
        tabBarBadgeStyle: {
          backgroundColor: colors.danger,
          color: '#ffffff',
          fontSize: 10,
          fontWeight: '700',
        },
        tabBarIcon: ({ focused, color, size }) => {
          if (route.name === 'Profile') {
            return <Avatar name={user?.name} uri={user?.avatarUrl} size={size} />;
          }
          const icon = JS_ICONS[route.name as keyof TabParamList];
          return <Ionicons name={focused ? icon.active : icon.inactive} size={size - 2} color={color} />;
        },
      })}
    >
      <JsTab.Screen name="Home" component={DashboardScreen} options={{ tabBarLabel: 'Home' }} />
      <JsTab.Screen name="Board" component={BoardScreen} options={{ tabBarLabel: 'Board' }} />
      <JsTab.Screen
        name="Chat"
        component={ChatListScreen}
        options={{ tabBarLabel: 'Chat', tabBarBadge: badgeValue(totalUnread) }}
      />
      <JsTab.Screen
        name="Alerts"
        component={NotificationsScreen}
        options={{ tabBarLabel: 'Alerts', tabBarBadge: badgeValue(unreadCount) }}
      />
      <JsTab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
    </JsTab.Navigator>
  );
}

export function TabNavigator() {
  // Real UITabBarController Liquid Glass on iOS 26+ builds; JS tabs elsewhere.
  const useNative = Platform.OS === 'ios' && canUseLiquidGlass();
  return useNative ? <NativeLiquidTabNavigator /> : <JsTabNavigator />;
}
