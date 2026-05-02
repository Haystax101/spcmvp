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

  // Navigation — fires $pageview so PostHog DAU/MAU counts correctly
  tabViewed: (tab) => posthog.capture('$pageview', { $current_url: `/${tab}`, tab }),
  screenNavigation: (fromScreen, toScreen) => posthog.capture('screen_navigation', { fromScreen, toScreen }),

  // Auth
  signupAttempted: (emailDomain) => posthog.capture('signup_attempted', { email_domain: emailDomain }),
  signupCompleted: () => posthog.capture('signup_completed'),
  signinAttempted: () => posthog.capture('signin_attempted'),
  signinCompleted: () => posthog.capture('signin_completed'),

  // Onboarding funnel
  onboardingStarted: () => posthog.capture('onboarding_started'),
  onboardingStepCompleted: (step, stepNumber) => posthog.capture('onboarding_step_completed', { step, stepNumber }),
  onboardingIntentSelected: (intent) => posthog.capture('onboarding_intent_selected', { intent }),
  onboardingCompleted: () => posthog.capture('onboarding_completed'),

  // Discovery / home
  surfacedCardSkipped: (targetId) => posthog.capture('surfaced_card_skipped', { targetId }),
  compatPanelOpened: (targetId, score) => posthog.capture('compat_panel_opened', { targetId, score }),
  connectionSent: (targetId) => posthog.capture('connection_sent', { targetId }),
  connectionAccepted: (connectionId) => posthog.capture('connection_accepted', { connectionId }),
  connectionDeclined: (connectionId) => posthog.capture('connection_declined', { connectionId }),

  // Search
  searchPerformed: (query, resultCount) => posthog.capture('search_performed', { query, resultCount }),
  searchResultViewed: (targetId, rank) => posthog.capture('search_result_viewed', { targetId, rank }),

  // Inbox / messaging
  inboxOpened: () => posthog.capture('inbox_opened'),
  conversationOpened: (conversationId) => posthog.capture('conversation_opened', { conversationId }),
  messageSent: (conversationId) => posthog.capture('message_sent', { conversationId }),

  // Profile views
  profileViewed: (targetId, context) => posthog.capture('profile_viewed', { targetId, context }),

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
