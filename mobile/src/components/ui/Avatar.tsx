import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { initialsOf } from '@/lib/format';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { avatarColors, useColors } from '@/theme';

interface AvatarProps {
  name?: string | null;
  uri?: string | null;
  size?: number;
  /** Renders a presence ring in the bottom-right corner when defined. */
  online?: boolean;
  square?: boolean;
}

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return avatarColors[hash % avatarColors.length];
}

export function Avatar({ name, uri, size = 40, online, square = false }: AvatarProps) {
  const colors = useColors();
  const resolved = resolveMediaUrl(uri);
  const background = colorFor(name ?? '?');
  const borderRadius = square ? size * 0.28 : size / 2;
  const dot = Math.max(9, Math.round(size * 0.26));

  return (
    <View style={{ width: size, height: size }}>
      {resolved ? (
        <Image
          source={{ uri: resolved }}
          style={{ width: size, height: size, borderRadius, backgroundColor: colors.surfaceAlt }}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View style={[styles.fallback, { width: size, height: size, borderRadius, backgroundColor: background }]}>
          <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initialsOf(name)}</Text>
        </View>
      )}

      {online !== undefined ? (
        <View
          style={[
            styles.presence,
            {
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: online ? colors.success : colors.textSubtle,
              borderColor: colors.bg,
            },
          ]}
        />
      ) : null}
    </View>
  );
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
