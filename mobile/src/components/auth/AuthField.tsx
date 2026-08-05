import { Ionicons } from '@expo/vector-icons';
import React, { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { useTheme } from '@/theme';

interface AuthFieldProps extends Omit<TextInputProps, 'style'> {
  password?: boolean;
  error?: string | null;
}

/**
 * Pill field matching the Revolut-style auth screens: no label, no border chrome,
 * just a soft fill that flips slightly when focused.
 */
export const AuthField = forwardRef<TextInput, AuthFieldProps>(function AuthField(
  { password = false, error, editable = true, ...rest },
  ref,
) {
  const { colors, isDark } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(password);

  const fill = isDark ? '#1c1c1e' : '#f2f2f7';
  const fillFocused = isDark ? '#2c2c2e' : '#ebebf0';

  return (
    <View>
      <View
        style={[
          styles.field,
          {
            backgroundColor: focused ? fillFocused : fill,
            opacity: editable === false ? 0.55 : 1,
          },
        ]}
      >
        <TextInput
          ref={ref}
          style={[styles.input, { color: colors.text }]}
          placeholderTextColor={colors.textSubtle}
          secureTextEntry={hidden}
          editable={editable}
          onFocus={(event) => {
            setFocused(true);
            rest.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            rest.onBlur?.(event);
          }}
          {...rest}
        />
        {password ? (
          <Pressable onPress={() => setHidden((value) => !value)} hitSlop={10} style={styles.trailing}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textSubtle} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderRadius: 28,
    paddingHorizontal: 20,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 16,
  },
  trailing: {
    marginLeft: 8,
  },
  error: {
    fontSize: 13,
    marginTop: 8,
    marginLeft: 6,
  },
});
