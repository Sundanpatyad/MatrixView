import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useSocketOptional } from '@/context/SocketContext';
import { initialsOf } from '@/lib/format';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { avatarColors, useColors } from '@/theme';

interface AvatarProps {
  name?: string | null;
  uri?: string | null;
  size?: number;
  /** Renders a presence ring in the bottom-right corner when defined. */
  online?: boolean;
  /** Live socket presence — preferred over `online` when both are set. */
  userId?: string | null;
  square?: boolean;
}

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return avatarColors[hash % avatarColors.length];
}

export function Avatar({ name, uri, size = 40, online, userId, square = false }: AvatarProps) {
  const colors = useColors();
  const socket = useSocketOptional();
  const live = userId && socket ? socket.isOnline(userId) : undefined;
  const flag = live ?? online;
  const showDot = userId != null || online !== undefined;
  const resolved = resolveMediaUrl(uri);
  const background = colorFor(name ?? '?');
  const borderRadius = square ? size * 0.28 : size / 2;
  const dot = Math.max(9, Math.round(size * 0.26));

  return (
    <View style={{ width: size, height: size }}>
      <View style={{ width: size, height: size, borderRadius, overflow: 'hidden' }}>
        {resolved ? (
          <Image
            source={{ uri: resolved }}
            style={{ width: size, height: size, backgroundColor: colors.surfaceAlt }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View style={[styles.fallback, { width: size, height: size, backgroundColor: background }]}>
            <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initialsOf(name)}</Text>
          </View>
        )}
      </View>

      {showDot ? (
        <View
          style={[
            styles.presence,
            {
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: flag ? colors.success : colors.textSubtle,
              borderColor: colors.bg,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

/** Resolve a project-member seat id (or user id) to the User id used for socket presence. */
export function presenceUserIdFromMembers(
  members: Array<{ id: string; userId?: string | null }>,
  assigneeId?: string | null,
): string | undefined {
  if (!assigneeId) return undefined;
  const match = members.find((m) => m.id === assigneeId || m.userId === assigneeId);
  return match?.userId || match?.id || assigneeId;
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#ffffff',
    fontWeight: '700',
  },
  presence: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    borderWidth: 2,
  },
});
