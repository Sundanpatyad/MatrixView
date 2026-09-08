import React, { useCallback } from 'react';
import { Linking, StyleSheet, Text, type TextStyle } from 'react-native';

import { tokenizeLinks } from '@/lib/chat/links';

export function LinkifiedText({
  text,
  style,
  linkStyle,
}: {
  text: string;
  style?: TextStyle;
  linkStyle?: TextStyle;
}) {
  const tokens = tokenizeLinks(text);

  const open = useCallback((href: string) => {
    void Linking.openURL(href).catch(() => undefined);
  }, []);

  return (
    <Text style={style}>
      {tokens.map((token, index) =>
        token.type === 'link' ? (
          <Text
            key={`${token.href}-${index}`}
            style={[styles.link, linkStyle]}
            onPress={() => open(token.href)}
          >
            {token.value}
          </Text>
        ) : (
          <Text key={`t-${index}`}>{token.value}</Text>
        ),
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});
