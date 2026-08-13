import { Dimensions, Platform } from 'react-native';

export const isWeb = Platform.OS === 'web';
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

export function getDimensions() {
  const { width, height } = Dimensions.get('window');
  return { width, height };
}

export const BREAKPOINTS = {
  mobile: 600,
  tablet: 900,
  desktop: 1200,
  largeDesktop: 1600,
} as const;

export function getDeviceType() {
  const { width } = getDimensions();
  if (width < BREAKPOINTS.mobile) return 'mobile';
  if (width < BREAKPOINTS.tablet) return 'tablet';
  if (width < BREAKPOINTS.desktop) return 'desktop';
  return 'largeDesktop';
}

export function isMobile() {
  const { width } = getDimensions();
  return width < BREAKPOINTS.mobile;
}

export function isTablet() {
  const { width } = getDimensions();
  return width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet;
}

export function isDesktop() {
  const { width } = getDimensions();
  return width >= BREAKPOINTS.tablet;
}

export function isLargeDesktop() {
  const { width } = getDimensions();
  return width >= BREAKPOINTS.largeDesktop;
}

export function getResponsiveValue<T>(values: {
  mobile: T;
  tablet?: T;
  desktop?: T;
  largeDesktop?: T;
}): T {
  const deviceType = getDeviceType();
  
  switch (deviceType) {
    case 'largeDesktop':
      return values.largeDesktop ?? values.desktop ?? values.tablet ?? values.mobile;
    case 'desktop':
      return values.desktop ?? values.tablet ?? values.mobile;
    case 'tablet':
      return values.tablet ?? values.mobile;
    default:
      return values.mobile;
  }
}

export function getGridColumns() {
  const { width } = getDimensions();
  
  if (width < 400) return 2;
  if (width < BREAKPOINTS.mobile) return 2;
  if (width < BREAKPOINTS.tablet) return 3;
  if (width < BREAKPOINTS.desktop) return 4;
  if (width < BREAKPOINTS.largeDesktop) return 5;
  return 6;
}

export function getProductCardWidth() {
  const { width } = getDimensions();
  const columns = getGridColumns();
  const gap = width < BREAKPOINTS.mobile ? 12 : (width < BREAKPOINTS.desktop ? 16 : 20);
  const containerPadding = width < BREAKPOINTS.mobile ? 16 : (width < BREAKPOINTS.desktop ? 20 : 20);
  
  const maxContainerWidth = width < BREAKPOINTS.desktop ? width : 1600;
  const containerWidth = Math.min(width, maxContainerWidth);
  const availableWidth = containerWidth - (containerPadding * 2);
  const totalGapWidth = gap * (columns - 1);
  const cardWidth = (availableWidth - totalGapWidth) / columns;
  
  const maxCardWidth = 280;
  const minCardWidth = width < 400 ? 140 : (width < BREAKPOINTS.mobile ? 150 : 180);
  
  return Math.max(Math.min(cardWidth, maxCardWidth), minCardWidth);
}

export function getButtonHeight() {
  return getResponsiveValue({
    mobile: 48,
    tablet: 52,
    desktop: 56,
  });
}

export function getButtonFontSize() {
  return getResponsiveValue({
    mobile: 16,
    tablet: 17,
    desktop: 18,
  });
}

export function getInputHeight() {
  return getResponsiveValue({
    mobile: 48,
    tablet: 52,
    desktop: 56,
  });
}

export function getHeaderHeight() {
  return getResponsiveValue({
    mobile: 'auto' as const,
    tablet: 'auto' as const,
    desktop: 'auto' as const,
  });
}

export function getContainerPadding() {
  return getResponsiveValue({
    mobile: 16,
    tablet: 20,
    desktop: 32,
    largeDesktop: 40,
  });
}

export function getMaxContainerWidth(): number | string {
  return getResponsiveValue<number | string>({
    mobile: '100%',
    tablet: '100%',
    desktop: 1400,
    largeDesktop: 1600,
  });
}
