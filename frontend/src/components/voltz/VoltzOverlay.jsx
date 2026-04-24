import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { account, tables, DB_ID, PROFILES_TABLE } from "../../lib/appwrite";
import { track, captureError } from "../../lib/tracking";
import { C } from "./shared/designTokens";
import VoltzHomeScreen    from "./VoltzHomeScreen";
import UsageScreen        from "./UsageScreen";
import PlansScreen        from "./PlansScreen";
import GetMoreScreen      from "./GetMoreScreen";
import CheckoutScreen     from "./CheckoutScreen";
import ConfirmationScreen from "./ConfirmationScreen";
import SettingsScreen     from "./SettingsScreen";
import ChangePasswordScreen from "./ChangePasswordScreen";

// Navigation level determines slide direction
const LEVEL = {
  home:            0,
  usage:           1,
  plans:           1,
  "get-more":      1,
  settings:        1,
  "change-password": 2,
  checkout:        2,
  confirmation:    3,
};

function getTranslateX(screenKey, currentKey) {
  const sl = LEVEL[screenKey] ?? 0;
  const cl = LEVEL[currentKey] ?? 0;
  if (screenKey === currentKey) return "0%";
  if (sl < cl) return "-30%";
  return "100%";
}

export default function VoltzOverlay({
  open,
  onClose,
  profile,
  onProfileUpdate,
  initialScreen,
  initialResult,
}) {
  const [screen,          setScreen]          = useState(initialScreen || "home");
  const [checkoutContext, setCheckoutContext] = useState(null);
  const [checkoutFrom,    setCheckoutFrom]    = useState("get-more");
  const [confirmResult,   setConfirmResult]   = useState(initialResult || null);

  // Derive active plan from subscription ID stored on profile
  // We can't reliably map sub ID→plan tier client-side, so we derive from profile field if available,
  // or fall back to the stripe_subscription_id being set at all.
  const activePlan = profile?.active_plan
    || (profile?.stripe_subscription_id
        ? (profile?.stripe_subscription_id?.includes?.("luminary") ? "luminary" : "zenith")
        : null);

  // Debounced notification pref saver
  const notifDebounce = useRef(null);
  const handleSaveNotifPrefs = useCallback((prefs) => {
    if (!profile?.$id) return;
    Object.entries(prefs).forEach(([key, value]) => {
      if (key.startsWith('notify_')) {
        track.voltzNotificationPrefChanged(key, value);
      }
    });
    clearTimeout(notifDebounce.current);
    notifDebounce.current = setTimeout(async () => {
      try {
        const updated = await tables.updateRow({
          databaseId: DB_ID,
          tableId: PROFILES_TABLE,
          rowId: profile.$id,
          data: prefs,
        });
        if (onProfileUpdate) onProfileUpdate({ ...profile, ...prefs });
      } catch (err) {
        captureError(err, { context: 'save_notification_prefs', prefs });
      }
    }, 500);
  }, [profile, onProfileUpdate]);

  // Reset to home when overlay opens, unless we have an initialScreen
  useEffect(() => {
    if (open) {
      setScreen(initialScreen || "home");
      setConfirmResult(initialResult || null);
      if (!initialResult) setCheckoutContext(null);
    }
  }, [open]);

  const navigate = (dest) => {
    track.voltzScreenView(dest);
    setScreen(dest);
  };

  const goBack = () => {
    const backMap = {
      usage:             "home",
      plans:             "home",
      "get-more":        "home",
      settings:          "home",
      "change-password": "settings",
      checkout:          checkoutFrom,
      confirmation:      "home",
    };
    const dest = backMap[screen] || "home";
    track.voltzScreenView(dest);
    setScreen(dest);
  };

  const openCheckout = (context, from) => {
    track.voltzPurchaseInitiated(context?.item?.id, context?.item?.price);
    setCheckoutContext(context);
    setCheckoutFrom(from);
    setScreen("checkout");
  };

  const handleSignOut = async () => {
    try {
      track.voltzSignedOut();
      await account.deleteSession("current");
    } catch (err) {
      captureError(err, { context: 'sign_out' });
    }
    onClose();
    window.location.reload();
  };

  const voltzBalance = profile?.current_voltz ?? 0;

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            // Stop above the bottom nav bar — the nav uses calc(safe-area + 112px)
            // We cover from top to bottom of the nav, leaving nav visible beneath
            bottom: 0,
            zIndex: 150,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          {/* Backdrop */}
          <Motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: "absolute", inset: 0,
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(2px)",
            }}
          />

          {/* Panel — slides up from bottom, stops above nav bar */}
          <Motion.div
            key="panel"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
            style={{
              position: "relative",
              zIndex: 1,
              background: C.bg,
              borderRadius: "20px 20px 0 0",
              overflow: "hidden",
              // Height: fill from bottom of status bar to just above bottom nav
              // The nav bar is at bottom-4 with height ~60px + safe area ~34px = ~112px
              height: "calc(100dvh - 112px)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Close handle */}
            <div style={{
              display: "flex", justifyContent: "center",
              padding: "12px 0 4px 0", flexShrink: 0,
            }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.15)" }} />
            </div>

            {/* Screen area — position relative so screens can stack */}
            <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
              {[
                "home",
                "usage",
                "plans",
                "get-more",
                "settings",
                "change-password",
                "checkout",
                "confirmation",
              ].map(key => {
                const tx = getTranslateX(key, screen);
                const isVisible = tx === "0%";
                return (
                  <div
                    key={key}
                    style={{
                      position: "absolute", inset: 0,
                      transform: `translateX(${tx})`,
                      transition: "transform 0.32s cubic-bezier(0.4, 0, 0.2, 1)",
                      pointerEvents: isVisible ? "auto" : "none",
                      overflow: "hidden",
                      background: C.bg,
                    }}
                  >
                    {key === "home" && (
                      <VoltzHomeScreen
                        profile={profile}
                        voltzBalance={voltzBalance}
                        activePlan={activePlan}
                        onBack={onClose}
                        onGetMore={() => navigate("get-more")}
                        onPlans={() => navigate("plans")}
                        onSettings={() => navigate("settings")}
                        onUsage={() => navigate("usage")}
                      />
                    )}

                    {key === "usage" && (
                      <UsageScreen
                        profile={profile}
                        onBack={goBack}
                        onTopUp={() => navigate("get-more")}
                      />
                    )}

                    {key === "plans" && (
                      <PlansScreen
                        profile={profile}
                        activePlan={activePlan}
                        voltzBalance={voltzBalance}
                        onBack={goBack}
                        onSelectPlan={(plan) => openCheckout({ type: "plan", item: plan }, "plans")}
                      />
                    )}

                    {key === "get-more" && (
                      <GetMoreScreen
                        profile={profile}
                        activePlan={activePlan}
                        onBack={goBack}
                        onBuyPack={(pack) => openCheckout({ type: "voltz", item: pack }, "get-more")}
                        onSelectPlan={(plan) => openCheckout({ type: "plan", item: plan }, "get-more")}
                      />
                    )}

                    {key === "settings" && (
                      <SettingsScreen
                        profile={profile}
                        onBack={goBack}
                        onChangePassword={() => navigate("change-password")}
                        onSignOut={handleSignOut}
                        onSaveNotifPrefs={handleSaveNotifPrefs}
                      />
                    )}

                    {key === "change-password" && (
                      <ChangePasswordScreen onBack={goBack} />
                    )}

                    {key === "checkout" && checkoutContext && (
                      <CheckoutScreen
                        context={checkoutContext}
                        userId={profile?.user_id}
                        onBack={goBack}
                      />
                    )}

                    {key === "confirmation" && (
                      <ConfirmationScreen
                        result={confirmResult}
                        voltzBalance={voltzBalance}
                        onHome={() => { onClose(); }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </Motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
