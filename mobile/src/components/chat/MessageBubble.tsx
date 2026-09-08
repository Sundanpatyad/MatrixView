import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui';
import type { ChatAttachment, ChatMessage } from '@/lib/api';
import { openAttachment } from '@/lib/attachments';
import { formatBytes, formatSeconds, formatTime } from '@/lib/format';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { useColors, useTheme } from '@/theme';

import { MediaCarousel, mediaItemsOf, type MediaCarouselItem } from './MediaCarousel';
import { LinkifiedText } from './LinkifiedText';
import { LinkPreviewCard } from './LinkPreviewCard';

const DOCUMENT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  audio: 'musical-notes-outline',
  document: 'document-text-outline',
  other: 'attach-outline',
};

const STACK_SIZE = 188;
/** Fan “petals” behind the top card — flower / 3D deck. */
const PETALS = [
  { rotate: '-18deg', x: -22, y: 10, scale: 0.9, opacity: 0.78 },
  { rotate: '16deg', x: 18, y: 12, scale: 0.88, opacity: 0.7 },
  { rotate: '-7deg', x: -6, y: 20, scale: 0.86, opacity: 0.58 },
] as const;

function documentLabel(attachment: ChatAttachment): string {
  const extension = attachment.name.split('.').pop();
  if (extension && extension.length <= 4 && extension !== attachment.name) {
    return `${extension.toUpperCase()} · ${formatBytes(attachment.size)}`;
  }
  return formatBytes(attachment.size);
}

interface MessageBubbleProps {
  message: ChatMessage;
  mine: boolean;
  showSender: boolean;
  showName?: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onRetry: () => void;
}

function StatusTick({ status, tint }: { status?: string; tint: string }) {
  if (!status) return null;
  if (status === 'read') return <Ionicons name="checkmark-done" size={13} color="#7dd3fc" />;
  if (status === 'delivered') return <Ionicons name="checkmark-done" size={13} color={tint} />;
  return <Ionicons name="checkmark" size={13} color={tint} />;
}

function MediaThumb({ attachment, style }: { attachment: ChatAttachment; style?: object }) {
  const uri = resolveMediaUrl(attachment.url);
  if (attachment.kind === 'video') {
    return (
      <View style={[styles.stackImage, styles.videoThumb, style]}>
        {uri ? (
          <Image source={{ uri }} style={styles.stackImageFill} contentFit="cover" />
        ) : null}
        <View style={styles.videoScrim} />
        <View style={styles.playBadge}>
          <Ionicons name="play" size={18} color="#ffffff" />
        </View>
      </View>
    );
  }
  if (!uri) return <View style={[styles.stackImage, styles.videoThumb, style]} />;
  return <Image source={{ uri }} style={[styles.stackImage, style]} contentFit="cover" transition={120} />;
}

