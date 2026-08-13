import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

function getProductCardWidth() {
  if (width < 600) {
    const containerPadding = 20;
    const gap = 12;
    const columns = 2;
    const availableWidth = width - (containerPadding * 2);
    const totalGapWidth = gap * (columns - 1);
    return (availableWidth - totalGapWidth) / columns;
  } else if (width < 900) {
    return (width - 80) / 3;
  } else if (width < 1200) {
    return (width - 120) / 4;
  } else if (width < 1600) {
    const containerWidth = Math.min(width, 1600);
    return (containerWidth - 160) / 5;
  } else {
    return (1600 - 160) / 6;
  }
}

export default function ProductSkeleton() {
  const [shimmerAnim] = useState(new Animated.Value(0));
  const cardWidth = getProductCardWidth();

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={[styles.card, { width: cardWidth }]}>
      <Animated.View style={[styles.imageSkeleton, { height: cardWidth * 1.1, opacity }]} />
      <View style={styles.content}>
        <Animated.View style={[styles.titleSkeleton, { opacity }]} />
        <Animated.View style={[styles.priceSkeleton, { opacity }]} />
        <Animated.View style={[styles.locationSkeleton, { opacity }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f0f1f3',
  },
  imageSkeleton: {
    width: '100%',
    backgroundColor: '#e0e0e0',
  },
  content: {
    padding: 14,
  },
  titleSkeleton: {
    width: '80%',
    height: 14,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 8,
  },
  priceSkeleton: {
    width: '50%',
    height: 18,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 8,
  },
  locationSkeleton: {
    width: '60%',
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
});
