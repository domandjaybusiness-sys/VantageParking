import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AnimatedPressableButtonProps extends PressableProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleOnPress?: boolean;
}

export function AnimatedPressableButton({
  children,
  style,
  scaleOnPress = true,
  ...props
}: AnimatedPressableButtonProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  const handlePressIn = () => {
    if (scaleOnPress) {
      scale.value = withSpring(0.95, {
        damping: 15,
        stiffness: 300,
      });
    }
    opacity.value = withTiming(0.7, { duration: 100 });
  };

  const handlePressOut = () => {
    if (scaleOnPress) {
      scale.value = withSpring(1, {
        damping: 15,
        stiffness: 300,
      });
    }
    opacity.value = withTiming(1, { duration: 100 });
  };

  return (
    <AnimatedPressable
      {...props}
      style={[style, animatedStyle]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      {children}
    </AnimatedPressable>
  );
}
