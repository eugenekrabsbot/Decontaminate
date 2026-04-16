// SEO utility for dynamic page metadata

export const defaultMeta = {
  title: 'AHOY VPN - Privacy-First VPN Service',
  description: 'Secure your internet connection with military-grade encryption. Zero logs, no tracking, no compromises.',
  url: 'https://ahoyvpn.net',
  image: 'https://ahoyvpn.net/og-image.png',
};

export const pageMeta = {
  home: {
    title: 'AHOY VPN - Privacy-First VPN Service',
    description: 'Secure, private VPN. Zero logs. No email required. Fast encryption with 50+ global servers.',
    keywords: 'VPN, privacy, secure, no logs, anonymous, encryption',
  },
  checkout: {
    title: 'Get AHOY VPN - Checkout',
    description: 'Choose your plan and get started with secure VPN in minutes. No email required.',
    keywords: 'VPN subscription, pricing, checkout, privacy',
  },
  login: {
    title: 'Login - AHOY VPN',
    description: 'Log in to your AHOY VPN account with your numeric username and password.',
    keywords: 'login, account, VPN',
  },
  recover: {
    title: 'Account Recovery - AHOY VPN',
    description: 'Recover your AHOY VPN account using your recovery kit.',
    keywords: 'account recovery, recovery kit, VPN',
  },
  dashboard: {
    title: 'Dashboard - AHOY VPN',
    description: 'Manage your AHOY VPN subscription, change password, and view account details.',
    keywords: 'dashboard, subscription, account management',
  },
  affiliate: {
    title: 'Affiliate Program - AHOY VPN',
    description: 'Earn commissions by referring friends to AHOY VPN. 10% lifetime earnings.',
    keywords: 'affiliate, referral, commission, earning',
  },
  admin: {
    title: 'Admin Dashboard - AHOY VPN',
    description: 'Manage customers, affiliates, and system KPIs.',
    keywords: 'admin, dashboard, management',
  },
  tos: {
    title: 'Terms of Service - AHOY VPN',
    description: 'Read AHOY VPN Terms of Service.',
    keywords: 'terms, service, legal',
  },
  privacy: {
    title: 'Privacy Policy - AHOY VPN',
    description: 'AHOY VPN privacy policy - no logs, minimal data collection, privacy-first design.',
    keywords: 'privacy, policy, data protection',
  },
  faq: {
    title: 'FAQ - AHOY VPN',
    description: 'Frequently asked questions about AHOY VPN service, pricing, and features.',
    keywords: 'FAQ, questions, support',
  },
};
export const getPageMeta = (page) => pageMeta[page] || {};
