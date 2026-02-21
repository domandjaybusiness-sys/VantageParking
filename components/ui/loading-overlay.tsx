import { useTheme } from '@/contexts/ThemeContext';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';

export default function LoadingOverlay({ visible, text }: { visible: boolean; text?: string }) {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: visible ? 1 : 0, duration: 300, useNativeDriver: true }).start();
  }, [visible, anim]);

  if (!visible) return null;

  return (
    <Animated.View pointerEvents="auto" style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.35)', opacity: anim }]}> 
      <View style={[styles.card, { backgroundColor: colors.backgroundCard }]}> 
        <ActivityIndicator size="large" color={colors.primary} />
        {text ? <Text style={[styles.text, { color: colors.text, marginTop: 12 }]}>{text}</Text> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  card: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 180,
  },
  text: {
    fontSize: 14,
    textAlign: 'center',
  },
});
