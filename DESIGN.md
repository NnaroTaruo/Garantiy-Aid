---
name: GarantiyAid
description: The implemented Figma-led mobile beneficiary interface.
colors:
  primary: "#155596"
  onPrimary: "#FFFFFF"
  primarySoft: "#EAF3FF"
  navy: "#101F35"
  green: "#117D65"
  greenSoft: "#DDF9EC"
  surface: "#F8FAFC"
  card: "#FFFFFF"
  text: "#172233"
  muted: "#596575"
  outline: "#DDE3EA"
  amber: "#8C6414"
  amberSoft: "#FFF6D9"
  error: "#B3313D"
  errorSoft: "#FFF0F1"
typography:
  display:
    fontFamily: "Inter_700Bold"
    fontSize: "36px"
    lineHeight: "43px"
    letterSpacing: "-1px"
  headline:
    fontFamily: "Inter_700Bold"
    fontSize: "24px"
    lineHeight: "30px"
    letterSpacing: "-0.5px"
  title:
    fontFamily: "Inter_700Bold"
    fontSize: "18px"
    lineHeight: "24px"
  body:
    fontFamily: "Inter_400Regular"
    fontSize: "14px"
    lineHeight: "21px"
  label:
    fontFamily: "Inter_600SemiBold"
    fontSize: "14px"
    lineHeight: "20px"
  small:
    fontFamily: "Inter_400Regular"
    fontSize: "12px"
    lineHeight: "18px"
  input:
    fontFamily: "Inter_400Regular"
    fontSize: "16px"
rounded:
  control: "14px"
  card: "16px"
  notice: "12px"
  badge: "15px"
  language: "28px"
  icon-button: "24px"
spacing:
  tight: "4px"
  compact: "8px"
  row: "12px"
  section: "16px"
  card: "18px"
  page: "20px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.onPrimary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  button-green:
    backgroundColor: "{colors.green}"
    textColor: "{colors.onPrimary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  button-white:
    backgroundColor: "{colors.card}"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  field:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    typography: "{typography.input}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
    padding: "{spacing.card}"
  notice-info:
    backgroundColor: "{colors.primarySoft}"
    textColor: "{colors.primary}"
    typography: "{typography.small}"
    rounded: "{rounded.notice}"
    padding: "14px"
  badge-success:
    backgroundColor: "{colors.greenSoft}"
    textColor: "{colors.green}"
    rounded: "{rounded.badge}"
    padding: "4px 9px"
  language-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.onPrimary}"
    rounded: "23px"
    padding: "0 10px"
  bottom-navigation:
    backgroundColor: "{colors.card}"
    textColor: "{colors.muted}"
    padding: "8px 0"
  schedule-card:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.onPrimary}"
    rounded: "22px"
    padding: "{spacing.card}"
  progress:
    backgroundColor: "{colors.outline}"
    rounded: "3px"
    height: "6px"
    width: "100%"
  radio-choice:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    typography: "{typography.small}"
    rounded: "{rounded.control}"
    padding: "0 12px"
  radio-choice-selected:
    backgroundColor: "{colors.primarySoft}"
    textColor: "{colors.primary}"
    typography: "{typography.small}"
    rounded: "{rounded.control}"
    padding: "0 12px"
---

# Design System: GarantiyAid

## Overview

**Creative North Star: "User-pinned GarantiyAid mobile reference"**

The visual authority is the user's [GarantiyAid Figma mobile design](https://www.figma.com/design/tZEG9H4ZRsP86KvhBjtd3X/Garantiy-Aid?node-id=0-1). The implemented interface uses pale screens, navy and dark text, rounded blue actions, green verification feedback, and compact outlined forms. This is a descriptive record of that existing direction, without a new identity or creative metaphor.

This record covers the React Native + Expo code under `mobile/`. The native theme and reusable components are the token sources; Home, Help, entry screens, and the Expo Tabs configuration supply component and layout evidence. The app entry now opens directly on the first account-creation step. Inter and the recreated shield are implementation approximations because precise Figma font metadata and original downloadable mark assets were unavailable.

