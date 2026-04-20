# Supercharged — Inbox & Chat Feature Summary

A mobile-first professional networking inbox. Single React component, scoped CSS, no external UI libraries. The interface prioritises human relationship-building over volume messaging — every screen is designed around the question "what should I do next with this person?"

---

## Design system

- **Typography:** Playfair Display 300 for emotional/editorial moments (screen title, match summaries, AI draft text, notes); DM Sans 400/500/600 for all UI chrome
- **Palette:** warm white background `#FFFEFD`, deep charcoal text `#1A1A1A`, yellow accent `#F5C842` reserved for the three AI moments only (logo bolt, AI orb, primary AI pill), with a supporting colour system for relationship signals (blue `#5B8CF5`, teal `#3DAA82`, purple `#9B7CF6`, amber `#E8A94A`)
- **Borders:** all interactive elements use `1.5px solid #1A1A1A` — no grey borders on buttons, inputs, or chips; grey `#DDDBD8` is reserved for non-interactive dividers
- **Shape:** pill buttons (`border-radius: 999px`) everywhere, `14px`/`18px` for cards, fully rounded `22px` for message bubbles with no sharp tail corners
- **Motion:** `cubic-bezier(0.16, 1, 0.3, 1)` for all screen transitions and sheets; subtle `0.18s ease` for chip selection and hover states

---

## Inbox screen

### Header

- Playfair 300 "Inbox" title
- Notification bell with a yellow pip when unread nudges exist; tapping opens a dropdown panel anchored to the bell (not a new screen) — contains up to three relationship nudges with "Draft ›" CTAs, a "Mark all read" link, and empty state "No new nudges — you're on top of it"
- Full-width search pill with black outline

### Filter chips

Three chips with live count badges that reflect current state:

- **All** — red badge showing unread count (acts as a total-alert)
- **Unread** — red badge showing unread conversation count
- **New** — green badge showing first-time-contact count (signals opportunity, not alert)

Active chip: filled black. Badges use `2.5px` white knockout border so they always pop against any background.

### Today's Moves (pinned, horizontal scroll)

AI-selected daily relationship actions shown above the conversation list. Each card contains a 24px avatar + name/role, a one-line reason ("Replied yesterday — good moment to move forward"), and a "Draft with AI" button that routes straight to chat with the AI sheet pre-opened. Section label has a small black count badge (task count, not alert).

### Conversation list

Stripped, clean rows — the spec went through multiple revisions here, settling on:

- Unread dot (absolute left, 6px)
- 46px vibrant avatar
- Name (600 if unread, 500 if read)
- Role · Company (small grey)
- Preview in `"double quotes"` (weight 600 if unread, 400 grey if read)
- Right meta: timestamp + black unread count circle

No stage pills, momentum arrows, reason tags, or signal dots in the list — those all moved into the context drawer to keep the row rhythm quiet. The only row-level urgency signal is the going-cold avatar desaturation (`saturate(0.2)` with a 1.5s transition) for conversations with no activity for 7+ days.

Rows for "Needs attention" (cold or stale) appear at the top of the list but use identical formatting — position alone signals priority.

### New tab — profile-first card feed

When the user switches to the New tab, the layout changes completely. New connections are people who've sent an opening message but haven't heard back — the user is deciding whether to engage, so context comes first.

Each card shows:

- Avatar + name/role + **compatibility score badge** (colour-tiered: green pill ≥85%, amber 70–84%, grey <70%)
- Their opening message in a mini-bubble with 2-line truncation and ellipsis
- Signal dots (relevant ones only) + dual CTAs: "Reply with AI" (yellow, opens preview + AI sheet) · "Open" (outlined, opens preview)

### Dot legend (first-visit overlay)

On first inbox load, a tappable-to-dismiss card explains what the four signal dot colours mean. Only shown once (localStorage flag in the original HTML; in-memory in React to respect artifact storage rules).

---

## Chat screen

### Header

- Back button, avatar, name, role
- **Drawer hint** — a prominent outlined pill (black border, two-bar-and-chevron glyph) with a 44px transparent hit area; tapping opens the context drawer. More discoverable than the subtle grey marker it replaced
- **Relationship progress bar** — five-segment indicator (Cold outreach → First reply → Call booked → Coffee done → Introduction) with labels for current/next stage below
- **Context chips** — tappable pills ("Both LSE", "AI infra focus", "Mutual at Index", "Seed stage"). Each opens a small explanation card with a conversation-ready talking point

### Message thread

- **Inbound bubbles:** warm cream `#F0EDE8`, fully rounded
- **Outbound bubbles:** deep charcoal `#1A1A1A`, fully rounded, white text
- All blue removed from bubbles and receipts — read receipts are muted grey (`#6B6B6B` for "Read", `#AFAFAF` for "Delivered")
- Delivered → Read transitions automatically 2s after send to simulate realism

### AI suggest strip (above input)

- **Primary yellow pill** always leftmost — context-aware label ("Confirm time" / "Follow up" / "Acknowledge"); opens the AI assist sheet
- **Secondary outlined pills** pre-fill the input with specific, on-brand replies ("Ask about the B2B angle", "Suggest Thursday 2pm", "Send the deck")

### Input bar

- **AI orb** (left, yellow bolt) — opens the assist sheet
- **Input pill** — mic + image + plus icons live inside the right end of the pill at rest; when the user taps or types, the icons fade to 0 and a blue send button fades in at their place (disabled at 30% opacity, 100% once text is present)
- Enter or send button submits; a new bubble appears with a Delivered → Read receipt

