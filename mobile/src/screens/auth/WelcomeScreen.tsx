import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

type CardSpec = {
  icon: keyof typeof Ionicons.glyphMap;
  colors: readonly [string, string];
  rotate: string;
  top: number;
  left: number;
  size: number;
  delay: number;
};

const CARDS: CardSpec[] = [
  { icon: 'grid-outline', colors: ['#5b4bff', '#8b5cf6'], rotate: '-14deg', top: 18, left: 8, size: 118, delay: 0 },
  { icon: 'chatbubbles-outline', colors: ['#0ea5e9', '#2563eb'], rotate: '10deg', top: 8, left: 118, size: 132, delay: 80 },
  { icon: 'videocam-outline', colors: ['#f43f5e', '#fb7185'], rotate: '-8deg', top: 42, left: 230, size: 112, delay: 140 },
  { icon: 'checkmark-done-outline', colors: ['#10b981', '#34d399'], rotate: '16deg', top: 148, left: 36, size: 124, delay: 200 },
  { icon: 'people-outline', colors: ['#f59e0b', '#f97316'], rotate: '-6deg', top: 156, left: 178, size: 120, delay: 260 },
  { icon: 'flash-outline', colors: ['#6366f1', '#a855f7'], rotate: '8deg', top: 250, left: 96, size: 108, delay: 320 },
];

function FloatingCard({
  card,
  canvasWidth,
}: {
  card: CardSpec;
  canvasWidth: number;
}) {
  const rise = useRef(new Animated.Value(0)).current;
  const scale = canvasWidth / 390;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(rise, {
          toValue: 1,
          duration: 2800 + card.delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(rise, {
          toValue: 0,
          duration: 2800 + card.delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const start = setTimeout(() => loop.start(), card.delay);
    return () => {
      clearTimeout(start);
      loop.stop();
    };
  }, [card.delay, rise]);

  return (
    <Animated.View
      style={[
        styles.cardWrap,
        {
          top: card.top * scale,
          left: card.left * scale,
          width: card.size * scale,
          height: card.size * 1.15 * scale,
          transform: [
            { rotate: card.rotate },
            {
              translateY: rise.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -8],
              }),
            },
          ],
        },
      ]}
    >
      <LinearGradient colors={[...card.colors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.cardSheen} />
        <Ionicons name={card.icon} size={28 * scale} color="rgba(255,255,255,0.92)" />
      </LinearGradient>
    </Animated.View>
  );
}

function InlineChip({ label, tone }: { label: string; tone: string }) {
  return (
    <View style={[styles.inlineChip, { backgroundColor: tone }]}>
      <Text style={styles.inlineChipText}>{label}</Text>
    </View>
  );
}

export function WelcomeScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const canvas = isDark ? '#000000' : '#f4f5f8';
  const primaryBg = isDark ? '#ffffff' : colors.brand;
  const primaryFg = isDark ? '#000000' : '#ffffff';
  const secondaryBg = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(17,18,20,0.06)';
  const secondaryFg = colors.text;

  return (
    <View style={[styles.root, { backgroundColor: canvas, paddingTop: insets.top }]}>
      <LinearGradient
        colors={
          isDark
            ? ['rgba(88,101,242,0.28)', 'transparent', '#000000']
            : ['rgba(88,101,242,0.16)', 'transparent', '#f4f5f8']
        }
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.collage, { height: Math.min(width * 0.92, 360) }]}>
        {CARDS.map((card) => (
          <FloatingCard key={card.icon} card={card} canvasWidth={width} />
        ))}
        <LinearGradient
          colors={[`${canvas}00`, canvas]}
          style={styles.collageFade}
          pointerEvents="none"
        />
      </View>

      <View style={styles.copy}>
        <View style={styles.headlineBlock}>
          <View style={styles.headlineRow}>
            <Text style={[styles.headline, { color: colors.text }]}>Your </Text>
            <InlineChip label="DX" tone={colors.brand} />
            <Text style={[styles.headline, { color: colors.text }]}> world of</Text>
          </View>
          <View style={styles.headlineRow}>
            <Text style={[styles.headline, { color: colors.text }]}>boards, chat & </Text>
            <InlineChip label="✓" tone="#23a559" />
            <Text style={[styles.headline, { color: colors.text }]}> tasks</Text>
          </View>
        </View>
        <Text style={[styles.subhead, { color: colors.textMuted }]}>
          Run projects, message your team and jump on calls — all in DockX.
        </Text>
      </View>

      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign up"
          onPress={() => navigation.navigate('Register')}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: primaryBg },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.buttonLabel, { color: primaryFg }]}>Sign up</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log in"
          onPress={() => navigation.navigate('Login')}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: secondaryBg },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.buttonLabel, { color: secondaryFg }]}>I have an account</Text>
        </Pressable>

        <Text style={[styles.legal, { color: colors.textSubtle }]}>
          By continuing, you accept our Terms, Privacy Policy, and chat guidelines.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  collage: {
    width: '100%',
    marginTop: 8,
    overflow: 'hidden',
  },
  collageFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 90,
  },
  cardWrap: {
    position: 'absolute',
    borderRadius: 26,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  card: {
    flex: 1,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardSheen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  copy: {
    paddingHorizontal: 28,
    marginTop: 4,
    gap: 14,
  },
  headlineBlock: {
    gap: 4,
  },
  headlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  headline: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.9,
    lineHeight: 42,
  },
  inlineChip: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  inlineChipText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  subhead: {
    fontSize: 15,
    lineHeight: 21,
    maxWidth: 340,
  },
  actions: {
    marginTop: 'auto',
    paddingHorizontal: 24,
    gap: 12,
  },
  button: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  legal: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 11.5,
    lineHeight: 16,
    paddingHorizontal: 12,
  },
});