Frontmatter lengths use portable CSS `px` notation for the corresponding numeric React Native style values. Native geometry uses density-independent layout units (dp); text uses React Native `fontSize`, `lineHeight`, and `letterSpacing` values subject to native font scaling. These are not physical screen pixels or a promise of identical rendering across platforms. Sidecar HTML/CSS translates components for the design panel; it is illustrative and is not native runtime code. The account-creation source findings have a ship disposition after Unicode-aware validation, live-language boolean errors, a labeled radio group, and assertive field errors were verified. Browser and native-device visual approval for this change remain unavailable.

**Key Characteristics:**

- Pale neutral screens with white outlined containers.
- Blue task actions and green verification feedback.
- Compact Inter typography with prominent queue and balance numbers.
- Rounded controls, a four-step account flow, and four bottom destinations.
- Visible prototype disclosures beside simulated data and interactions.

## Colors

The theme combines a deep blue primary, a restrained green secondary, and pale neutral surfaces; amber and red communicate feedback.

### Primary

- **Claim blue** (`primary`): primary buttons, active navigation, the appointment and wallet cards, and user chat bubbles.
- **Pale blue** (`primarySoft`): informational notices, icon surfaces, and pressed menu rows.
- **White on blue** (`onPrimary`): text and icons on filled blue or green actions.

### Secondary

- **Verification green** (`green`): successful states, face enrollment completion, and the help quick action.
- **Pale verification green** (`greenSoft`): success notices, badges, and soft icon backgrounds.

### Neutral

- **Shield navy** (`navy`): the recreated brand mark and dark camera screen.
- **Pale screen** (`surface`): page and navigator scene backgrounds.
- **White container** (`card`): cards, input interiors, language control, and bottom navigation.
- **Dark reading text** (`text`): body copy, headings, and values.
- **Muted slate** (`muted`): supporting text, placeholders, and inactive tab icons and labels.
- **Quiet outline** (`outline`): container and field borders and navigation separators.

### Feedback

- **Amber ink / pale amber** (`amber`, `amberSoft`): upcoming, pending, action-needed, and simulation warnings.
- **Error red / pale error** (`error`, `errorSoft`): error notices, validation text, and invalid field borders.

**The Paired Feedback Rule.** Notice and badge states pair their tone's ink with its pale background and a readable text label.

## Typography

**Display, body, and label font:** Inter, loaded through Expo Google Fonts as regular, medium, semibold, and bold aliases. Native styles select the weight through the font alias rather than a separate `fontWeight` declaration. The web panel uses `Inter, sans-serif` and numeric CSS weights as a translation; the panel snippet alone does not load the Expo font assets.

The hierarchy is compact and task-oriented. Bold headings distinguish steps and sections; large numerals emphasize the queue number and balance. There is no mathematical scale ratio in the implementation.

### Hierarchy

- **Display** maps to native `number`: queue and balance emphasis, with tight tracking.
- **Headline** maps to native `title`: entry and detail page headings.
- **Title** maps to native `heading`: beneficiary name and section emphasis.
- **Body** maps to native `body`: descriptions and explanatory content.
- **Label** maps to native `label`: field labels, buttons, and important values.
- **Small** maps to native `small`: supporting descriptions, notices, badges, and chat content.
- **Input** reflects the reusable field's larger editable text. The Help composer uses a separate body-sized input.

Navigation uses medium Inter (11 native font-size units). Screen-specific overrides exist in the source; they are not an additional general type scale. In particular, the appointment captions and compact staff label are not a pattern for future page headings.

**The Alias Weight Rule.** Use the exported Inter font aliases for native regular, medium, semibold, and bold text.

## Layout

Pages are vertically scrolling phone layouts with safe areas. Shared page content uses page padding and section gaps; cards have their own padding and gaps. Common rows use horizontal flex layout, row spacing, and flexible text columns. Shared headers have a minimum height (64 dp) with horizontal padding (16 dp); footer actions use page padding and a smaller top inset (8 dp).

The initial route renders account creation step 1 directly. Registration then moves through personal information, address, mobile number, and OTP verification. Each registration screen shows a four-step progress treatment with a small text row, a 6 dp outlined track, and a blue fill whose percentage follows the active step. Personal and address fields are grouped in white outlined cards with a tighter local gap (14 dp). Radio choices wrap when the phone width requires it.