### AI assist sheet (bottom sheet)

Slides up from the bottom with overlay. Contains:

- **Suggested draft** in Playfair 300 17px — intentionally editorial, making AI-composed words feel considered rather than machine-generated
- **Tone selector** — Warm / Direct / Curious / Confident, each with its own signature colour when active (amber / black / blue / green)
- **"Tell the AI what to say"** freeform input in Playfair
- Regenerate + **Use this draft** buttons — Use fills the input and closes the sheet; sending from that state counts as using an AI draft for the voltz system

### Context drawer (right-swipe or hint pill)

Sits over the chat with overlay. Scrollable, designed as the person's living profile:

1. **Match** — Playfair 300 22px plain-language summary ("Strong match — shared VC network, both focused on AI infrastructure, one mutual connection at Index") + stage pill on its own line below
2. **Relationship strength** — giant Playfair 300 48px score (0–100), "Growing" status pill, and three sub-metrics (Last contact / Exchanges / Response rate). Below: "This relationship has earned you X voltz" in yellow-bronze
3. **Breakdown** — four horizontal bars, each coloured per dimension: Background (blue), Goals (teal), Network fit (purple), Stage align (amber). Value numbers colour-match their bars
4. **Relationship over time** — SVG line chart in a card. Smooth bezier line through five data points. Points are coloured by event type: Outreach (blue), Replied (teal), Warm (amber), intermediate (light grey), Now (large black). Area fill uses an amber gradient. Grid lines are tinted per-threshold (blue 75, teal 50, amber 25). A "72" label sits above the most recent point. Below the chart: a transition chip row (Outreach sent → Replied → Warm) with matching coloured dots
5. **Signals** — 2×2 grid of dot-label pairs (Compatibility match / Shared background / Network fit / Recently active) — the full legend visible in context
6. **Outreach** — vertical timeline of events with coloured dots
7. **Relationship** — five milestones (Cold outreach ✓ → First reply ✓ → Call booked pending → Coffee done locked → Introduction locked) with tinted tile icons, no borders
8. **Suggested next step** — bordered card with bolt icon, recommendation text, and "Draft confirmation ›" CTA that opens the AI sheet with the relevant draft pre-loaded
9. **Notes** — post-meeting capture log in Playfair 300 for the human-written feel

---

## New connection preview / request state

When the user taps a new connection card, the chat view loads in a **preview state** — not a normal conversation yet:

- **Amber banner** at the top: eye-slash icon + "They can't see you've opened this yet. Accept to start the conversation." — privacy reassurance, a small but important trust signal
- **Thread** shows only their opening message, bubble rendered normally
- **"You haven't replied yet"** caption below the message
- **Accept / Decline bar** replaces the input bar. Accept is full-width black, Decline is outlined auto-width — asymmetric weights nudge toward acceptance without forcing it

**On Accept:** banner + request bar disappear, "Conversation accepted · Just now" timestamp appears, the AI strip and input bar slide in, a +5 voltz toast fires, the card is removed from the New feed with a fade-out.

**On Decline:** an inline "Removed from new connections" line appears with an Undo link; after 3 seconds the card is removed and the chat closes. Undo within that window restores everything.

---

## Voltz reward system

Background gamification tied to relationship events. No dedicated UI beyond a black toast pill that slides in from the top of the chat screen:

| Event | Voltz |
|---|---|
| Message sent | +2 |
| Reply received / new connection accepted | +5 |
| 5-exchange milestone | +10 |
| 10-exchange milestone | +15 |
| Nudge responded | +8 |
| Call booked | +25 |
| Coffee arranged | +20 |
| Introduction made | +30 |
| AI draft used | +3 |
| Stage advanced | +12 |

Toasts stagger automatically (900ms between) when multiple events fire in sequence (e.g. sending a message from a draft = +3 voltz followed by +2 voltz). Running total is surfaced in each person's drawer ("This relationship has earned you X voltz"), connecting the abstract points back to real human connections.

---

## Interaction highlights

- **First-visit dot legend** teaches the signal system once, then disappears forever
- **Notifications panel** is an anchored dropdown, not a new screen — stays contextual
- **Filter chip badges** use a white knockout border so they float cleanly above any background and never clip
- **Row press states** are instant (no transition) so the list feels native-speed
- **Preview state** for new connections is a distinct mode — the UI physically swaps (request bar instead of input bar, amber banner instead of progress) to make the "deciding" vs "engaged" distinction clear
- **Draft CTAs** from Today's Moves, notification items, and the drawer's "Suggested next step" all route through the same `openChat + openSheet` flow, so the user lands exactly where they can take action
- **Going-cold desaturation** on the avatar is the sole piece of inline urgency styling — everything else that might signal urgency lives inside the drawer, keeping the list visually quiet

---

## React architecture notes

- Single `SuperchargedInbox` default export with the full component tree inside
- State kept flat in the root; passed down as props. Sub-components (`Inbox`, `Chat`, `ContextDrawer`, `AISheet`, etc.) are presentational
- CSS scoped via `.sc-` prefix inside a single `<style>` block, imports Google Fonts at the top. No Tailwind dependency — the design system is specific enough that utility classes would have added noise
- All data (conversations, new connections, notifications, messages, chip tooltips, AI fills, voltz event values) lives in named constants at the top of the file, easy to swap for live data
- Voltz earning uses a ref-based queue so rapid-fire events stack their toasts rather than overwriting
- No localStorage — the artifact runtime doesn't support it. Voltz total and legend-seen state live in component state (resets on page reload, which is fine for a demo)
