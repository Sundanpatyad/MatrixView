import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui';
import type { ChatMessage } from '@/lib/api';
import { formatBytes, formatSeconds, formatTime } from '@/lib/format';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { radius, useColors } from '@/theme';

interface MessageBubbleProps {
  message: ChatMessage;
  mine: boolean;
  showSender: boolean;
  onLongPress: () => void;
  onRetry: () => void;
}

function StatusTick({ status, tint }: { status?: string; tint: string }) {
  if (!status) return null;
  if (status === 'read') return <Ionicons name="checkmark-done" size={14} color="#4fc3f7" />;
  if (status === 'delivered') return <Ionicons name="checkmark-done" size={14} color={tint} />;
  return <Ionicons name="checkmark" size={14} color={tint} />;
}

export function MessageBubble({ message, mine, showSender, onLongPress, onRetry }: MessageBubbleProps) {
  const colors = useColors();

  if (message.type === 'call') {
    const outcome = message.call?.outcome ?? 'ended';
    const duration = message.call?.durationSeconds ?? 0;
    return (
      <View style={styles.systemWrap}>
        <View style={[styles.system, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <Ionicons
            name={message.call?.mediaKind === 'video' ? 'videocam-outline' : 'call-outline'}
            size={14}
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
  const bubbleColor = mine ? colors.brand : colors.surface;
  const textColor = mine ? '#ffffff' : colors.text;
  const metaColor = mine ? 'rgba(255,255,255,0.72)' : colors.textSubtle;
  const failed = message.localState === 'failed';
  const sending = message.localState === 'sending';

  const openAttachment = (url: string) => {
    const resolved = resolveMediaUrl(url);
    if (resolved) Linking.openURL(resolved).catch(() => undefined);
  };

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      {!mine ? (
        <View style={styles.avatarSlot}>
          {showSender ? <Avatar name={message.senderName} uri={message.senderAvatarUrl} size={28} /> : null}
        </View>
      ) : null}

      <Pressable
        onLongPress={deleted ? undefined : onLongPress}
        delayLongPress={280}
        style={[
          styles.bubble,
          {
            backgroundColor: bubbleColor,
            borderColor: mine ? 'transparent' : colors.border,
            borderTopLeftRadius: !mine && showSender ? 4 : radius.lg,
            borderTopRightRadius: mine ? 4 : radius.lg,
            opacity: sending ? 0.75 : 1,
          },
        ]}
      >
        {showSender && !mine ? (
          <Text style={[styles.sender, { color: colors.brand }]} numberOfLines={1}>
            {message.senderName}
          </Text>
        ) : null}

        {message.replyTo ? (
          <View
            style={[
              styles.reply,
              {
                backgroundColor: mine ? 'rgba(0,0,0,0.16)' : colors.surfaceAlt,
                borderLeftColor: mine ? 'rgba(255,255,255,0.7)' : colors.brand,
              },
            ]}
          >
            <Text style={[styles.replyName, { color: mine ? 'rgba(255,255,255,0.9)' : colors.brand }]}>
              {message.replyTo.senderName}
            </Text>
            <Text style={[styles.replyBody, { color: metaColor }]} numberOfLines={2}>
              {message.replyTo.deleted ? 'Message deleted' : message.replyTo.body}
            </Text>
          </View>
        ) : null}

        {deleted ? (
          <Text style={[styles.deleted, { color: metaColor }]}>This message was deleted</Text>
        ) : (
          <>
            {message.attachments.map((attachment) =>
              attachment.kind === 'image' ? (
                <Pressable key={attachment.id} onPress={() => openAttachment(attachment.url)}>
                  <Image
                    source={{ uri: resolveMediaUrl(attachment.url) }}
                    style={styles.image}
                    contentFit="cover"
                    transition={150}
                  />
                </Pressable>
              ) : (
                <Pressable
                  key={attachment.id}
                  onPress={() => openAttachment(attachment.url)}
                  style={[
                    styles.file,
                    { backgroundColor: mine ? 'rgba(0,0,0,0.16)' : colors.surfaceAlt },
                  ]}
                >
                  <Ionicons
                    name={
                      attachment.kind === 'video'
                        ? 'videocam-outline'
                        : attachment.kind === 'audio'
                          ? 'musical-notes-outline'
                          : 'document-outline'
                    }
                    size={19}
                    color={mine ? '#ffffff' : colors.textMuted}
                  />
                  <View style={styles.fileText}>
                    <Text style={[styles.fileName, { color: textColor }]} numberOfLines={1}>
                      {attachment.name}
                    </Text>
                    <Text style={[styles.fileSize, { color: metaColor }]}>{formatBytes(attachment.size)}</Text>
                  </View>
                </Pressable>
              ),
            )}

            {message.body ? <Text style={[styles.body, { color: textColor }]}>{message.body}</Text> : null}
          </>
        )}

        <View style={styles.meta}>
          {message.editedAt && !deleted ? (
            <Text style={[styles.edited, { color: metaColor }]}>edited</Text>
          ) : null}
          <Text style={[styles.time, { color: metaColor }]}>{formatTime(message.createdAt)}</Text>
          {mine && !deleted ? (
            sending ? (
              <ActivityIndicator size="small" color={metaColor} style={styles.spinner} />
            ) : failed ? (
              <Pressable onPress={onRetry} hitSlop={8}>
                <Ionicons name="refresh-circle" size={15} color="#ffd9d9" />
              </Pressable>
            ) : (
              <StatusTick status={message.status} tint={metaColor} />
            )
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingHorizontal: 12,
    gap: 7,
  },
  rowMine: {
    justifyContent: 'flex-end',
  },
  rowTheirs: {
    justifyContent: 'flex-start',
  },
  avatarSlot: {
    width: 28,
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 11,
    paddingVertical: 7,
    gap: 5,
  },
  sender: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  reply: {
    borderLeftWidth: 3,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  replyName: {
    fontSize: 12,
    fontWeight: '700',
  },
  replyBody: {
    fontSize: 12.5,
    marginTop: 1,
  },
  body: {
    fontSize: 15,
    lineHeight: 20.5,
  },
  deleted: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  image: {
    width: 230,
    height: 170,
    borderRadius: radius.sm,
  },
  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 9,
    borderRadius: radius.sm,
    minWidth: 190,
  },
  fileText: {
    flex: 1,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '600',
  },
  fileSize: {
    fontSize: 11,
    marginTop: 1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
  },
  edited: {
    fontSize: 10.5,
    fontStyle: 'italic',
  },
  time: {
    fontSize: 10.5,
  },
  spinner: {
    transform: [{ scale: 0.7 }],
  },
  systemWrap: {
    alignItems: 'center',
    marginVertical: 6,
  },
  system: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  systemText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  systemTime: {
    fontSize: 11,
  },
});
