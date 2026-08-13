// Senegalese flag inspired palette
// Green: #00853F (vert drapeau), Yellow: #FDEF42 (jaune drapeau), Red: #E31B23 (rouge drapeau)
const senegalGreen = "#00853F";
const senegalGreenDark = "#006B32";
const senegalYellow = "#FDEF42";
const senegalRed = "#E31B23";
const africanOrange = "#FF6B35";
const terracotta = "#D97236";
const earthBrown = "#8B4513";
const savanaGold = "#F4A460";
const sunsetYellow = "#FFB703";
const forestGreen = "#2A9D8F";
const deepTeal = "#264653";
const vibrantPurple = "#9B4DCA";
const warmBeige = "#F5E6D3";

export default {
  light: {
    text: "#1a1a1a",
    background: "#FFFBF2",
    tint: senegalGreen,
    tabIconDefault: "#C9A876",
    tabIconSelected: senegalGreen,
    primary: senegalGreen,
    primaryLight: "#00A650",
    primaryDark: senegalGreenDark,
    secondary: africanOrange,
    tertiary: savanaGold,
    accent: senegalRed,
    success: "#00A651",
    error: senegalRed,
    warning: senegalYellow,
    border: "#E8D5B7",
    card: "#FFFFFF",
    cardBorder: "#F0E6D7",
    textSecondary: "#8B6F47",
    textMuted: "#A89B8F",
    gradient: {
      primary: [senegalGreen, senegalGreenDark],
      flag: [senegalGreen, senegalYellow, senegalRed],
      sunset: [africanOrange, senegalRed, sunsetYellow],
      warm: [sunsetYellow, africanOrange, senegalRed],
      earth: [earthBrown, terracotta, savanaGold],
      tropical: [forestGreen, deepTeal],
      vibrant: [vibrantPurple, senegalRed, africanOrange],
      secondary: [terracotta, earthBrown],
      accent: [sunsetYellow, savanaGold],
    },
    patterns: {
      kente: [sunsetYellow, africanOrange, senegalRed, forestGreen],
      mudcloth: ["#2C1810", earthBrown, terracotta, warmBeige],
      ankara: [senegalRed, africanOrange, sunsetYellow, forestGreen, vibrantPurple],
    }
  },
};
