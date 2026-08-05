import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { radius, useColors } from '@/theme';

const DOTS = [0, 1, 2];
const DOT_DURATION_MS = 420;

function useDotAnimation(index: number) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(index * (DOT_DURATION_MS / 2)),
        Animated.timing(value, {
          toValue: 1,
          duration: DOT_DURATION_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: DOT_DURATION_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay((DOTS.length - index) * (DOT_DURATION_MS / 2)),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [index, value]);

  return value;
}

function Dot({ index, color }: { index: number; color: string }) {
  const value = useDotAnimation(index);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          backgroundColor: color,
          opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
          transform: [
            { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) },
          ],
        },
      ]}
    />
  );
}

/**
 * Sits directly above the composer rather than inside the inverted message
 * list, where it would need to be counter-flipped.
 */
export function TypingIndicator({ names }: { names: string[] }) {
  const colors = useColors();
  if (!names.length) return null;

  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : `${names[0]} and ${names.length - 1} others are typing`;

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite" accessibilityLabel={label}>
      <View style={[styles.bubble, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        {DOTS.map((index) => (
          <Dot key={index} index={index} color={colors.brand} />
        ))}
      </View>
      <Text style={[styles.label, { color: colors.brand }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    flex: 1,
    fontSize: 12,
    fontStyle: 'italic',
  },
});
