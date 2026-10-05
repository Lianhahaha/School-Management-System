---
name: Skole
description: A calm school workspace where one warm yellow highlighter marks the thing to do and the thing happening now.
colors:
  canvas: "#f3f3f1"
  surface: "#ffffff"
  gray-100: "#ebebe8"
  gray-200: "#e2e2de"
  gray-300: "#d0d0cb"
  gray-400: "#a3a3a6"
  gray-500: "#636368"
  gray-600: "#56565b"
  gray-700: "#3e3e43"
  gray-800: "#2a2a2e"
  ink: "#18181b"
  accent: "#ffc629"
  accent-hover: "#f5b800"
  accent-ink: "#1f1a05"
  accent-soft: "#fff2c7"
  accent-line: "#f0c64a"
  green-50: "#e9f6ee"
  green-600: "#2f9d5d"
  green-700: "#1f7444"
  amber-50: "#fbf1de"
  amber-500: "#d99a1e"
  amber-700: "#8a5a06"
  red-50: "#fcebeb"
  red-600: "#c8363b"
  red-700: "#b42a30"
  blue-50: "#e8f0fb"
  blue-600: "#3a72c9"
  blue-700: "#285aa6"
  violet-50: "#f1ebfb"
  violet-600: "#7c55c7"
  violet-700: "#6340a8"
  on-danger: "#ffffff"
  canvas-dark: "#17181b"
  surface-dark: "#202125"
  gray-100-dark: "#2a2b30"
  gray-200-dark: "#303137"
  gray-300-dark: "#3e3f46"
  gray-400-dark: "#6f7078"
  gray-500-dark: "#9d9ea5"
  gray-600-dark: "#b5b6bc"
  gray-700-dark: "#cbcbd0"
  gray-800-dark: "#dededf"
  ink-dark: "#ecece9"
  accent-hover-dark: "#ffd35a"
  accent-soft-dark: "rgb(255 198 41 / 0.14)"
  accent-line-dark: "rgb(255 198 41 / 0.55)"
  green-50-dark: "rgb(63 185 113 / 0.14)"
  green-600-dark: "#4cc27f"
  green-700-dark: "#7fd8a4"
  amber-50-dark: "rgb(240 178 50 / 0.15)"
  amber-500-dark: "#f0b232"
  amber-700-dark: "#f6cd78"
  red-50-dark: "rgb(255 99 105 / 0.14)"
  red-600-dark: "#ff6369"
  red-700-dark: "#ff8f93"
  blue-50-dark: "rgb(96 150 235 / 0.15)"
  blue-600-dark: "#6c9ff0"
  blue-700-dark: "#9dbff5"
  violet-50-dark: "rgb(160 125 235 / 0.16)"
  violet-600-dark: "#a98bf0"
  violet-700-dark: "#c6b2f6"
  on-danger-dark: "#2a0a0c"
typography:
  headline:
    fontFamily: "Onest, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
    fontFeature: "'cv11', 'ss01'"
  title-auth:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    letterSpacing: "-0.02em"
  title-dialog:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    letterSpacing: "-0.01em"
  wordmark:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
  body:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    fontFeature: "'cv11', 'ss01'"
  body-small:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
  label-table:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
  label:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
  label-tab:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
rounded:
  tag: "6px"
  control: "14px"
  tile: "20px"
  card: "22px"
  dialog: "28px"
  full: "9999px"
