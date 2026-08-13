import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface ScrollingTextProps {
  text: string;
  textColor: string;
  backgroundColor: string;
}

export default function ScrollingText({ text, textColor, backgroundColor }: ScrollingTextProps) {
  const scrollAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const textWidth = text.length * 10;
    const animationDuration = textWidth * 50;

    scrollAnim.setValue(0);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scrollAnim, {
          toValue: -textWidth,
          duration: animationDuration,
          useNativeDriver: true,
        }),
        Animated.timing(scrollAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => {
      animation.stop();
    };
  }, [text, scrollAnim]);

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Animated.View
        style={[
          styles.textContainer,
          {
            transform: [{ translateX: scrollAnim }],
          },
        ]}
      >
        <Text style={[styles.text, { color: textColor }]}>
          {text}   •   {text}   •   {text}   •   {text}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 32,
    overflow: 'hidden',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});
