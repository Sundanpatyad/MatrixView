import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCall } from '@/context/CallContext';
import { formatSeconds, initialsOf } from '@/lib/format';
import type { CallParticipant, CallState } from '@/lib/webrtc/callSession';
import { getWebRTC, type RTCMediaStream } from '@/lib/webrtc/webrtcModule';
import { radius, spacing, useTheme } from '@/theme';

import { GlassSurface } from '../ui/GlassSurface';

function statusLabel(call: CallState, elapsed: number): string {
  switch (call.phase) {
    case 'incoming':
      return call.mediaKind === 'video' ? 'Incoming video call' : 'Incoming call';
    case 'outgoing':
      return 'Ringing…';
    case 'connecting':
      return 'Connecting…';
    case 'connected':
      return formatSeconds(elapsed);
    default:
      return '';
  }
}

function VideoTile({
  stream,
  label,
  muted,
  mirror,
  style,
}: {
  stream: RTCMediaStream | null;
  label: string;
  muted?: boolean;
  mirror?: boolean;
  style?: object;
}) {
  const { colors } = useTheme();
  const RTCView = getWebRTC()?.RTCView;
  const hasVideo = Boolean(stream && !muted && RTCView);

  return (
    <View style={[styles.tile, { backgroundColor: colors.surfaceSunken }, style]}>
      {hasVideo && RTCView ? (
        <RTCView
          streamURL={stream!.toURL()}
          objectFit="cover"
          mirror={mirror}
          style={styles.tileVideo}
        />
      ) : (
        <View style={styles.tilePlaceholder}>
          <View style={[styles.tileAvatar, { backgroundColor: colors.brandSoft }]}>
            <Text style={[styles.tileInitials, { color: colors.brand }]}>{initialsOf(label)}</Text>
          </View>
        </View>
      )}
      <View style={styles.tileLabel}>
        <Text style={styles.tileLabelText} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function ControlButton({
  icon,
  label,
  onPress,
  active,
  danger,
  rotate,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
  danger?: boolean;
  /** Ionicons has no hang-up glyph, so the handset is turned down instead. */
  rotate?: boolean;
}) {
  const { colors } = useTheme();

  const background = danger ? colors.danger : active ? colors.text : colors.glassHighlight;
  const tint = danger ? '#ffffff' : active ? colors.bg : colors.text;

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={({ pressed }) => [styles.control, { backgroundColor: background }, pressed && styles.pressed]}
    >
      <Ionicons
        name={icon}
        size={24}
        color={tint}
        style={rotate ? { transform: [{ rotate: '135deg' }] } : undefined}
      />
    </Pressable>
  );
}

export function CallOverlay() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { call, acceptCall, rejectCall, hangup, toggleMute, toggleCamera, switchCamera } = useCall();

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (call.phase !== 'connected' || !call.connectedAt) {
      setElapsed(0);
      return undefined;
    }
    const started = call.connectedAt;
    const tick = () => setElapsed(Math.floor((Date.now() - started) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [call.phase, call.connectedAt]);

  const isVideo = call.mediaKind === 'video';
  const remotes = useMemo<CallParticipant[]>(
    () => call.participants.filter((peer) => peer.stream),
    [call.participants],
  );

  if (call.phase === 'idle') return null;

  const ringing = call.phase === 'incoming';
  const columns = remotes.length > 1 ? 2 : 1;

  return (
    <Modal visible transparent={false} animationType="slide" statusBarTranslucent onRequestClose={hangup}>
      <View style={[styles.root, { backgroundColor: isDark ? '#08090b' : colors.bg }]}>
        {isVideo && remotes.length ? (
          <ScrollView
            contentContainerStyle={[
              styles.grid,
              { paddingTop: insets.top + spacing.lg, paddingBottom: 220 },
            ]}
          >
            {remotes.map((peer) => (
              <VideoTile
                key={peer.userId}
                stream={peer.stream}
                label={peer.name}
                style={columns === 1 ? styles.tileFull : styles.tileHalf}
              />
            ))}
          </ScrollView>
        ) : (
          <LinearGradient
            colors={isDark ? ['#1b1d2a', '#08090b'] : ['#e8eaf6', '#f4f5f8']}
            style={styles.hero}
          >
            <View style={[styles.heroAvatar, { backgroundColor: colors.brandSoft }]}>
              <Text style={[styles.heroInitials, { color: colors.brand }]}>{initialsOf(call.title)}</Text>
            </View>
            <Text style={[styles.heroTitle, { color: colors.text }]} numberOfLines={1}>
              {call.title}
            </Text>
            <Text style={[styles.heroStatus, { color: colors.textMuted }]}>
              {statusLabel(call, elapsed)}
            </Text>
            {call.isGroup && call.participants.length ? (
              <Text style={[styles.heroPeers, { color: colors.textSubtle }]}>
                {call.participants.length + 1} on the call
              </Text>
            ) : null}
          </LinearGradient>
        )}

        {/* Self-view floats above the remote feed once video is flowing. */}
        {isVideo && remotes.length && call.localStream ? (
          <View style={[styles.selfView, { top: insets.top + spacing.lg }]}>
            <VideoTile
              stream={call.localStream}
              label="You"
              muted={call.cameraOff}
              mirror
              style={styles.selfViewTile}
            />
          </View>
        ) : null}

        {isVideo && remotes.length ? (
          <GlassSurface edge="bottom" style={[styles.videoHeader, { paddingTop: insets.top }]}>
            <View style={styles.videoHeaderRow}>
              <Text style={[styles.videoTitle, { color: colors.text }]} numberOfLines={1}>
                {call.title}
              </Text>
              <Text style={[styles.videoStatus, { color: colors.textMuted }]}>
                {statusLabel(call, elapsed)}
              </Text>
            </View>
          </GlassSurface>
        ) : null}

        <GlassSurface
          edge="top"
          style={[styles.dock, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
        >
          {ringing ? (
            <View style={styles.dockRow}>
              <View style={styles.answerGroup}>
                <ControlButton icon="call" label="Decline call" onPress={rejectCall} danger rotate />
                <Text style={[styles.answerLabel, { color: colors.textSubtle }]}>Decline</Text>
              </View>
              <View style={styles.answerGroup}>
                <Pressable
                  onPress={acceptCall}
                  accessibilityLabel="Accept call"
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.control,
                    styles.accept,
                    { backgroundColor: colors.success },
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name={isVideo ? 'videocam' : 'call'} size={26} color="#ffffff" />
                </Pressable>
                <Text style={[styles.answerLabel, { color: colors.textSubtle }]}>Accept</Text>
              </View>
            </View>
          ) : (
            <View style={styles.dockRow}>
              <ControlButton
                icon={call.muted ? 'mic-off' : 'mic'}
                label={call.muted ? 'Unmute' : 'Mute'}
                onPress={toggleMute}
                active={call.muted}
              />
              {isVideo ? (
                <ControlButton
                  icon={call.cameraOff ? 'videocam-off' : 'videocam'}
                  label={call.cameraOff ? 'Turn camera on' : 'Turn camera off'}
                  onPress={toggleCamera}
                  active={call.cameraOff}
                />
              ) : null}
              {isVideo ? (
                <ControlButton icon="camera-reverse" label="Switch camera" onPress={switchCamera} />
              ) : null}
              <ControlButton icon="call" label="End call" onPress={hangup} danger rotate />
            </View>
          )}
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  heroAvatar: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heroInitials: {
    fontSize: 46,
    fontWeight: '700',
  },
  heroTitle: {
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  heroStatus: {
    fontSize: 16,
  },
  heroPeers: {
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  tile: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  tileFull: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  tileHalf: {
    width: '48.5%',
    aspectRatio: 3 / 4,
  },
  tileVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  tilePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileInitials: {
    fontSize: 26,
    fontWeight: '700',
  },
  tileLabel: {
    margin: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  tileLabelText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  selfView: {
    position: 'absolute',
    right: spacing.lg,
    width: 104,
    height: 152,
  },
  selfViewTile: {
    width: '100%',
    height: '100%',
  },
  videoHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  videoHeaderRow: {
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  videoTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  videoStatus: {
    fontSize: 12,
  },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.xl,
  },
  dockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  control: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accept: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  pressed: {
    opacity: 0.75,
  },
  answerGroup: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  answerLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