spacing:
  row-gap: "8px"
  sheet-padding: "20px"
  dialog-padding: "24px"
  header-gap: "28px"
  page-x-phone: "16px"
  page-x-tablet: "24px"
  page-x-desktop: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    padding: "0 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.gray-100}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "0 20px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.gray-200}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.gray-700}"
    rounded: "{rounded.full}"
    padding: "0 20px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.gray-100}"
    textColor: "{colors.ink}"
  button-danger:
    backgroundColor: "{colors.red-600}"
    textColor: "{colors.on-danger}"
    rounded: "{rounded.full}"
    padding: "0 20px"
    height: "44px"
  button-danger-hover:
    backgroundColor: "{colors.red-700}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
    height: "44px"
  input-search:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: "8px 14px 8px 40px"
    height: "44px"
  sheet:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "20px"
  stat-row:
    backgroundColor: "{colors.gray-100}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "8px 16px 8px 8px"
    height: "56px"
  stat-row-hover:
    backgroundColor: "{colors.gray-200}"
  badge:
    backgroundColor: "{colors.gray-100}"
    textColor: "{colors.gray-900}"
    typography: "{typography.label}"
    rounded: "{rounded.tag}"
    padding: "2px 8px"
  live-tag:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  nav-item:
    textColor: "{colors.gray-600}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    padding: "0 14px"
    height: "44px"
  nav-item-hover:
    backgroundColor: "{colors.gray-100}"
    textColor: "{colors.ink}"
  nav-item-active:
    textColor: "{colors.ink}"
  tab-bar:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.dialog}"
    padding: "0 6px"
    height: "56px"
  tab-bar-chip-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.full}"
    size: "48px x 32px"
  segmented-tabs:
    backgroundColor: "{colors.gray-100}"
    rounded: "{rounded.full}"
    padding: "4px"
  segmented-tab-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    height: "36px"
  theme-toggle:
    backgroundColor: "{colors.gray-200}"
    rounded: "{rounded.full}"
    width: "64px"
    height: "36px"
  modal:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.dialog}"
    padding: "24px"
  menu:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.tile}"
    padding: "6px"
---

# Design System: Skole

## Overview

**Creative North Star: "The Highlighter on a Calm Page"**

Skole is a working tool for administrators at a desk, teachers between lessons and students on phones. Every screen is a soft grey page with borderless white sheets laid on it, and almost everything on that page is quiet: ink text, grey pill rows, neutral status pills. One warm yellow cuts through, and it means exactly two things: the action to take (the primary pill button) and the thing that is current (the page you are on, today, the period running now). If you can see yellow, you know where to look.

The density is that of an operational app, not a marketing page: compact type at 15px, 44px touch targets, tables with tabular figures aligned right, and running totals beside headings so a list tells you its size without a stat tile. Shapes are generous and round (22px sheets, fully round buttons and rows), which keeps a dense screen soft. The dark theme is the same world at night: soft graphite rather than black, with the identical yellow and dark text on it.

The system deliberately avoids the stock admin template: no bordered cards, no wall of number tiles, no blue primary button.

**Key Characteristics:**
- Grey canvas, borderless white sheets, depth from tone instead of lines.
- One yellow accent, reserved for the primary action and for "you are here / now".
- A drawn highlighter stroke behind the current navigation label.
- Status as a small squared tag in three weights (filled, outline, tinted); the text carries the meaning, never a dot.
- Pills everywhere: buttons, nav items, filters, search, tabs, figure rows.
- One typeface (Onest, self-hosted), tabular figures for every number column.
- Two themes driven by one attribute; components never branch on the theme.

## Colors

A calm neutral ramp with a hint of warmth, one saturated yellow, and five muted status families that only ever appear small or softened.

### Primary
- **Highlighter Yellow** (`accent`): the primary button fill, the live tag ("Now", "Today"), the active phone tab chip, the skip link, the highlighter stroke behind the current nav label and the yellow band in the brand mark. Identical in both themes. Text on it is always **Pencil Black** (`accent-ink`), never white.
- **Pressed Yellow** (`accent-hover`): hover fill of yellow buttons; darker in light, lighter in dark (`accent-hover-dark`).
- **Yellow Wash** (`accent-soft`) and **Yellow Rim** (`accent-line`): the tinted background and inset ring of a period that is happening now, and the text selection colour. In dark they become translucent yellow (`accent-soft-dark`, `accent-line-dark`).