function MediaStack({
  media,
  onOpen,
}: {
  media: ChatAttachment[];
  onOpen: (index: number) => void;
}) {
  const top = media[0];
  if (!top) return null;

  const petalCount = media.length === 1 ? 0 : Math.min(PETALS.length, media.length - 1);
  // Draw back petals first so the top card sits above them.
  const petalOrder = Array.from({ length: petalCount }, (_, i) => petalCount - 1 - i);

  return (
    <Pressable
      onPress={(event) => {
        event.stopPropagation?.();
        onOpen(0);
      }}
      style={[styles.stackWrap, media.length === 1 ? styles.stackWrapSingle : null]}
      accessibilityLabel={media.length > 1 ? 'View media carousel' : 'View media'}
    >
      {petalOrder.map((petalIndex) => {
        const petal = PETALS[petalIndex];
        const layer = media[petalIndex + 1] ?? top;
        return (
          <View
            key={`petal-${petalIndex}`}
            pointerEvents="none"
            style={[
              styles.stackPetalOuter,
              styles.stackPetalShadow,
              {
                opacity: petal.opacity,
                zIndex: petalIndex + 1,
                transform: [
                  { translateX: petal.x },
                  { translateY: petal.y },
                  { rotate: petal.rotate },
                  { scale: petal.scale },
                ],
              },
            ]}
          >
            <View style={styles.stackLayer}>
              <MediaThumb attachment={layer} />
            </View>
          </View>
        );
      })}

      <View style={[styles.stackTopOuter, styles.stackTopShadow, { zIndex: petalCount + 2 }]}>
        <View style={styles.stackTop}>
          <MediaThumb attachment={top} />
          {media.length > 1 ? (
            <View style={styles.stackBadge}>
              <Text style={styles.stackBadgeText}>+{media.length}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function DocumentRow({
  attachment,
  mine,
  textColor,
  metaColor,
}: {
  attachment: ChatAttachment;
  mine: boolean;
  textColor: string;
  metaColor: string;
}) {
  const colors = useColors();
  const [busy, setBusy] = useState(false);

  const handlePress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await openAttachment(attachment);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${attachment.name}`}
      style={({ pressed }) => [
        styles.file,
        { backgroundColor: mine ? 'rgba(255,255,255,0.14)' : colors.surfaceAlt },
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={[styles.fileIcon, { backgroundColor: mine ? 'rgba(255,255,255,0.16)' : colors.bg }]}>
        <Ionicons
          name={DOCUMENT_ICONS[attachment.kind] ?? 'attach-outline'}
          size={17}
          color={mine ? '#ffffff' : colors.textMuted}
        />
      </View>
      <View style={styles.fileText}>
        <Text style={[styles.fileName, { color: textColor }]} numberOfLines={1}>
          {attachment.name}
        </Text>
        <Text style={[styles.fileSize, { color: metaColor }]}>{documentLabel(attachment)}</Text>
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={metaColor} />
      ) : (
        <Ionicons name="download-outline" size={15} color={metaColor} />
      )}
    </Pressable>
  );
}

export function MessageBubble({
  message,
  mine,
  showSender,
  showName = false,
  onPress,
  onLongPress,
  onRetry,
}: MessageBubbleProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const [carousel, setCarousel] = useState<{ items: MediaCarouselItem[]; index: number } | null>(null);
  const suppressMessagePress = useRef(false);

  const media = useMemo(
    () =>
      !message.deletedAt
        ? message.attachments.filter((item) => item.kind === 'image' || item.kind === 'video')
        : [],
    [message.attachments, message.deletedAt],
  );
  const otherFiles = useMemo(
    () =>
      !message.deletedAt
        ? message.attachments.filter((item) => item.kind !== 'image' && item.kind !== 'video')
        : [],
    [message.attachments, message.deletedAt],
  );

  if (message.type === 'call') {
    const outcome = message.call?.outcome ?? 'ended';
    const duration = message.call?.durationSeconds ?? 0;
    return (
      <View style={styles.systemWrap}>
        <View style={[styles.system, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}>
          <Ionicons
            name={message.call?.mediaKind === 'video' ? 'videocam' : 'call'}
            size={12}
            color={outcome === 'answered' ? colors.success : colors.danger}
          />
          <Text style={[styles.systemText, { color: colors.textMuted }]}>
            {outcome === 'answered' ? `Call · ${formatSeconds(duration)}` : `Call ${outcome}`}
          </Text>
          <Text style={[styles.systemTime, { color: colors.textSubtle }]}>{formatTime(message.createdAt)}</Text>
        </View>
      </View>
    );
  }

  const deleted = Boolean(message.deletedAt);
  const theirsBg = isDark ? '#2a2b30' : '#f0f1f4';
  const textColor = mine ? '#ffffff' : colors.text;
  const metaColor = mine ? 'rgba(255,255,255,0.62)' : colors.textSubtle;
  const failed = message.localState === 'failed';
  const sending = message.localState === 'sending';
  const mediaOnly = !deleted && !message.body && media.length > 0 && otherFiles.length === 0 && !message.replyTo && !message.forwarded;
  const forwarded = Boolean(message.forwarded) && !deleted;
  const textOnly =
    !deleted &&
    Boolean(message.body) &&
    media.length === 0 &&
    otherFiles.length === 0 &&
    !message.replyTo &&
    !forwarded;

  const openCarousel = (index: number) => {
    const items = mediaItemsOf(media);
    if (!items.length) return;
    suppressMessagePress.current = true;
    setCarousel({ items, index });
  };

  const handleMessagePress = () => {
    if (suppressMessagePress.current) {
      suppressMessagePress.current = false;
      return;
    }
    onPress();
  };

  const metaTint = mediaOnly ? 'rgba(255,255,255,0.95)' : metaColor;

  const metaRow = (
    <View style={[styles.meta, mediaOnly ? styles.metaOverMedia : null, textOnly ? styles.metaInline : null]}>
      {message.editedAt && !deleted ? (
        <Text style={[styles.edited, { color: metaTint }]}>edited</Text>
      ) : null}
      <Text style={[styles.time, { color: metaTint }]}>{formatTime(message.createdAt)}</Text>
      {mine && !deleted ? (
        sending ? (
          <ActivityIndicator size="small" color={metaTint} style={styles.spinner} />
        ) : failed ? (
          <Pressable onPress={onRetry} hitSlop={8}>
            <Ionicons name="refresh" size={12} color={mediaOnly ? '#ffb4b4' : colors.danger} />
          </Pressable>
        ) : (
          <StatusTick status={message.status} tint={metaTint} />
        )
      ) : null}
    </View>
  );

  const bubbleInner = (
    <>
      {forwarded ? (
        <View style={styles.forwardedRow}>
          <Ionicons name="arrow-redo" size={10} color={metaColor} />
          <Text style={[styles.forwarded, { color: metaColor }]}>Forwarded</Text>
        </View>
      ) : null}

      {message.replyTo ? (
        <View
          style={[
            styles.reply,
            {
              backgroundColor: mine ? 'rgba(0,0,0,0.18)' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              borderLeftColor: mine ? 'rgba(255,255,255,0.7)' : colors.brand,
            },
          ]}
        >
          <Text style={[styles.replyName, { color: mine ? '#ffffff' : colors.brand }]} numberOfLines={1}>
            {message.replyTo.senderName}
          </Text>
          <Text style={[styles.replyBody, { color: metaColor }]} numberOfLines={2}>
            {message.replyTo.deleted ? 'Message deleted' : message.replyTo.body || 'Attachment'}
          </Text>
        </View>
      ) : null}

      {deleted ? (
        <View style={styles.contentRow}>
          <View style={styles.deletedRow}>
            <Ionicons name="ban-outline" size={12} color={metaColor} />
            <Text style={[styles.deleted, { color: metaColor }]}>This message was deleted</Text>
          </View>
          {metaRow}
        </View>
      ) : textOnly ? (
        <View>
          <LinkPreviewCard
            preview={message.linkPreview}
            body={message.body}
            mine={mine}
            onBeforeOpen={() => {
              suppressMessagePress.current = true;
            }}
          />
          <View style={styles.contentRow}>
            <LinkifiedText
              text={message.body}
              style={[styles.body, { color: textColor }]}
              linkStyle={{ color: mine ? '#dbeafe' : colors.brand }}
            />
            {metaRow}
          </View>
        </View>
      ) : (
        <>
          {media.length > 0 ? <MediaStack media={media} onOpen={openCarousel} /> : null}

          {otherFiles.map((attachment) => (
            <DocumentRow
              key={attachment.id}
              attachment={attachment}
              mine={mine}
              textColor={textColor}
              metaColor={metaColor}
            />
          ))}

          {message.body ? (
            <>
              <LinkPreviewCard
                preview={message.linkPreview}
                body={message.body}
                mine={mine}
                onBeforeOpen={() => {
                  suppressMessagePress.current = true;
                }}
              />
              <LinkifiedText
                text={message.body}
                style={[styles.body, { color: textColor }]}
                linkStyle={{ color: mine ? '#dbeafe' : colors.brand }}
              />
            </>
          ) : null}
          {!mediaOnly ? metaRow : null}
        </>
      )}
    </>
  );

  return (
    <>
      <View
        style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}
      >
        {!mine ? (
          <View style={[styles.avatarSlot, showName ? styles.avatarSlotNamed : null]}>
            {showSender ? <Avatar name={message.senderName} uri={message.senderAvatarUrl} size={28} userId={message.senderId} /> : null}
          </View>
        ) : null}

        <View style={styles.column}>
          {mediaOnly ? (
            <Pressable
              onPress={handleMessagePress}
              onLongPress={onLongPress}
              delayLongPress={220}
              style={({ pressed }) => [
                styles.mediaOnlyWrap,
                { opacity: sending ? 0.78 : pressed ? 0.92 : 1 },
              ]}
            >
              <MediaStack media={media} onOpen={openCarousel} />
              {metaRow}
            </Pressable>
          ) : (
            <Pressable
              onPress={deleted ? undefined : handleMessagePress}
              onLongPress={deleted ? undefined : onLongPress}
              delayLongPress={220}
              style={({ pressed }) => [{ opacity: sending ? 0.78 : pressed && !deleted ? 0.92 : 1 }]}
            >
              {mine ? (
                <LinearGradient
                  colors={['#7c6cf0', '#5865f2', '#4a3fd6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.bubble, styles.bubbleMine, styles.bubblePadded]}
                >
                  {bubbleInner}
                </LinearGradient>
              ) : (
                <View
                  style={[
                    styles.bubble,
                    styles.bubbleTheirs,
                    styles.bubblePadded,
                    { backgroundColor: theirsBg },
                  ]}
                >
                  {bubbleInner}
                </View>
              )}
            </Pressable>
          )}

          {showName && !mine ? (
            <Text style={[styles.senderBelow, { color: colors.textSubtle }]} numberOfLines={1}>
              {message.senderName}
            </Text>
          ) : null}
        </View>
      </View>

      <MediaCarousel
        visible={Boolean(carousel)}
        items={carousel?.items ?? []}
        initialIndex={carousel?.index ?? 0}
        onClose={() => setCarousel(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    alignItems: 'flex-end',
    gap: 7,
    // Even rhythm between text bubbles and media stacks (list is inverted).
    marginVertical: 5,
  },
  rowMine: {
    justifyContent: 'flex-end',
  },
  rowTheirs: {
    justifyContent: 'flex-start',
  },
  avatarSlot: {
    width: 28,
    height: 28,
    marginBottom: 1,
  },
  avatarSlotNamed: {
    marginBottom: 14,
  },
  column: {
    maxWidth: '78%',
  },
  bubble: {
    minWidth: 52,
    gap: 3,
  },
  bubbleMine: {
    borderRadius: 18,
    borderBottomRightRadius: 6,
  },
  bubbleTheirs: {
    borderRadius: 18,
    borderBottomLeftRadius: 6,
  },
  bubblePadded: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  contentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    columnGap: 6,
    rowGap: 0,
  },
  senderBelow: {
    fontSize: 11,
    marginTop: 3,
    marginLeft: 10,
    fontWeight: '500',
  },
  forwardedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  forwarded: {
    fontSize: 10.5,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  reply: {
    borderLeftWidth: 2.5,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  replyName: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  replyBody: {
    fontSize: 11.5,
    marginTop: 1,
    lineHeight: 15,
  },
  body: {
    fontSize: 15,
    lineHeight: 19,
    letterSpacing: 0.1,
    fontWeight: '400',
    flexShrink: 1,
  },
  deletedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  deleted: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  stackWrap: {
    width: STACK_SIZE + 48,
    height: STACK_SIZE + 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackWrapSingle: {
    width: STACK_SIZE,
    height: STACK_SIZE,
  },
  mediaOnlyWrap: {
    position: 'relative',
  },
  stackPetalOuter: {
    position: 'absolute',
    width: STACK_SIZE,
    height: STACK_SIZE,
  },
  stackLayer: {
    width: STACK_SIZE,
    height: STACK_SIZE,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#1c1d22',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  stackPetalShadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.38,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 7,
  },
  stackTopOuter: {
    width: STACK_SIZE,
    height: STACK_SIZE,
    transform: [{ translateY: -5 }, { scale: 1.03 }],
  },
  stackTop: {
    width: STACK_SIZE,
    height: STACK_SIZE,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#1c1d22',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  stackTopShadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  stackImage: {
    width: '100%',
    height: '100%',
  },
  stackImageFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  videoThumb: {
    backgroundColor: '#1a1b20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  playBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  stackBadge: {
    position: 'absolute',
    right: 8,
    top: 8,
    minWidth: 32,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  stackBadgeText: {
    color: '#111214',
    fontSize: 12,
    fontWeight: '700',
  },
  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 7,
    borderRadius: 12,
    minWidth: 170,
  },
  fileIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileText: {
    flex: 1,
  },
  fileName: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  fileSize: {
    fontSize: 10,
    marginTop: 1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    alignSelf: 'flex-end',
    marginTop: 1,
  },
  metaInline: {
    marginTop: 0,
    marginBottom: 1,
    marginLeft: 'auto',
  },
  metaOverMedia: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 5,
  },
  edited: {
    fontSize: 9.5,
    fontStyle: 'italic',
  },
  time: {
    fontSize: 10,
    fontWeight: '500',
  },
  spinner: {
    transform: [{ scale: 0.5 }],
  },
  systemWrap: {
    alignItems: 'center',
    marginVertical: 8,
  },
  system: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  systemText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  systemTime: {
    fontSize: 10,
  },
});
