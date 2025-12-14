export interface PlexifyTheme {
  name: 'aec' | 'bid' | 'biz';

  // Primary colors
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;

  // Gradient colors (for PlexifyBIZ slate-to-copper)
  gradientStart: string;
  gradientEnd: string;

  // Sidebar colors
  sidebarColor: string;
  sidebarHoverColor?: string;
  sidebarActiveColor?: string;

  // Text colors
  textPrimary?: string;
  textSecondary?: string;
  textInverse?: string;

  // Status colors
  successColor?: string;
  warningColor?: string;
  errorColor?: string;
}

export const defaultTheme: PlexifyTheme = {
  name: 'bid',
  primaryColor: '#1e3a8a',
  secondaryColor: '#3b82f6',
  accentColor: '#10b981',
  gradientStart: '#1e3a8a',
  gradientEnd: '#1e3a8a',
  sidebarColor: '#1e3a8a',
  sidebarHoverColor: '#1e40af',
  sidebarActiveColor: '#1e3a8a',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textInverse: '#f9fafb',
  successColor: '#10b981',
  warningColor: '#f59e0b',
  errorColor: '#ef4444',
};

// Pre-defined themes for each product
export const aecTheme: PlexifyTheme = {
  name: 'aec',
  primaryColor: '#7c3aed',
  secondaryColor: '#a78bfa',
  accentColor: '#10b981',
  gradientStart: '#7c3aed',
  gradientEnd: '#7c3aed',
  sidebarColor: '#7c3aed',
  sidebarHoverColor: '#6d28d9',
  sidebarActiveColor: '#7c3aed',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textInverse: '#f9fafb',
  successColor: '#10b981',
  warningColor: '#f59e0b',
  errorColor: '#ef4444',
};

export const bidTheme: PlexifyTheme = {
  name: 'bid',
  primaryColor: '#1e3a8a',
  secondaryColor: '#3b82f6',
  accentColor: '#10b981',
  gradientStart: '#1e3a8a',
  gradientEnd: '#1e3a8a',
  sidebarColor: '#1e3a8a',
  sidebarHoverColor: '#1e40af',
  sidebarActiveColor: '#1e3a8a',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textInverse: '#f9fafb',
  successColor: '#10b981',
  warningColor: '#f59e0b',
  errorColor: '#ef4444',
};

export const bizTheme: PlexifyTheme = {
  name: 'biz',
  primaryColor: '#353c56',
  secondaryColor: '#d79973',
  accentColor: '#d97706',
  gradientStart: '#353c56',
  gradientEnd: '#d79973',
  sidebarColor: '#7c3aed',
  sidebarHoverColor: '#6d28d9',
  sidebarActiveColor: '#7c3aed',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textInverse: '#f9fafb',
  successColor: '#10b981',
  warningColor: '#f59e0b',
  errorColor: '#ef4444',
};