### Neutral
- **Paper Grey** (`canvas`): the page itself, the desktop sidebar and the translucent sticky top bar. It also sets the browser `theme-color`.
- **Sheet White** (`surface`): every content sheet, dialogs, menus, the phone tab bar, inputs, and the knob of the theme switch.
- **Pill Grey** (`gray-100`): secondary buttons, figure rows, segmented tab tracks, neutral status pills, period rows, skeletons, close buttons. `gray-200` is its hover and the theme switch track.
- **Rule Grey** (`gray-200` / `gray-300`): table row dividers (`gray-200`) and input borders and quiet link underlines (`gray-300`). `gray-400` is the hovered input border.
- **Muted Ink** (`gray-500` / `gray-600` / `gray-700`): placeholders, table headers, totals and hints (`gray-500`); descriptions and idle nav labels (`gray-600`); table cells and secondary text (`gray-700`).
- **Ink** (`ink`): headings, primary text, the focus ring, the brand tile, the focused input border.

### Status tones
Five families, each with a soft background (`-50`), a solid mark (`-600`) and a text colour (`-700`): **Leaf** green (present, active, success), **Ochre** amber (late, withdrawn, warning), **Brick** red (absent, error, destructive), **Slate Blue** blue (excused, completed, scheduled, info) and **Lilac** violet (administrator role). Grey is the sixth, neutral tone. Alerts, toasts, tinted icon chips and attention tags use the soft background with the text colour.

### Named Rules
**The One Yellow Rule.** Yellow means "act here" or "this is now". A screen carries one yellow button, or very few; the yellow tag is only for the current period or today's column, never for a plain status.

**The Ink-on-Yellow Rule.** Anything on yellow is set in `accent-ink`, in both themes, so the marked label always reads.

**The Three Weights Rule.** A status is a 6px-radius tag with a hairline inset edge, never a pill and never a dot. Filled grey is the normal on-state or a category (Active, Teacher, a class); a grey outline is off or secondary (Disabled, Not enrolled, Quiz); only attention states (amber, red) take colour, as the soft background with the text colour. A table full of statuses stays calm and the exceptions stand out.

**The Graphite, Not Black Rule.** Dark theme surfaces are graphite (`canvas-dark`, `surface-dark`), never pure black; sheets lose their shadow and separate by tone alone.

## Typography

**Display Font:** none; Skole has a single face.
**Body Font:** Onest (with ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif)

**Character:** Onest is a friendly geometric grotesque, self-hosted as a variable woff2 (weights 400 to 700, latin and latin-ext subsets, SIL Open Font License, `font-display: swap`, the latin file preloaded). It is set with the `cv11` and `ss01` alternates on the body. Hierarchy comes from size and weight (400, 500, 600) with tightened tracking on large headings; there is no uppercase or tracked-out label style.

### Hierarchy
- **Headline** (600, 1.75rem, tight leading, -0.025em, balanced wrap): the page title, one per page, with an optional running total beside it in 1.125rem `gray-500` tabular figures.
- **Title, auth** (600, 1.5rem, -0.02em): sign-in and registration headings; also large single figures inside a sheet.
- **Title, dialog** (600, 1.25rem, -0.01em): dialog titles. The wordmark uses the same size at -0.03em.
- **Title** (600, 1rem): sheet titles, with an optional running total in 0.875rem regular `gray-500`.
- **Body** (400, 0.9375rem): page descriptions, table cells, inputs, nav items, default buttons.
- **Body small** (400 or 500, 0.875rem): card descriptions, form labels (500, `gray-800`), alerts, small buttons, breadcrumbs.
- **Label, table** (500, 0.8125rem, `gray-500`): table column headers, sentence case.
- **Label** (500, 0.75rem): status pills, live tags, field hints and errors.
- **Label, tab bar** (500, 0.6875rem): the phone tab bar captions under their icons.

### Named Rules
**The Tabular Figures Rule.** Every number that sits in a column or beside a heading uses tabular figures: times, right-aligned table cells, running totals and figure-row values.

**The Running Total Rule.** Lists and sheets state their size as a quiet total beside the title ("128", "3 of 4 marked") instead of a separate stat tile.

## Layout

From the `lg` breakpoint (1024px) the shell is a 256px sidebar on the page tone (no frame, no shadow) beside the content column. The content column has a sticky 64px top bar (canvas at 85% opacity with a medium backdrop blur) holding the theme switch and the user menu, then `<main>` capped at 72rem and centred, with 40px side padding, 24px top and 48px bottom.

