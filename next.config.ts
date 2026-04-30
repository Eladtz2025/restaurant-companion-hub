import { withSentryConfig } from '@sentry/nextjs';
import withPWA from 'next-pwa';

import type { NextConfig } from 'next';

const withPWAConfig = withPWA({
  dest: 'public',
  disable: process.env.NEXT_PUBLIC_ENV !== 'production',
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = withPWAConfig({});

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT ?? 'restaurant-os',
  // Upload source maps only when SENTRY_AUTH_TOKEN is present (CI)
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: false,
  },
});
