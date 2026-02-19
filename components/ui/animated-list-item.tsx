import React from 'react';
import { ViewProps } from 'react-native';
import Animated, { FadeInDown, FadeInLeft, FadeInRight, FadeInUp } from 'react-native-reanimated';

interface AnimatedListItemProps extends ViewProps {
  children: React.ReactNode;
  index?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  duration?: number;
}

export function AnimatedListItem({
  children,
  index = 0,
  direction = 'up',
  delay = 0,
  duration = 400,
  style,
  ...props
}: AnimatedListItemProps) {
  const animations = {
    up: FadeInUp,
    down: FadeInDown,
    left: FadeInLeft,
    right: FadeInRight,
  };

  const Animation = animations[direction];
  const itemDelay = delay + index * 100;

  return (
    <Animated.View
      entering={Animation.duration(duration).delay(itemDelay)}
      style={style}
      {...props}
    >
      {children}
    </Animated.View>
  );
}
