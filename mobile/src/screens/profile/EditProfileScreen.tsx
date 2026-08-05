import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader, Avatar, Button, Input, Screen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { pickImages } from '@/lib/pickers';
import type { RootStackParamList } from '@/navigation/types';
import { useColors } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export function EditProfileScreen({ navigation }: Props) {
  const colors = useColors();
  const toast = useToast();
  const { user, updateProfile, uploadAvatar } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const dirty = name.trim() !== (user?.name ?? '') || phone.trim() !== (user?.phone ?? '');

  const changeAvatar = async () => {
    try {
      const [file] = await pickImages({ multiple: false });
      if (!file) return;
      setUploading(true);
      await uploadAvatar(file);
      toast.success('Photo updated');
    } catch (error) {
      toast.fromError(error, 'Could not update your photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() });
      toast.success('Profile saved');
      navigation.goBack();
    } catch (error) {
      toast.fromError(error, 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <AppHeader title="Edit profile" showBack />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.avatarBlock}>
            <Pressable onPress={changeAvatar} disabled={uploading}>
              <Avatar name={user?.name} uri={user?.avatarUrl} size={88} />
              <View style={[styles.cameraBadge, { backgroundColor: colors.brand, borderColor: colors.bg }]}>
                <Ionicons name={uploading ? 'hourglass-outline' : 'camera'} size={14} color="#ffffff" />
              </View>
            </Pressable>
            <Pressable onPress={changeAvatar} disabled={uploading} hitSlop={8}>
              <Text style={[styles.changeText, { color: colors.brand }]}>
                {uploading ? 'Uploading…' : 'Change photo'}
              </Text>
            </Pressable>
          </View>

          <Input label="Full name" value={name} onChangeText={setName} autoCapitalize="words" icon="person-outline" />

          <Input
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            icon="call-outline"
            placeholder="Optional"
          />

          <Input label="Email" value={user?.email ?? ''} editable={false} icon="mail-outline" hint="Email cannot be changed here." />

          <Input label="Organisation" value={user?.orgName ?? ''} editable={false} icon="business-outline" />

          <Button
            label="Save changes"
            onPress={handleSave}
            loading={saving}
            disabled={!dirty}
            size="lg"
            fullWidth
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  avatarBlock: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
});
