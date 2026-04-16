// AhoyVPN Color Palette
export const colors = {
  // Primary Background (Dark Hull)
  bg: {
    primary: '#121212',
    secondary: '#1A1A1A',
    tertiary: '#2A2A2A',
    card: '#252525',
  },

  // Text Colors
  text: {
    primary: '#F0F4F8',
    secondary: '#B0C4DE',
    muted: '#A0AEC0',
    inverted: '#0A1D37', // For light mode
  },

  // Accent Colors
  accent: {
    primary: '#1E90FF', // Blue Sails (CTAs, headers)
    secondary: '#4169E1', // Alternative blue
    wave: '#20B2AA', // Ocean Waves (hover states)
    light: '#00BFFF', // Light ocean
    success: '#00CED1', // Success/Positive
  },

  // Borders & Dividers
  border: '#3A3A3A',
  divider: '#3A3A3A',

  // Semantic
  error: '#FF6B6B',
  warning: '#FFD93D',
  info: '#1E90FF',
};

export const darkTheme = {
  bg: colors.bg.primary,
  bgCard: colors.bg.card,
  text: colors.text.primary,
  textSecondary: colors.text.secondary,
  accentPrimary: colors.accent.primary,
  accentSecondary: colors.accent.wave,
  border: colors.border,
};

export const lightTheme = {
  bg: '#FFFFFF',
  bgCard: '#F5F5F5',
  text: '#0A1D37',
  textSecondary: '#666666',
  accentPrimary: '#1E90FF',
  accentSecondary: '#20B2AA',
  border: '#CCCCCC',
};
