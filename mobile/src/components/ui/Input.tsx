import { Ionicons } from '@expo/vector-icons';
import React, { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { radius, useColors } from '@/theme';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string | null;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: ViewStyle;
  /** Renders a show/hide toggle and starts obscured. */
  password?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, hint, icon, containerStyle, password = false, multiline, ...rest },
  ref,
) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(password);

  const borderColor = error ? colors.danger : focused ? colors.brand : colors.border;

  return (
    <View style={containerStyle}>
      {label ? <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          {
            backgroundColor: colors.surfaceAlt,
            borderColor,
            minHeight: multiline ? 96 : 50,
            alignItems: multiline ? 'flex-start' : 'center',
            paddingVertical: multiline ? 12 : 0,
          },
        ]}
      >
        {icon ? (
          <Ionicons name={icon} size={18} color={focused ? colors.brand : colors.textSubtle} style={styles.icon} />
        ) : null}
        <TextInput
          ref={ref}
          style={[styles.input, { color: colors.text, textAlignVertical: multiline ? 'top' : 'center' }]}
          placeholderTextColor={colors.textSubtle}
          secureTextEntry={hidden}
          multiline={multiline}
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
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.textSubtle} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={[styles.helper, { color: colors.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.helper, { color: colors.textSubtle }]}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  field: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  icon: {
    marginRight: 10,
    marginTop: 1,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  trailing: {
    marginLeft: 10,
  },
  helper: {
    fontSize: 12,
    marginTop: 6,
  },
});
