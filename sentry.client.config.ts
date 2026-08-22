import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Session Replay — captures replays on errors and 10% of normal sessions
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  // If you wish to use the default ignore, uncomment the line below:
  // See: https://docs.sentry.io/platforms/javascript/configuration/options/#ignore-errors
  ignoreErrors: [
    // Ignore non-critical client errors
    "ResizeObserver loop",
    "Network request failed",
    "Navigation cancelled",
  ],

  // Setting this option to true will print useful information to the console
  // while setting up Sentry.
  debug: false,
});
