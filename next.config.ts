import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

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
