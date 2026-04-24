import * as Sentry from "@sentry/react";
import posthog from 'posthog-js';

export const track = {
  // Voltz system
  voltzScreenView: (screen) => posthog.capture('voltz_screen_viewed', { screen }),
  voltzPurchaseInitiated: (packageName, price) => posthog.capture('voltz_purchase_initiated', { packageName, price }),
  voltzPurchaseCompleted: (packageName, voltzAdded, price) => posthog.capture('voltz_purchase_completed', { packageName, voltzAdded, price }),
  voltzNotificationPrefChanged: (prefName, enabled) => posthog.capture('voltz_notification_pref_changed', { prefName, enabled }),
  voltzReferralLinkCopied: () => posthog.capture('voltz_referral_link_copied'),
  voltzReferralLinkShared: () => posthog.capture('voltz_referral_link_shared'),
  voltzPasswordChanged: () => posthog.capture('voltz_password_changed'),
  voltzSignedOut: () => posthog.capture('voltz_signed_out'),

  // Navigation
  screenNavigation: (fromScreen, toScreen) => posthog.capture('screen_navigation', { fromScreen, toScreen }),
  pageView: (page) => posthog.capture('page_view', { page }),

  // Auth
  signupAttempted: () => posthog.capture('signup_attempted'),
  signupCompleted: () => posthog.capture('signup_completed'),
  signinAttempted: () => posthog.capture('signin_attempted'),
  signinCompleted: () => posthog.capture('signin_completed'),

  // Onboarding
  onboardingStarted: () => posthog.capture('onboarding_started'),
  onboardingStepCompleted: (step, stepNumber) => posthog.capture('onboarding_step_completed', { step, stepNumber }),
  onboardingCompleted: () => posthog.capture('onboarding_completed'),

  // General user actions
  userAction: (action, properties = {}) => posthog.capture(action, properties),
};

export const captureError = (error, context = {}) => {
  console.error('Error:', error);
  Sentry.captureException(error, { extra: context });
};

export const captureMessage = (message, level = 'info') => {
  Sentry.captureMessage(message, level);
};

export const identifyUser = (userId, traits = {}) => {
  posthog.identify(userId, traits);
  Sentry.setUser({ id: userId, ...traits });
};

export const logoutUser = () => {
  posthog.reset();
  Sentry.setUser(null);
};