Home's identity row can wrap when space is constrained. The three quick actions share available width. Help uses a scrolling conversation, a separate composer, and wrapping suggested-question buttons at roughly half-row widths (`45%` minimum, `48%` maximum). Chat bubbles cap their width (`88%`). These are observed component behaviors rather than site-wide breakpoints.

The actual four-destination navigation is Expo Router Tabs in `mobile/app/(tabs)/_layout.tsx`. Its bar has a minimum height (68 dp), top padding (8 dp), and bottom padding equal to the greater of the safe-area inset or (8 dp). It hides when the keyboard is shown. The exported `BottomLinks` component is a separate reusable rendition and is not the active tab navigator.

The web preview centers the app at a maximum width (430 CSS px) on an outer neutral canvas. This cap and canvas color exist only on web; native fills the available width. No tablet layout or responsive breakpoint scale has been established.

**The Phone Flow Rule.** Keep the native content in its safe-area, scrolling phone flow; the Figma device housing and annotations are not app chrome.

## Elevation & Depth

The inspected components use flat tonal layering and thin borders rather than custom shadows. White cards separate from the pale page through outlines; the blue appointment card has a lighter internal queue panel. The receipt modal uses a translucent navy scrim (`rgba(16,31,53,.45)`) to separate the dialog from its background. Default native navigator behavior is retained; no custom elevation scale is established.

**The Tonal Container Rule.** Separate the observed containers with their background tones and thin borders; do not infer a shadow scale from the preview.

## Shapes

Controls have gently rounded corners, with the shared field and button using the same control radius. Cards are slightly broader. Notices and badges use their dedicated radii. The language selector is a pill with a smaller rounded selected segment (23 dp) inside a padded outlined shell. Icon buttons are circular touch areas (48 dp square).

Screen-specific silhouettes remain component facts: the appointment card has broader corners (22 dp), face-login and receipt containers use (20 dp), and the camera framing includes an oval guide. These should not replace the shared control/card tokens.

## Components

### Buttons

Rounded, centered task controls with label typography, an optional line icon (18 dp), and a minimum touch height (48 dp).

- **Primary:** blue fill and white text.
- **Outline:** transparent fill, blue text, and a thin blue border (1 dp).
- **Green:** verification-green fill and white text.
- **White:** white fill and blue text, including actions on the dark capture screen.
- **States:** native `Pressable` lowers opacity while pressed (`0.8`), and disabled/loading controls use reduced opacity (`0.5`). Loading replaces the optional icon with an activity indicator. No bespoke native hover or focus style is implemented.

### Inputs / Fields

Outlined white text fields with dark input text, muted placeholders, a shared control radius, and a minimum height (52 dp). Labels sit above the field with a compact gap (8 dp). Error state changes the border to error red and adds an assertive alert below; the input's accessible label and hint also include the current, translated correction. Boolean error state lets language changes render the current English/Bisaya message. Names and places accept Unicode letters and ordinary punctuation; the optional middle name is validated by the same name rule only when supplied. The phone field pairs a separate `+63` container with a blue-bordered editable field. OTP is a separate six-box pattern driven by one overlaid native text input; it is not six independent fields.

### Cards / Containers

White rounded containers with a thin quiet outline (1 dp), shared card padding, and internal spacing. Personal-information and address cards use a local 14 dp gap and begin with a 38 dp pale-blue circular section icon beside the section label. Menus and transaction cards reduce vertical padding locally. Info/warning/success/error notices use paired tonal backgrounds, a small line icon, and small text. They are flat containers.

### Chips / Badges

Language is a two-option control whose selected segment uses blue with white semibold small text; each option has a minimum touch size (48 dp). Status badges are compact, non-interactive labels with medium small text and tone-paired colors. Help's suggested questions are outlined white buttons with a minimum height (48 dp), not passive badges.

### Navigation

Home, Wallet, Help/Tabang, and Profile occupy four equal tab destinations. The actual Expo tab navigator uses blue active tint, muted inactive tint, medium compact labels, a white bar, and an outline at its top. Header back controls use a circular touch area and a line arrow. Brand and navigation icons use vector components rather than text glyphs.

