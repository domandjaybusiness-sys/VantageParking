import { Colors, Design } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';

type Props = {
  title: string;
  onPress?: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export default function PrimaryButton({ title, onPress, style, textStyle }: Props) {
  const theme = useColorScheme() ?? 'light';
  const bg = Colors[theme].primary;
  const color = '#fff';

  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 20 }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={style}>
      <Animated.View style={[styles.button, { backgroundColor: bg, transform: [{ scale }] }]}> 
        <Text style={[styles.text, { color }, textStyle]}>{title}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: Design.buttonHeight,
    borderRadius: Design.radius,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  text: {
    fontSize: Design.fontSizes.body,
    fontWeight: '700',
  },
});