Every page opens with the same header: breadcrumbs on detail pages, the headline with its optional total and a one-line description on the left, the page's actions (usually its single yellow button) on the right, wrapping under the title on narrow screens; 28px below it the content begins. Content lives in sheets with 20px padding; list pages put a filter bar of pill-shaped search and selects above a table sheet. Figure rows and period rows stack 8px apart inside a sheet. Dashboards stack each column independently so sheets of different heights leave no gaps.

Below `lg` the sidebar becomes an off-canvas drawer (288px, white, pop shadow, behind a 40% ink scrim with a light blur) that slides in from the left, closes on Escape, scrim click or navigation, and is `invisible` while closed so its links leave the tab order. The top bar shows the brand mark and wordmark. Page padding drops to 24px (`sm`) and 16px (phone), and the bottom padding grows to 128px to clear the tab bar.

On phones a floating tab bar sits 12px from the screen edges (respecting the safe-area inset): a white bar with 28px corners and the pop shadow, holding the role's four main destinations and "More", which opens the drawer. Toasts stack above the tab bar on phones and in the bottom-right corner (384px wide) from `lg` up.

Tables drop secondary columns below a chosen breakpoint and scroll sideways inside their sheet when still too wide; the attendance and grade sheets are focusable scroll regions. Printing hides the sidebar, top bar and tab bar so only the page content prints.

Breakpoints are the defaults: `sm` 640px, `md` 768px, `lg` 1024px.

## Elevation & Depth

Skole is flat by default and gets its depth from tone: white sheets on a grey page, grey pills inside white sheets, white chips inside grey pills. Shadows exist in only two strengths and they carry meaning: a sheet shadow so faint it reads as a soft edge (and disappears entirely in dark), and a pop shadow for anything that floats above the page.

### Shadow Vocabulary
- **Sheet** (`box-shadow: 0 1px 2px rgb(24 24 27 / 0.04)`; `none` in dark): every content sheet.
- **Pop** (`box-shadow: 0 12px 32px -12px rgb(24 24 27 / 0.28), 0 2px 6px rgb(24 24 27 / 0.06)`; in dark `0 16px 40px -12px rgb(0 0 0 / 0.6), 0 0 0 1px rgb(255 255 255 / 0.06)`): dialogs, menus, toasts, the phone tab bar and the open drawer. In dark, the hairline white ring outlines the floating layer against graphite.
- **Knob** (`box-shadow: 0 1px 3px rgb(24 24 27 / 0.1)` to `0.2`): the white segment of the active tab and the theme switch knob, lifting a white chip off a grey track.

### Named Rules
**The Float Rule.** Only layers that float above the page (dialog, menu, toast, tab bar, drawer) take the pop shadow. Sheets never do.

## Shapes

The form language is round and soft. Everything a finger or pointer acts on is a full pill or a circle: buttons (icon-only buttons are circles of the same height), nav items, filter selects, the search box, tab segments, figure rows from `sm` up, status pills, live tags, skeleton bars and the theme switch. Containers step up in radius with their size and their distance from the page: 14px for text inputs and inline alerts, 20px for tiles inside a sheet (period rows, class chips, menus, toasts, compact empty states, figure rows on phones), 22px for sheets, 28px for dialogs and the floating tab bar. The brand tile uses 9px on a 32px square.

There are no borders on containers. Lines appear only where they carry information: input borders, table row dividers, link underlines, and the 2px inset ring that marks today's timetable column (yellow) or the current period (yellow rim).

The one deliberately irregular shape is the highlighter stroke: a yellow band with unequal elliptical corners (`0.35em 0.9em 0.45em 1.1em / 0.6em 0.35em 0.75em 0.45em`), rotated -2 degrees and skewed -10 degrees, so it reads as a chisel-tip marker rather than a selection box.

## Components