### Registration Progress

The account flow uses the same four-step indicator on personal information (25%), address (50%), mobile number (75%), and OTP verification (100%). A translated step label and numeric percentage sit above a thin outlined track. The blue fill clips within the 3 dp rounded track and is proportional to the current step. Login verification uses a text label instead of registration progress.

### Radio Choices

The sex field is a labeled native radio group containing Female, Male, and Prefer not to say. Each choice has a minimum height (48 dp), control-radius corners, horizontal padding (12 dp), an 18 dp radio ring, and a 9 dp inner dot when selected. Selection changes the outline and background to primary blue and pale blue. The group exposes a translated accessible label, each item exposes radio role and checked state, and the missing-choice error is an assertive translated alert.

**The Live Error Rule.** Store field validity separately from translated copy, then expose the active-language correction through the control label or hint and an assertive alert.

### Saved Notification Preferences

The shared-backend settings screen groups enrollment, schedule, and claim/release updates in the existing outlined card. Each entire row is one accessible switch with a minimum height (48 dp), a localized English/Bisaya label, and checked/disabled state. The native `Switch` is a decorative indicator hidden from accessibility and pointer interaction; the row owns activation. Its track uses the existing primary/outline colors and its thumb uses the card color.

Changes remain a draft until **Save preferences** succeeds. Rows are disabled while loading or saving, and Save is unavailable when nothing has changed. A failed save retains the visible draft and offers another save attempt. Loading, error, and saved confirmation notices use polite live regions with localized copy and the existing notice tones; a failed initial load provides **Try again**.

Saved choices control future generated `IN_APP` enrollment, schedule, and claim messages; existing saved messages remain available. SMS reminders and phone push alerts are inactive, and sign-in codes are unaffected. Browser-rendered React Native web evidence is under `.tmp/notification-preferences-ui-review/`; it does not establish physical Android or TalkBack validation.

### Appointment Card

A blue schedule container combines the appointment program/date/time, a status badge, a lighter blue queue/venue panel, and a QR action. The large queue numeral is its strongest information hierarchy. The queue panel and QR action retain local blue shades from `mobile/src/screens/main.tsx`; they are signature-component styling, not new global palette tokens. The status label responds to the preview session's claim state.

### Help Conversation

Assistant messages use white outlined bubbles and a small line icon; user messages align right and use blue filled bubbles with white text. The composer remains below the scrolling messages with a rounded outlined input and circular send control. Sending is disabled for blank input. Responses are local scripted samples; claim-status text reads the same session claim state as Home and Wallet.

### Panel Translations

`.impeccable/design.json` contains self-contained HTML/CSS previews of the native components. CSS focus outlines and hover/active interaction in those snippets exist for panel usability and are not evidence of implemented native focus/hover states. Generated tonal strips are panel metadata, not extra app colors. The snippets illustrate current values without replacing the native component source.

## Do's and Don'ts

### Do:

- **Do** preserve the user's blue/green Figma identity and recreate screen content inside the device frame.
- **Do** use native theme tokens and exported Inter aliases for repeated controls and text roles.
- **Do** keep state labels readable alongside their paired feedback colors.
- **Do** preserve safe-area spacing, scrollable content, and the four implemented tab destinations.
- **Do** keep prototype disclosures visible wherever the interface presents simulated claims, messages, or wallet data.
- **Do** keep registration at four visible steps and group personal and address fields in the established outlined cards.
- **Do** validate names and places with Unicode-aware letter rules and derive visible errors from boolean state so language changes update them.

### Don't:

- **Don't** present the recreated shield or assumed Inter family as an exact original Figma asset match.
- **Don't** treat web-only framing, synthesized tonal ramps, or panel CSS interaction states as native implementation tokens.
- **Don't** promote the appointment caption treatment or compact staff label into a general heading style.
- **Don't** describe the browser review disposition as native-device approval or backend readiness.
- **Don't** communicate a radio or field error through border color alone; retain labels, checked state, hints, and assertive translated error text.
