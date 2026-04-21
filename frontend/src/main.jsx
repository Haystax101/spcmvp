import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import * as Sentry from "@sentry/react";
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'

if (import.meta.env.VITE_SENTRY_DSN) {
  const isProd = import.meta.env.PROD;
  const tracesSampleRate = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? (isProd ? 0.15 : 0));
  const replaySessionSampleRate = Number(import.meta.env.VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE ?? (isProd ? 0.02 : 0));
  const replayOnErrorSampleRate = Number(import.meta.env.VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE ?? (isProd ? 0.1 : 0));

  const integrations = [
    Sentry.browserTracingIntegration(),
  ];

  if (replaySessionSampleRate > 0 || replayOnErrorSampleRate > 0) {
    integrations.push(Sentry.replayIntegration());
  }

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations,
    tracesSampleRate,
    replaysSessionSampleRate: replaySessionSampleRate,
    replaysOnErrorSampleRate: replayOnErrorSampleRate,
    beforeSend(event, hint) {
      const exceptionMessage = String(
        hint?.originalException?.message
        || event?.exception?.values?.[0]?.value
        || event?.message
        || ''
      );

      const isExpectedRowsAuthNoise = /\brows\b/i.test(exceptionMessage)
        && /(401|forbidden|permission|not authorized|unauthorized)/i.test(exceptionMessage);

      if (isExpectedRowsAuthNoise) {
        return null;
      }

      return event;
    },
  });
}

if (import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST,
    person_profiles: 'identified_only'
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <App />
    </PostHogProvider>
  </StrictMode>,
)
