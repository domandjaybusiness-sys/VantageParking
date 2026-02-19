import { Colors, Design } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';

export default function Card({ children, style, ...rest }: ViewProps) {
  const theme = useColorScheme() ?? 'light';
  const bg = Colors[theme].backgroundCard;
  return (
    <View style={[styles.card, { backgroundColor: bg }, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Design.radius,
    padding: Design.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
});
