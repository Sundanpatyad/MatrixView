import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

type OrbitNode = {
  icon: keyof typeof Ionicons.glyphMap;
  colors: readonly [string, string];
  /** Angle in degrees, 0 = top */
  angle: number;
  size: number;
  radius: number;
};

const ORBIT: OrbitNode[] = [
  { icon: 'grid-outline', colors: ['#5b4bff', '#8b5cf6'], angle: -95, size: 58, radius: 108 },
  { icon: 'chatbubbles-outline', colors: ['#0ea5e9', '#2563eb'], angle: -35, size: 64, radius: 118 },
  { icon: 'videocam-outline', colors: ['#f43f5e', '#fb7185'], angle: 28, size: 56, radius: 112 },
  { icon: 'checkmark-done-outline', colors: ['#10b981', '#34d399'], angle: 88, size: 60, radius: 116 },
  { icon: 'people-outline', colors: ['#f59e0b', '#f97316'], angle: 148, size: 54, radius: 108 },
  { icon: 'flash-outline', colors: ['#6366f1', '#a855f7'], angle: -155, size: 52, radius: 102 },
];

const GUTTER = 24;
const STAGE = 280;

function OrbitBubble({
  node,
  index,
  spin,
  appear,
}: {
  node: OrbitNode;
  index: number;
  spin: Animated.Value;
  appear: Animated.Value;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2200 + index * 220,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2200 + index * 220,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const start = setTimeout(() => loop.start(), index * 90);
    return () => {
      clearTimeout(start);
      loop.stop();
    };
  }, [index, pulse]);

  const rad = (node.angle * Math.PI) / 180;
  const x = Math.sin(rad) * node.radius;
  const y = -Math.cos(rad) * node.radius;

  return (
    <Animated.View
      style={[
        styles.bubbleWrap,
        {
          width: node.size,
          height: node.size,
          marginLeft: -node.size / 2,
          marginTop: -node.size / 2,
          opacity: appear,
          transform: [
            {
              rotate: spin.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              }),
            },
            { translateX: x },
            { translateY: y },
            {
              rotate: spin.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '-360deg'],
              }),
            },
            {
              scale: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.06],
              }),
            },
          ],
        },
      ]}
    >
      <LinearGradient
        colors={[...node.colors]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bubble}
      >
        <View style={styles.bubbleSheen} />
        <Ionicons name={node.icon} size={node.size * 0.42} color="rgba(255,255,255,0.96)" />
      </LinearGradient>
    </Animated.View>
  );
}

export function WelcomeScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const appear = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const corePulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(appear, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const orbit = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 48000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    orbit.start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(corePulse, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(corePulse, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();

    return () => {
      orbit.stop();
      pulse.stop();
    };
  }, [appear, corePulse, spin]);

  const canvas = isDark ? '#000000' : '#f4f5f8';
  const primaryBg = isDark ? '#ffffff' : colors.brand;
  const primaryFg = isDark ? '#000000' : '#ffffff';
  const secondaryBg = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(17,18,20,0.06)';
  const secondaryBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(17,18,20,0.08)';
  const ringColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,18,20,0.08)';
  const ringColorSoft = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(17,18,20,0.04)';

  return (
    <View style={[styles.root, { backgroundColor: canvas }]}>
      <LinearGradient
        colors={
          isDark
            ? ['rgba(88,101,242,0.38)', 'rgba(88,101,242,0.10)', 'transparent']
            : ['rgba(88,101,242,0.20)', 'rgba(88,101,242,0.06)', 'transparent']
        }
        locations={[0, 0.42, 1]}
        style={styles.ambient}
        pointerEvents="none"
      />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 12,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.stage,
            {
              opacity: appear,
              transform: [
                {
                  scale: appear.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.92, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.ring, styles.ringOuter, { borderColor: ringColorSoft }]} />
          <View style={[styles.ring, styles.ringInner, { borderColor: ringColor }]} />

          <Animated.View
            style={[
              styles.coreGlow,
              {
                opacity: corePulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.35, 0.7],
                }),
                transform: [
                  {
                    scale: corePulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.12],
                    }),
                  },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={['rgba(59,130,246,0.55)', 'rgba(59,130,246,0)']}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <Image
            source={require('../../../assets/icon.png')}
            accessibilityLabel="DockX"
            style={styles.coreLogo}
          />

          {ORBIT.map((node, index) => (
            <OrbitBubble key={node.icon} node={node} index={index} spin={spin} appear={appear} />
          ))}
        </Animated.View>

        <Animated.View
          style={[
            styles.copy,
            {
              opacity: appear,
              transform: [
                {
                  translateY: appear.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={[styles.kicker, { color: colors.brand }]}>DockX</Text>
          <Text style={[styles.headline, { color: colors.text }]}>
            Boards, chat & tasks{'\n'}in one workspace
          </Text>
          <Text style={[styles.subhead, { color: colors.textMuted }]}>
            Run projects, message your team and jump on calls — all in one place.
          </Text>
        </Animated.View>

        <View style={styles.actions}>
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
              {
                backgroundColor: secondaryBg,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: secondaryBorder,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.buttonLabel, { color: colors.text }]}>I have an account</Text>
          </Pressable>

          <Text style={[styles.legal, { color: colors.textSubtle }]}>
            By continuing, you accept our Terms, Privacy Policy, and chat guidelines.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  ambient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  content: {
    flex: 1,
    paddingHorizontal: GUTTER,
  },
  stage: {
    alignSelf: 'center',
    width: STAGE,
    height: STAGE,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
  },
  ringOuter: {
    width: STAGE - 8,
    height: STAGE - 8,
  },
  ringInner: {
    width: STAGE * 0.58,
    height: STAGE * 0.58,
  },
  coreGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
  },
  coreLogo: {
    width: 84,
    height: 84,
    borderRadius: 22,
    shadowColor: '#3b82f6',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  bubbleWrap: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
  bubble: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.32,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
  },
  bubbleSheen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  copy: {
    marginTop: 28,
    alignItems: 'center',
    gap: 10,
  },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  headline: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 38,
    textAlign: 'center',
  },
  subhead: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
  },
  actions: {
    marginTop: 'auto',
    gap: 12,
    paddingTop: 24,
  },
  button: {
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.86,
  },
  legal: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 11.5,
    lineHeight: 16,
    paddingHorizontal: 8,
  },
});
