import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, Animated, ImageStyle, StyleProp, Image } from 'react-native';

interface OptimizedImageProps {
  uri: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

function getThumbnailUrl(url: string): string {
  if (!url) return url;
  
  if (url.includes('unsplash.com')) {
    const thumbnailUrl = url.includes('?') 
      ? `${url}&w=10&q=1&blur=50` 
      : `${url}?w=10&q=1&blur=50`;
    return thumbnailUrl;
  }
  
  return url;
}

function getOptimizedUrl(url: string, width: number = 400): string {
  if (!url) return url;
  
  if (url.includes('unsplash.com')) {
    const optimizedUrl = url.includes('?')
      ? `${url}&w=${width}&q=50&auto=format&fm=webp&fit=crop`
      : `${url}?w=${width}&q=50&auto=format&fm=webp&fit=crop`;
    return optimizedUrl;
  }
  
  return url;
}

const imageCache = new Map<string, boolean>();

export function prefetchImage(uri: string) {
  if (imageCache.has(uri)) return;
  
  const optimizedUri = getOptimizedUrl(uri);
  Image.prefetch(optimizedUri)
    .then(() => {
      imageCache.set(uri, true);
    })
    .catch(() => {});
}

export default function OptimizedImage({ uri, style, resizeMode = 'cover' }: OptimizedImageProps) {
  const [thumbnailLoaded, setThumbnailLoaded] = useState<boolean>(false);
  const [fullImageLoaded, setFullImageLoaded] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const thumbnailOpacity = useState(new Animated.Value(0))[0];
  const fullImageOpacity = useState(new Animated.Value(0))[0];

  const thumbnailUri = useMemo(() => getThumbnailUrl(uri), [uri]);
  const optimizedUri = useMemo(() => getOptimizedUrl(uri), [uri]);

  useEffect(() => {
    if (thumbnailLoaded) {
      Animated.timing(thumbnailOpacity, {
        toValue: 1,
        duration: 50,
        useNativeDriver: true,
      }).start();
    }
  }, [thumbnailLoaded, thumbnailOpacity]);

  useEffect(() => {
    if (fullImageLoaded) {
      Animated.timing(fullImageOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [fullImageLoaded, fullImageOpacity]);

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.placeholder, style]} />
      
      {!error && (
        <>
          <Animated.Image
            source={{ uri: thumbnailUri }}
            style={[styles.image, style, { opacity: thumbnailOpacity }]}
            resizeMode={resizeMode}
            onLoad={() => setThumbnailLoaded(true)}
            blurRadius={2}
          />
          
          <Animated.Image
            source={{ uri: optimizedUri }}
            style={[styles.image, style, { opacity: fullImageOpacity }]}
            resizeMode={resizeMode}
            onLoad={() => setFullImageLoaded(true)}
            onError={() => setError(true)}
            progressiveRenderingEnabled
          />
        </>
      )}
      
      {error && (
        <View style={[styles.errorContainer, style]}>
          <View style={styles.errorPlaceholder} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f5f5f5',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorPlaceholder: {
    width: '60%',
    height: '60%',
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
  },
});
