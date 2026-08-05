import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MessageBubble } from '@/components/chat/MessageBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import {
  AppHeader,
  Avatar,
  EmptyState,
  Screen,
  Sheet,
  useFloatingHeaderHeight,
} from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useCall } from '@/context/CallContext';
import { useChat } from '@/context/ChatContext';
import { useToast } from '@/context/ToastContext';
import type { ChatMessage, PickedFile } from '@/lib/api';
import { formatDayDivider } from '@/lib/format';
import { captureImage, pickDocuments, pickImages } from '@/lib/pickers';
import type { CallMediaKind } from '@/lib/socket/socket';
import type { RootStackParamList } from '@/navigation/types';
import { radius, useColors } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatThread'>;

type Row = { kind: 'message'; message: ChatMessage; showSender: boolean } | { kind: 'divider'; label: string; id: string };

const TYPING_IDLE_MS = 2200;
const JOIN_BANNER_HEIGHT = 42;

export function ChatThreadScreen({ route, navigation }: Props) {
  const { conversationId } = route.params;
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user } = useAuth();
  const {
    conversations,
    presence,
    messagesFor,
    typingIn,
    hasMoreIn,
    isLoadingMessages,
    openConversation,
    closeConversation,
    loadOlderMessages,
    send,
    retry,
    edit,
    remove,
    setTyping,
  } = useChat();
  const { startCall, joinGroupCall, activeRooms, call } = useCall();
  const headerHeight = useFloatingHeaderHeight();

  const conversation = conversations.find((entry) => entry.id === conversationId);
  const messages = messagesFor(conversationId);
  const typingNames = typingIn(conversationId);
  const loading = isLoadingMessages(conversationId);

  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [attachSheet, setAttachSheet] = useState(false);
  const [actionTarget, setActionTarget] = useState<ChatMessage | null>(null);
  const [sending, setSending] = useState(false);

  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    void openConversation(conversationId);
    return () => {
      closeConversation(conversationId);
      if (isTypingRef.current) setTyping(conversationId, false);
    };
  }, [closeConversation, conversationId, openConversation, setTyping]);

  const peer = useMemo(
    () =>
      conversation?.type === 'dm'
        ? conversation.members.find((member) => member.id !== user?.id) ?? conversation.members[0]
        : undefined,
    [conversation, user?.id],
  );

  const title = conversation ? (conversation.type === 'dm' ? peer?.name ?? conversation.name : conversation.name) : '';
  const online = peer ? presence[peer.id]?.online ?? false : false;

  const subtitle = typingNames.length
    ? conversation?.type === 'group'
      ? `${typingNames[0]} is typing…`
      : 'typing…'
    : conversation?.type === 'group'
      ? `${conversation.members.length} members`
      : online
        ? 'Online'
        : 'Offline';

  const activeRoom = activeRooms[conversationId];
  const showJoinBanner = Boolean(activeRoom) && call.phase === 'idle';

  const placeCall = useCallback(
    (mediaKind: CallMediaKind) => {
      if (!conversation) return;
      void startCall({
        conversationId,
        mediaKind,
        isGroup: conversation.type === 'group',
        title: conversation.type === 'dm' ? peer?.name ?? conversation.name : conversation.name,
        peerUserId: conversation.type === 'dm' ? peer?.id : null,
      });
    },
    [conversation, conversationId, peer, startCall],
  );

  // The list renders inverted, so rows go newest-first and dividers sit
  // *after* the last message of each day.
  const rows = useMemo<Row[]>(() => {
    const output: Row[] = [];
    const ordered = messages.slice().reverse();

    ordered.forEach((message, index) => {
      const previous = ordered[index - 1];
      const next = ordered[index + 1];

      const sameSenderAsNewer = previous && previous.senderId === message.senderId;
      output.push({ kind: 'message', message, showSender: !sameSenderAsNewer });

      const currentDay = new Date(message.createdAt).toDateString();
      const nextDay = next ? new Date(next.createdAt).toDateString() : null;
      if (currentDay !== nextDay) {
        output.push({ kind: 'divider', id: `divider-${currentDay}`, label: formatDayDivider(message.createdAt) });
      }
    });

    return output;
  }, [messages]);

  const emitTyping = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      setTyping(conversationId, true);
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTypingRef.current = false;
      setTyping(conversationId, false);
    }, TYPING_IDLE_MS);
  }, [conversationId, setTyping]);

  const stopTyping = useCallback(() => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      setTyping(conversationId, false);
    }
  }, [conversationId, setTyping]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || sending) return;

    if (editing) {
      const target = editing;
      setEditing(null);
      setDraft('');
      try {
        await edit(target.id, body);
      } catch (error) {
        toast.fromError(error, 'Could not edit the message.');
      }
      return;
    }

    setDraft('');
    stopTyping();
    setSending(true);
    try {
      await send(conversationId, { body, replyToId: replyTo?.id });
      setReplyTo(null);
    } catch {
      toast.error('Message failed to send. Tap the arrow on the bubble to retry.');
    } finally {
      setSending(false);
    }
  };

  const sendFiles = async (picker: () => Promise<PickedFile[]>) => {
    setAttachSheet(false);
    try {
      const files = await picker();
      if (!files.length) return;
      await send(conversationId, { body: draft.trim(), files, replyToId: replyTo?.id });
      setDraft('');
      setReplyTo(null);
    } catch (error) {
      toast.fromError(error, 'Could not send the attachment.');
    }
  };

  const confirmDelete = (message: ChatMessage) => {
    Alert.alert('Delete message', 'This removes the message for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove(message.id);
          } catch (error) {
            toast.fromError(error, 'Could not delete the message.');
          }
        },
      },
    ]);
  };

  if (!conversation) {
    return (
      <Screen>
        <AppHeader title="Conversation" showBack />
        <EmptyState
          icon="chatbubble-ellipses-outline"
          title="Conversation unavailable"
          description="You may have been removed, or it no longer exists."
          actionLabel="Go back"
          onAction={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={[]}>
      <AppHeader
        floating
        title={title}
        subtitle={subtitle}
        showBack
        left={
          <Pressable onPress={() => navigation.navigate('ConversationInfo', { conversationId })} hitSlop={8}>
            <Avatar
              name={title}
              uri={conversation.type === 'group' ? conversation.avatarUrl : peer?.avatarUrl}
              size={36}
              square={conversation.type === 'group'}
              online={conversation.type === 'dm' ? online : undefined}
            />
          </Pressable>
        }
        actions={[
          {
            icon: 'call-outline',
            onPress: () => placeCall('audio'),
            accessibilityLabel: 'Start voice call',
          },
          {
            icon: 'videocam-outline',
            onPress: () => placeCall('video'),
            accessibilityLabel: 'Start video call',
          },
          {
            icon: 'information-circle-outline',
            onPress: () => navigation.navigate('ConversationInfo', { conversationId }),
            accessibilityLabel: 'Conversation info',
          },
        ]}
      />

      {showJoinBanner && activeRoom ? (
        <Pressable
          onPress={() =>
            void joinGroupCall({
              conversationId,
              callId: activeRoom.callId,
              mediaKind: activeRoom.mediaKind,
              title: conversation.name,
            })
          }
          style={[
            styles.joinBanner,
            {
              top: headerHeight,
              backgroundColor: colors.successSoft,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Ionicons
            name={activeRoom.mediaKind === 'video' ? 'videocam' : 'call'}
            size={18}
            color={colors.success}
          />
          <Text style={[styles.joinText, { color: colors.text }]} numberOfLines={1}>
            {activeRoom.participantCount > 0
              ? `Call in progress · ${activeRoom.participantCount} joined`
              : 'Call in progress'}
          </Text>
          <View style={[styles.joinAction, { backgroundColor: colors.success }]}>
            <Text style={styles.joinActionText}>Join</Text>
          </View>
        </Pressable>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <FlatList
          data={rows}
          inverted
          keyExtractor={(row) => (row.kind === 'message' ? row.message.id : row.id)}
          // The list is flipped, so its bottom padding is what clears the header.
          contentContainerStyle={[
            styles.list,
            { paddingBottom: headerHeight + (showJoinBanner ? JOIN_BANNER_HEIGHT : 0) + 8 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (hasMoreIn(conversationId)) void loadOlderMessages(conversationId);
          }}
          ListFooterComponent={
            loading ? <ActivityIndicator color={colors.brand} style={styles.loader} /> : null
          }
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.emptyWrap}>
                <EmptyState
                  icon="chatbubble-outline"
                  title="No messages yet"
                  description={`Say hello to ${title}.`}
                />
              </View>
            )
          }
          renderItem={({ item }) => {
            if (item.kind === 'divider') {
              return (
                <View style={styles.dividerWrap}>
                  <View style={[styles.divider, { backgroundColor: colors.surfaceAlt }]}>
                    <Text style={[styles.dividerText, { color: colors.textSubtle }]}>{item.label}</Text>
                  </View>
                </View>
              );
            }

            const mine = item.message.senderId === user?.id;
            return (
              <MessageBubble
                message={item.message}
                mine={mine}
                showSender={conversation.type === 'group' ? item.showSender : false}
                onLongPress={() => setActionTarget(item.message)}
                onRetry={() => void retry(conversationId, item.message.id)}
              />
            );
          }}
        />

        <TypingIndicator names={typingNames} />

        {replyTo || editing ? (
          <View style={[styles.contextBar, { backgroundColor: colors.surfaceAlt, borderTopColor: colors.border }]}>
            <View style={[styles.contextAccent, { backgroundColor: colors.brand }]} />
            <View style={styles.flex}>
              <Text style={[styles.contextTitle, { color: colors.brand }]}>
                {editing ? 'Editing message' : `Replying to ${replyTo?.senderName}`}
              </Text>
              <Text style={[styles.contextBody, { color: colors.textSubtle }]} numberOfLines={1}>
                {editing ? editing.body : replyTo?.body || 'Attachment'}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setReplyTo(null);
                if (editing) setDraft('');
                setEditing(null);
              }}
              hitSlop={10}
            >
              <Ionicons name="close" size={19} color={colors.textSubtle} />
            </Pressable>
          </View>
        ) : null}

        <View
          style={[
            styles.composer,
            {
              backgroundColor: colors.bgElevated,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <Pressable onPress={() => setAttachSheet(true)} hitSlop={8} style={styles.composerIcon}>
            <Ionicons name="add-circle-outline" size={25} color={colors.textSubtle} />
          </Pressable>

          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
            placeholder="Message"
            placeholderTextColor={colors.textSubtle}
            value={draft}
            onChangeText={(value) => {
              setDraft(value);
              if (value) emitTyping();
              else stopTyping();
            }}
            onBlur={stopTyping}
            multiline
          />

          <Pressable
            onPress={handleSend}
            disabled={!draft.trim()}
            style={[styles.send, { backgroundColor: draft.trim() ? colors.brand : colors.surfaceHover }]}
            accessibilityLabel="Send message"
          >
            <Ionicons
              name={editing ? 'checkmark' : 'arrow-up'}
              size={20}
              color={draft.trim() ? '#ffffff' : colors.textSubtle}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Sheet visible={attachSheet} onClose={() => setAttachSheet(false)} title="Attach">
        <View style={styles.attachGrid}>
          <AttachTile icon="images-outline" label="Photos & videos" onPress={() => sendFiles(pickImages)} />
          <AttachTile icon="camera-outline" label="Camera" onPress={() => sendFiles(captureImage)} />
          <AttachTile icon="document-outline" label="Document" onPress={() => sendFiles(pickDocuments)} />
        </View>
      </Sheet>

      <Sheet
        visible={Boolean(actionTarget)}
        onClose={() => setActionTarget(null)}
        title="Message"
        subtitle={actionTarget?.body || 'Attachment'}
      >
        <View style={styles.actionList}>
          <ActionRow
            icon="arrow-undo-outline"
            label="Reply"
            onPress={() => {
              setReplyTo(actionTarget);
              setActionTarget(null);
            }}
          />
          {actionTarget?.senderId === user?.id ? (
            <>
              <ActionRow
                icon="create-outline"
                label="Edit"
                onPress={() => {
                  setEditing(actionTarget);
                  setDraft(actionTarget?.body ?? '');
                  setActionTarget(null);
                }}
              />
              <ActionRow
                icon="trash-outline"
                label="Delete"
                destructive
                onPress={() => {
                  const target = actionTarget;
                  setActionTarget(null);
                  if (target) confirmDelete(target);
                }}
              />
            </>
          ) : null}
        </View>
      </Sheet>
    </Screen>
  );
}

function AttachTile({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.attachTile,
        { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={[styles.attachIcon, { backgroundColor: colors.brandSoft }]}>
        <Ionicons name={icon} size={22} color={colors.brand} />
      </View>
      <Text style={[styles.attachLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  destructive = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const colors = useColors();
  const tint = destructive ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Ionicons name={icon} size={19} color={tint} />
      <Text style={[styles.actionLabel, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: {
    paddingVertical: 12,
    flexGrow: 1,
  },
  emptyWrap: {
    flex: 1,
    transform: [{ scaleY: -1 }],
  },
  loader: {
    marginVertical: 16,
  },
  dividerWrap: {
    alignItems: 'center',
    marginVertical: 10,
  },
  divider: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  dividerText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  joinBanner: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
    height: JOIN_BANNER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  joinText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
  },
  joinAction: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  joinActionText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
  },
  contextBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  contextAccent: {
    width: 3,
    height: 30,
    borderRadius: 2,
  },
  contextTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  contextBody: {
    fontSize: 12.5,
    marginTop: 1,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composerIcon: {
    paddingBottom: 9,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 130,
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  attachTile: {
    flex: 1,
    alignItems: 'center',
    gap: 9,
    paddingVertical: 18,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  attachIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionList: {
    gap: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});