### Buttons
Fully round, confident pills with a quick press response.
- **Shape:** full pill; icon-only buttons are circles (36, 44 or 48px).
- **Sizes:** small 36px high, 14px side padding, 0.875rem; default 44px, 20px, 0.9375rem; large 48px, 24px, 1rem. An optional 18px leading icon sits 8px from the label.
- **Primary:** yellow fill, Pencil Black text, weight 600; hover goes to Pressed Yellow.
- **Secondary:** Pill Grey fill, ink text, weight 500; hover `gray-200`.
- **Ghost:** no fill, `gray-700` text; hover gains the Pill Grey fill and ink text.
- **Danger:** `red-600` fill with `on-danger` text, weight 600; hover `red-700`. In dark the text flips to a near-black red (`on-danger-dark`) on the lighter red.
- **States:** background and colour transition over 150ms; pressing scales to 0.97. Disabled buttons keep their shape and fade (50% opacity on filled variants, muted text on the others) and do not scale. Loading swaps the icon for a spinner, disables the button and sets `aria-busy`.

### Status pills and live tags
- **Status tag:** 6px radius, 1px inset ring, 0.75rem weight-500 text, 8px side padding. Filled: `gray-100` with `gray-900` text and a `gray-200` ring. Outline: no fill, `gray-600` text, `gray-300` ring. Attention: the tone's `-50` background and `-700` text, ring at 25% of the text colour.
- **Live tag:** a yellow pill with Pencil Black 0.75rem weight-600 text ("Now", "Today"). Only for the current period or today's column.

### Sheets / Containers
- **Corner Style:** 22px.
- **Background:** Sheet White on Paper Grey.
- **Shadow Strategy:** the sheet shadow only (see Elevation & Depth).
- **Border:** none.
- **Internal Padding:** 20px; the optional header carries the title, running total, description and right-aligned actions. Table sheets drop body padding so rows run edge to edge with 20px end gutters.

