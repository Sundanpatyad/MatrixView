import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resolveMediaUrl } from '@/lib/mediaUrl';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export type MediaCarouselItem = {
  url: string;
  kind: 'image' | 'video';
};

interface MediaCarouselProps {
  items: MediaCarouselItem[];
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
}

function VideoPage({ uri }: { uri: string }) {
  const [opening, setOpening] = useState(false);

  const openVideo = async () => {
    if (opening) return;
    setOpening(true);
    try {
      await Linking.openURL(uri);
    } finally {
      setOpening(false);
    }
  };

  return (
    <Pressable style={styles.page} onPress={openVideo} accessibilityLabel="Play video">
      <Image source={{ uri }} style={styles.media} contentFit="contain" />
      <View style={styles.videoOverlay} pointerEvents="none">
        <View style={styles.playCircle}>
          {opening ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Ionicons name="play" size={28} color="#ffffff" style={{ marginLeft: 3 }} />
          )}
        </View>
        <Text style={styles.playHint}>Tap to play video</Text>
      </View>
    </Pressable>
  );
}

export function MediaCarousel({ items, initialIndex = 0, visible, onClose }: MediaCarouselProps) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<MediaCarouselItem>>(null);
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (!visible) return;
    setIndex(initialIndex);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: initialIndex, animated: false });
    });
  }, [visible, initialIndex]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const next = viewableItems[0]?.index;
    if (typeof next === 'number') setIndex(next);
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  if (!visible || !items.length) return null;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <FlatList
          ref={listRef}
          data={items}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, i) => `${item.kind}-${item.url}-${i}`}
          initialScrollIndex={Math.min(initialIndex, items.length - 1)}
          getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
          onScrollToIndexFailed={({ index: failed }) => {
            listRef.current?.scrollToOffset({ offset: failed * SCREEN_W, animated: false });
          }}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item }) =>
            item.kind === 'video' ? (
              <VideoPage uri={item.url} />
            ) : (
              <View style={styles.page}>
                <Image source={{ uri: item.url }} style={styles.media} contentFit="contain" transition={120} />
              </View>
            )
          }
        />

        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <Text style={styles.counter}>
            {index + 1} / {items.length}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.close} accessibilityLabel="Close">
            <Ionicons name="close" size={22} color="#ffffff" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Resolve chat image/video attachments into carousel items. */
export function mediaItemsOf(
  attachments: Array<{ url?: string | null; kind?: string }>,
): MediaCarouselItem[] {
  const items: MediaCarouselItem[] = [];
  for (const attachment of attachments) {
    if (attachment.kind !== 'image' && attachment.kind !== 'video') continue;
    const url = resolveMediaUrl(attachment.url);
    if (!url) continue;
    items.push({ url, kind: attachment.kind });
  }
  return items;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  page: {
    width: SCREEN_W,
    height: SCREEN_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  media: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    gap: 12,
  },
  playCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playHint: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  counter: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
