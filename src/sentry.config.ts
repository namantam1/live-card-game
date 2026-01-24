import * as Sentry from "@sentry/browser";

export function initSentry() {
  // Don't initialize Sentry on localhost
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    console.log("Sentry disabled on localhost");
    return;
  }

  // Only initialize Sentry if DSN is provided
  const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

  if (!SENTRY_DSN) {
    console.warn("Sentry DSN not configured. Error tracking is disabled.");
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    sendDefaultPii: true,

    // Set environment
    environment: import.meta.env.MODE || "development",

    // Performance Monitoring
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0, // 10% in production, 100% in dev

    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

    // Integrations
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],

    // Release tracking
    release: import.meta.env.VITE_APP_VERSION || "1.0.0",

    // Filter out common non-critical errors
    beforeSend(event, hint) {
      const error = hint.originalException;

      // Filter out known non-critical errors
      if (error && typeof error === "object" && "message" in error) {
        const message = String(error.message).toLowerCase();

        // Ignore common browser extension errors
        if (
          message.includes("extension") ||
          message.includes("chrome-extension") ||
          message.includes("moz-extension")
        ) {
          return null;
        }
      }

      return event;
    },
  });

  console.log("Sentry initialized successfully");
}
