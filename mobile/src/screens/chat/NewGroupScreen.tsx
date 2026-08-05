import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, Avatar, Button, EmptyState, Input, Screen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useToast } from '@/context/ToastContext';
import type { RootStackParamList } from '@/navigation/types';
import { radius, useColors } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'NewGroup'>;

export function NewGroupScreen({ navigation }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user } = useAuth();
  const { users, startGroup } = useChat();

  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const candidates = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users
      .filter((entry) => entry.id !== user?.id)
      .filter((entry) =>
        term ? entry.name.toLowerCase().includes(term) || entry.email.toLowerCase().includes(term) : true,
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [search, user?.id, users]);

  const selectedUsers = users.filter((entry) => selected.includes(entry.id));

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));
  };

  const handleCreate = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      const conversation = await startGroup({ name: name.trim(), memberIds: selected });
      navigation.replace('ChatThread', { conversationId: conversation.id });
    } catch (error) {
      toast.fromError(error, 'Could not create the group.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <AppHeader title="New group" subtitle={`${selected.length} selected`} showBack />

      <View style={styles.top}>
        <Input label="Group name" placeholder="Design team" value={name} onChangeText={setName} autoCapitalize="words" />

        {selectedUsers.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {selectedUsers.map((entry) => (
              <Pressable key={entry.id} onPress={() => toggle(entry.id)} style={styles.chip}>
                <Avatar name={entry.name} uri={entry.avatarUrl} size={44} />
                <View style={[styles.chipRemove, { backgroundColor: colors.danger, borderColor: colors.bg }]}>
                  <Ionicons name="close" size={11} color="#ffffff" />
                </View>
                <Text style={[styles.chipName, { color: colors.textSubtle }]} numberOfLines={1}>
                  {entry.name.split(' ')[0]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <Input
          placeholder="Search teammates"
          icon="search-outline"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      </View>

      <FlatList
        data={candidates}
        keyExtractor={(entry) => entry.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<EmptyState icon="people-outline" title="No teammates found" />}
        renderItem={({ item }) => {
          const active = selected.includes(item.id);
          return (
            <Pressable
              onPress={() => toggle(item.id)}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}
            >
              <Avatar name={item.name} uri={item.avatarUrl} size={42} />
              <View style={styles.rowText}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.email, { color: colors.textSubtle }]} numberOfLines={1}>
                  {item.email}
                </Text>
              </View>
              <Ionicons
                name={active ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={active ? colors.brand : colors.textSubtle}
              />
            </Pressable>
          );
        }}
      />

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.bgElevated,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <Button
          label="Create group"
          onPress={handleCreate}
          loading={submitting}
          disabled={!name.trim()}
          size="lg"
          fullWidth
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
    paddingBottom: 10,
  },
  chips: {
    gap: 14,
    paddingVertical: 2,
  },
  chip: {
    alignItems: 'center',
    width: 52,
  },
  chipRemove: {
    position: 'absolute',
    top: -2,
    right: 1,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipName: {
    fontSize: 11,
    marginTop: 4,
  },
  list: {
    paddingBottom: 16,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowText: { flex: 1 },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  email: {
    fontSize: 12.5,
    marginTop: 1,
  },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
