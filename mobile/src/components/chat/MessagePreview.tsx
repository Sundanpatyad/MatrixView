import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

export type MessagePreviewKind = 'photo' | 'video' | 'file' | 'forwarded' | 'text';

/** Normalize stored previews (including older emoji-prefixed ones) for display. */
export function parseMessagePreview(raw: string | null | undefined): {
  kind: MessagePreviewKind;
  label: string;
} {
  const text = (raw ?? '').trim();
  if (!text) return { kind: 'text', label: '' };

  const withoutEmoji = text
    .replace(/^[\u{1F4F7}\u{1F4F8}\u{1F3AC}\u{1F4F9}\u{1F4CE}\u{21AA}\u{2197}\s]+/u, '')
    .replace(/^(📷|📸|🎬|🎥|📎|↪)\s*/u, '')
    .trim();

  if (/^forwarded:\s*/i.test(withoutEmoji) || text.startsWith('↪')) {
    const label = withoutEmoji.replace(/^forwarded:\s*/i, '').trim() || 'Forwarded message';
    const nested = parseMessagePreview(label);
    if (nested.kind !== 'text' && nested.kind !== 'forwarded') {
      return { kind: nested.kind, label: nested.label };
    }
    return { kind: 'forwarded', label };
  }

  if (/^(photo|image)$/i.test(withoutEmoji) || /^(📷|📸)\s*photo$/iu.test(text)) {
    return { kind: 'photo', label: 'Photo' };
  }
  if (/^video$/i.test(withoutEmoji) || /^(🎬|🎥)\s*video$/iu.test(text)) {
    return { kind: 'video', label: 'Video' };
  }
  if (/^attachment:\s*/i.test(withoutEmoji) || text.startsWith('📎')) {
    return {
      kind: 'file',
      label: withoutEmoji.replace(/^attachment:\s*/i, '').trim() || 'Attachment',
    };
  }

  return { kind: 'text', label: withoutEmoji || text };
}

function iconFor(kind: MessagePreviewKind): keyof typeof Ionicons.glyphMap | null {
  switch (kind) {
    case 'photo':
      return 'image-outline';
    case 'video':
      return 'videocam-outline';
    case 'file':
      return 'document-outline';
    case 'forwarded':
      return 'arrow-redo-outline';
    default:
      return null;
  }
}

interface MessagePreviewProps {
  text: string | null | undefined;
  color: string;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  iconSize?: number;
}

/** Renders chat/notification previews with vector icons instead of emoji. */
export function MessagePreview({
  text,
  color,
  numberOfLines = 1,
  style,
  iconSize = 14,
}: MessagePreviewProps) {
  const { kind, label } = parseMessagePreview(text);
  if (!label) return null;

  const icon = iconFor(kind);

  return (
    <View style={styles.row}>
      {icon ? <Ionicons name={icon} size={iconSize} color={color} style={styles.icon} /> : null}
      <Text style={[styles.label, { color }, style]} numberOfLines={numberOfLines}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  icon: {
    marginTop: 1,
  },
  label: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
  },
});