### Figure rows
The replacement for stat tiles: a Pill Grey pill row, at least 56px high, with a leading round icon chip (40px from `sm`, 32px on phones; white, or the tone's soft colours when the figure carries a state), the label and an optional hint, the value at the right in 1.125rem weight-600 tabular figures, and a chevron when the row links somewhere. Linked rows darken to `gray-200` on hover. Rows stack inside a sheet so a dashboard reads as a list of answers.

### Inputs / Fields
- **Style:** Sheet White, 1px `gray-300` border, 14px corners, at least 44px high, 14px side padding, 0.9375rem ink text, `gray-500` placeholder. Selects use the app's own chevron drawn in `gray-500`, which follows the theme.
- **Hover / Focus:** hover darkens the border to `gray-400`; focus turns it ink. Inputs show no separate outline ring.
- **Error / Disabled / Read-only:** `aria-invalid` turns the border `red-600` and the field shows a 0.75rem red message under it. Disabled and read-only fields take the Paper Grey fill; disabled text is `gray-500`.
- **Search and filters:** on list pages the search box and filter selects become borderless white pills on the grey page (a 16px search icon inside the search box), gaining a `gray-300` border on hover; filters sit side by side from `sm` up.
- **Labels:** 0.875rem weight 500 above the field, required fields marked with a red asterisk, hints in 0.75rem `gray-500`.
- **Checkboxes:** native, 18px, tinted with the accent.

### Navigation
- **Sidebar items:** full pills at least 44px high with an 18px icon, 0.9375rem. Idle items are `gray-600` weight 500 and gain the Pill Grey fill on hover. The current item turns ink, weight 600, with no fill: its label carries the highlighter stroke instead.
- **Phone tab bar:** each destination is an icon in a 48 by 32px round chip over a 0.6875rem caption. The current destination's chip is yellow with Pencil Black icon; the others are `gray-500`.
- **Segmented tabs:** a Pill Grey track with 4px padding; the active segment is a white pill with the knob shadow and weight 600; the active tab lives in the URL and arrow keys move between tabs.
- **Breadcrumbs:** 0.875rem `gray-500` links separated by small chevrons; the current page is `gray-700`.
- **In-text links:** ink, weight 500, with a 2px `gray-300` underline offset 4px that turns yellow on hover or focus. In table rows the underline stays hidden until hover.

### The highlighter stroke (signature)
The current page's nav label sits on a yellow band drawn behind the text (inset 14% from the top and 2% from the bottom, overhanging the word by about half a rem on each side), with the irregular corners, tilt and skew described in Shapes. When it appears it draws itself from left to right over 240ms (`highlight-in`, a clip-path wipe on the soft ease-out). The label on it is Pencil Black in both themes. The brand mark repeats the same idea: a ruled line over a tilted yellow band on an ink tile, also used as the favicon.

### Now and today
The period running now is a period row with the Yellow Wash fill, a 2px inset Yellow Rim ring, `aria-current="time"` and a "Now" live tag; the highlight follows the clock minute by minute. Today's column in the weekly timetable gets a 2px inset yellow ring and a "Today" live tag.

### Dialogs, menus and toasts
- **Dialog:** the native modal dialog, Sheet White with 28px corners and the pop shadow over a 40% ink backdrop with a 2px blur; 24px padding, a round grey 40px close button, actions right-aligned in the footer. Page scrolling locks while it is open.
- **Menu:** a white 20px-cornered panel with the pop shadow and 6px padding; items are 40px rows with 12px corners and an optional 16px icon.
- **Toast:** an alert in the tone's soft colours with 20px corners, the pop shadow and a light backdrop blur, entering with a 200ms rise and fade. Success and info stay 4 seconds, errors 8.
- **Alert (inline):** the tone's soft background and text colour, 14px corners, a 16px leading tone icon, optional bold title and round dismiss button.

### Theme switch
A 64 by 36px capsule (`gray-200`, `gray-300` on hover) whose 28px white knob rides to the active side over 200ms on the soft ease-out, carrying a sun or moon icon. It is a real switch (`role="switch"`, checked means dark).

### Empty and loading states
Empty states are a round grey icon chip (56px), a 1rem weight-600 title, a short description and an optional action; a compact one-row form sits inside small dashboard sheets. Loading uses Pill Grey pulsing pill-shaped skeletons and a page skeleton while a route loads.

### Theming mechanism
The palette lives in CSS custom properties on `:root` and is redefined under `html[data-theme="dark"]`; the utility colour names point at those variables, so every component follows the theme with no dark-specific classes. An inline script in the document head applies the saved choice, or the operating-system preference, before first paint so the page never flashes the wrong theme. Until the user picks a theme the app keeps following the operating system; the choice is then stored on the device.

### Motion and accessibility
Motion is short and functional, on one curve (`cubic-bezier(0.22, 1, 0.36, 1)`): 150ms colour and press feedback, 200ms drawer, knob and toast entry, 240ms highlighter wipe. Under `prefers-reduced-motion` all animation and transition durations collapse to near zero. One focus ring serves every interactive element: a 2px ink outline offset 2px, keyboard focus only, which reads on yellow as well as on grey. A skip link (a yellow pill when focused) jumps to the main region, focus moves to the main region after every route change, and touch targets are at least 36px (44px by default).

## Do's and Don'ts

### Do:
- **Do** keep a page to one yellow primary button; every other action is a secondary or ghost pill, or a link.
- **Do** mark the current place or the current moment with yellow (the highlighter stroke on the nav label, the yellow tab chip, the "Now" and "Today" tags) and nothing else.
- **Do** set every label on yellow in `accent-ink`, in light and dark alike.
- **Do** put content in borderless white sheets (22px corners) on the grey page and nest grey pill rows inside them.
- **Do** show a status as a squared tag whose word carries the meaning; colour is reserved for states that need attention.
- **Do** use tabular figures for times, right-aligned numbers and running totals, and put a list's size beside its title.
- **Do** build colours only from the theme variables so both themes stay in step.
- **Do** keep controls fully round, inputs and alerts at 14px, tiles at 20px, sheets at 22px and floating panels at 28px.

### Don't:
- **Don't** use yellow for a status, a decoration or a second competing button.
- **Don't** put white text on yellow.
- **Don't** add borders or outlines to sheets, or give a sheet the pop shadow.
- **Don't** build dashboards from rows of number tiles; use figure rows inside a sheet.
- **Don't** use coloured dots or rounded-full pills for status, and don't colour the normal state (Active, Present) green.
- **Don't** make a blue (or any non-yellow) primary button.
- **Don't** use pure black in the dark theme; it is graphite.
- **Don't** add a second typeface or uppercase tracked-out labels.
- **Don't** write theme-specific component styles; change the variables instead.
