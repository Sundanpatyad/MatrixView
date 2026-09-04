import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { AppHeader, Button, Input, KeyboardAware, Screen } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { RootStackParamList } from '@/navigation/types';
import { useColors } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateProject'>;

function suggestKey(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
  return words
    .slice(0, 4)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

export function CreateProjectScreen({ navigation }: Props) {
  const colors = useColors();
  const toast = useToast();
  const { createProject, setActiveProjectId } = useWorkspace();

  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const effectiveKey = keyTouched ? key : suggestKey(name);
  const canSubmit = name.trim().length > 1 && effectiveKey.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const project = await createProject({
        name: name.trim(),
        key: effectiveKey.slice(0, 6).toUpperCase(),
        description: description.trim() || undefined,
      });
      setActiveProjectId(project.id);
      toast.success(`${project.name} created`);
      navigation.goBack();
    } catch (error) {
      toast.fromError(error, 'Could not create the project.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <AppHeader title="New project" showBack />

      <KeyboardAware>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.intro, { color: colors.textMuted }]}>
            A project gets its own board, teams and task numbering.
          </Text>

          <Input
            label="Project name"
            placeholder="Mobile revamp"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoFocus
          />

          <Input
            label="Key"
            placeholder="MOB"
            value={effectiveKey}
            onChangeText={(value) => {
              setKeyTouched(true);
              setKey(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
            }}
            autoCapitalize="characters"
            maxLength={6}
            hint="Used as the task prefix, e.g. MOB-14."
          />

          <Input
            label="Description"
            placeholder="What is this project about?"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <Button
            label="Create project"
            onPress={handleSubmit}
            loading={submitting}
            disabled={!canSubmit}
            size="lg"
            fullWidth
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </KeyboardAware>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    gap: 16,
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
  },
});
