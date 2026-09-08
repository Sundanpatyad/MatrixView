import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChatLinkPreview } from '@/lib/api';
import { getChatLinkPreview } from '@/lib/api/chat';
import { firstHttpUrl, hostOf } from '@/lib/chat/links';
import { useColors } from '@/theme';

export function LinkPreviewCard({
  preview,
  body,
  mine,
  onBeforeOpen,
}: {
  preview?: ChatLinkPreview | null;
  body: string;
  mine: boolean;
  onBeforeOpen?: () => void;
}) {
  const colors = useColors();
  const url = preview?.url || firstHttpUrl(body);
  const [data, setData] = useState<ChatLinkPreview | null>(preview ?? null);

  useEffect(() => {
    if (preview) {
      setData(preview);
      return;
    }
    if (!url) return;
    let cancelled = false;
    void getChatLinkPreview(url).then((result) => {
      if (!cancelled) setData(result);
    });
    return () => {
      cancelled = true;
    };
  }, [preview, url]);

  if (!url) return null;

  const host = data?.host || hostOf(url);
  const title = data?.title || host;
  const description = data?.description ?? '';
  const imageUrl = data?.imageUrl ?? null;
  const target = data?.url || url;

  return (
    <Pressable
      onPress={() => {
        onBeforeOpen?.();
        void Linking.openURL(target).catch(() => undefined);
      }}
      style={[
        styles.card,
        { backgroundColor: mine ? 'rgba(0,0,0,0.18)' : colors.surfaceAlt },
      ]}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.image} contentFit="cover" />
      ) : null}
      <View style={styles.copy}>
        <Text
          style={[styles.host, { color: mine ? 'rgba(255,255,255,0.62)' : colors.textSubtle }]}
          numberOfLines={1}
        >
          {host}
        </Text>
        <Text style={[styles.title, { color: mine ? '#ffffff' : colors.text }]} numberOfLines={2}>
          {title}
        </Text>
        {description ? (
          <Text
            style={[styles.desc, { color: mine ? 'rgba(255,255,255,0.75)' : colors.textSubtle }]}
            numberOfLines={2}
          >
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: 10,
    marginBottom: 6,
  },
  image: {
    width: '100%',
    height: 128,
  },
  copy: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  host: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  desc: {
    fontSize: 11.5,
    lineHeight: 15,
  },
});

