import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = { status: 'Confirmed' | 'Pending' | 'Cancelled' | string };

export default function Badge({ status }: Props) {
  const theme = useColorScheme() ?? 'light';
  const color =
    status === 'Confirmed'
      ? Colors[theme].badgeConfirmed
      : status === 'Pending'
      ? Colors[theme].badgePending
      : Colors[theme].badgeCancelled;

  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.text}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  text: {
    color: 'white',
    fontWeight: '700',
    fontSize: 12,
  },
});
