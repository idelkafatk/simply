# Mobile design

How the phone UI of this theme is built (everything below 1000px wide) and why.
It started as a port of the tab bar from the ITPEC trainer app and grew into one
language for every mobile overlay. Read this before adding a new overlay, panel
or control on mobile, so it comes out as part of the same set.

It is phone-first, but not phone-only. Wide screens keep the header instead of
the capsule, and share everything else: the member card, the tag page, the
icons. See [Wide screens](#wide-screens).

## The idea in one paragraph

A floating capsule at the bottom of the screen is the only permanent control.
Everything it opens is a **card floating just above it**: the same width, the
same rounding, the page dimmed behind. Inside a card, **navigation is set in
type** (big bold words, small grey lines), **actions are buttons**, and **input
is a soft grey field**. Nothing is ruled like a table and nothing navigational
is boxed like a button.

## Files

| What | Where |
| --- | --- |
| Markup of the capsule and the sheet with all its panels | `partials/mobile-navigation.hbs` |
| Search markup | `partials/search.hbs` |
| Styles | `src/css/components/mobile-navigation.css`, `src/css/components/search.css` |
| Capsule, sheet and panel behaviour, tag counts | `mobileNavigation()` in `src/js/main.js` |
| Profile and Newsletter panels | `src/js/member-panels.js` |
| Search | `src/js/search.js` |
| Keyboard tracking shared by the sheets | `src/js/util/keyboard-inset.js` |
| Icons | `partials/icons/*.hbs` |
| Content API URL helper | `src/js/util/content-api.js` |

## The capsule (tab bar)

- Centred, `min(380px, 100% - 2rem)` wide, 68px tall, fully rounded.
- 14px above the bottom of the screen, or the home-indicator inset less 8px when
  that is larger. Adding the inset to the 14px floated it too high in the
  installed app.
- Frosted glass: `rgba(244, 244, 245, 0.6)` over `blur(24px) saturate(2)`, a 1px
  dark outline at 6%, a white top highlight and a soft `0 6px 20px` shadow. In
  dark mode `rgba(39, 39, 42, 0.6)`, a light inner rim and no drop shadow.
  The reference app uses 35% in dark; here cover images scroll under the bar
  and the icons disappeared over bright ones.
- Without `backdrop-filter` the glass becomes 94% opaque, so it stays readable.
- Four tabs: Home, Notes, Search, More. Line icons at 26px, labels kept only for
  screen readers.
- **One pill** shared by all tabs marks the active one and slides between them
  (`--mobile-tab-index`, `-1` when the page belongs to no tab). The active icon
  also takes the accent colour; the reference app has full-colour illustrations
  and needs no tint, line icons do.
- The pill moves the moment a tab is tapped, before the next page loads, and
  follows whichever sheet is open (Search, More).
- It fades out with an 8px drop while the page scrolls down and comes back on
  scroll up. Over the last 120px of a page it fades in step with the scroll, so
  it is fully there at the end without a jump on iOS bounce. Pages that scroll
  less than 400px keep it in place.
- Pages reserve room for it: the footer ends in the bar's height plus its
  bottom gap plus 24px. It is the footer's own padding, so a tinted footer
  (posts have one) runs on under the glass instead of stopping at a white band.

## Cards (sheets)

Search and More are the two cards. Both:

- sit 8px above the capsule, as wide as it is, with a 1.5rem radius;
- fade in with a 12px rise (they do not slide up from the bottom edge, which
  would pass behind the glass);
- dim the whole page; the capsule stays bright and tappable above the dimming;
- once a field raises the keyboard, end 8px above the keyboard instead of above
  the capsule (`trackKeyboardInset`). iOS keeps fixed elements on the layout
  viewport, so without this the keyboard covers them.

Only one card is open at a time. Tapping the tab of the open card closes it;
tapping the other tab switches cards.

**Search** hangs from the top, just under the header, and reaches down to the
capsule. Only its bottom edge follows the keyboard, so the field stays exactly
where it is when the keyboard comes or goes and as results change; the list
under it just gets shorter. On a phone it opens on the latest posts with the
keyboard down: the field is focused only when tapped. On desktop, where the
keyboard is a real one, it is focused at once.

**More** is as tall as its content and grows up from the capsule. When one of
its forms raises the keyboard it glides up with it (`bottom` is animated).

### Layers

| Layer | z-index |
| --- | --- |
| More backdrop / card | 30 / 35 |
| Capsule | 40 (62 while search is open) |
| Install prompt | 45 |
| Search backdrop / card | 60 / 61 |

## Panels inside the More card

The More card holds several panels and shows one at a time. This is how sign-in,
sign-up and the account stay in the same card instead of opening Ghost Portal
full screen.

```
menu ─┬─ signup ⇄ signin          (signed out)
      └─ account ─┬─ profile      (signed in)
                  └─ newsletter
```

- A panel is `<div data-mobile-navigation-panel="name" data-title="…">`.
- Anything with `data-mobile-navigation-panel-open="name"` switches to it.
- The header shows the panel's `data-title`. The back arrow goes to its
  `data-parent`, or to the menu when it has none; the menu shows no arrow.
- A field marked `data-autofocus` is focused when its panel opens. This has to
  happen inside the tap, or iOS will not raise the keyboard.
- The card always reopens on the menu, with forms reset.

To add a panel: add the `div` to `partials/mobile-navigation.hbs`, link to it
with `data-mobile-navigation-panel-open`, and build its content from the
elements below. No JavaScript is needed unless it loads or saves data.

### Ghost Portal links

Ghost Portal is a full-screen white popup in its own design, so on phones
nothing should open it when the card has a panel for the same thing. Any
`data-portal` element or `#/portal/…` link, anywhere on any page, opens the
card on the matching panel instead:

| Link | Panel |
| --- | --- |
| `signup`, `account/signup`, bare `data-portal` for a guest | signup |
| `signin` | signin |
| `account`, bare `data-portal` for a member | account |
| `account/profile` | profile |
| `account/newsletters` | newsletter |

Portal binds its own click handler on these elements, so ours runs first, in
the capture phase, and stops the event. A link with no panel (`account/plans`)
still reaches Portal. The same goes for wide screens, where the header's
"Log in", "Subscribe" and avatar are such links.

## Elements

**Words** – navigation. A column of `1.75rem` / weight 800 labels with no box
and no rule, each a full-width tap target. Tag links get their post count on
the right in small grey figures; account rows get a chevron. Classes:
`.mobile-navigation-word`, and any `/tag/` link inside `.mobile-navigation-links`.

**Minor line** – a secondary destination or a quiet action ("About", "Log
out"): `1rem` / 600 in grey under the words. `.mobile-navigation-minor`, and any
non-tag link inside `.mobile-navigation-links`.

**Buttons** – actions only. 52px tall, 1rem radius, bold. The primary one is
filled with the accent colour, the secondary one is an accent outline. They
never share a look with navigation.

**Fields** – 52px tall, 1rem radius, soft grey fill (`--mobile-navigation-tile-bg`),
accent border on focus, 16px text so iOS does not zoom. A small uppercase grey
label above when the field shows saved data.

**Switch** – for an on/off setting: the name set like a word (`1.375rem` / 800),
one grey line saying what it does, and an accent switch. It saves on change;
there is no Save button.

**Identity tile** – the signed-in reader at the top of the menu: avatar, name,
email, chevron, on the soft grey fill. It is the one boxed thing that navigates,
because it stands for a person rather than a section.

**Status** – a sent form is replaced by a check mark, a bold line and one grey
sentence. Errors are one red line right above the button, and a note about
what happens next (a confirmation link was mailed) is one grey line in the same
place. A saved profile flips the button label to "Saved" for two seconds.

## Icons

One set everywhere: 24px line icons with a 2px round stroke (Lucide shapes),
one partial each in `partials/icons/`, drawn in `currentColor`. The same cross
closes the More card and the search, the same magnifier sits in the tab bar,
the search field and the header.

- Use `{{> "icons/close"}}`; pass `class="…"` for extra classes.
- 26px in the tab bar, 22px for the close and back buttons, 20px inside a
  field, 16px for a chevron after a word.
- The filled glyphs of the old sprite (`#icon-close`, `#icon-search`, …) are
  not used in these components any more. The avatar silhouette is the one
  filled shape, because it stands in for a photo.

## Wide screens

From 1000px up the header does what the capsule does on a phone, so:

- the tab bar and the menu panel are hidden;
- the card holds the member panels only and drops from the right end of the
  header, 22.5rem wide, over a page that is neither dimmed nor locked; a click
  outside or Escape closes it;
- "Log in", "Subscribe" and the avatar in the header open it. The old avatar
  dropdown is gone; the account panel replaces it;
- a panel whose parent would be the menu shows no back arrow;
- search stays a centred dialog, with the card's rounding and the same icons,
  and focuses its field at once;
- an open search does not lock the page with `overflow: hidden`: with a real
  scrollbar that makes the bar vanish and the page jump sideways. The bar
  stays, and `search.js` stops the wheel instead, so it scrolls the results
  when they overflow and nothing otherwise. Phones, whose scrollbars take no
  room, still lock the page;
- lists inside the cards (search results, the card's own content) get a thin
  floating scrollbar thumb that stops short of the round corners, for mouse
  pointers only; touch screens keep their overlay bars;
- the tag page looks the same at every width.

The classes are still called `mobile-navigation-*`. Renaming them was not worth
the churn; read the prefix as "the card".

## Where the data comes from

- **Menu links** – Ghost navigation, rendered by `{{navigation navigationMobile=true}}`.
  Links to `/` and `/notes/` are removed in JS because they already have tabs.
  Tag links are recognised by `/tag/` in the address; order is as set in Ghost.
- **Post counts** – Content API `tags?include=count.posts`, fetched the first
  time the menu opens and kept in `sessionStorage` for the session.
- **Sign up / sign in** – Ghost's own `form[data-members-form]` handling. Ghost
  sets `.loading`, `.success` and `.error` on the form and fills
  `[data-members-error]`; the theme only styles those states.
- **Profile and newsletter panels** – the members API directly, with the
  requests Portal sends:
  - name: `PUT /members/api/member/` with `{ name }`;
  - newsletters: the same `PUT` with `{ newsletters: [{ id }] }`, the list of
    all newsletters coming from the Content API;
  - comment reply emails: the same `PUT` with `{ enable_comment_notifications }`,
    shown only when comments are on in the site settings;
  - what the Newsletter panel shows is kept in `sessionStorage` for the session.
    A signed-in reader's first page fetches it once the page is idle; after
    that the panel opens filled in from the copy, and opening the Account panel
    (a step earlier) fetches a fresh answer that quietly corrects it. Every
    save updates the copy; signing out drops it. "Loading" shows only if the
    panel is reached in the first second or so of a session;
  - email: `GET /members/api/session/` for the identity token, then
    `POST /members/api/member/email/` with `{ email, identity }`. Ghost mails a
    confirmation link and switches the address only when it is opened, so the
    form keeps showing the old one until then.

The Content API key and URL are read from the Portal script tag Ghost prints on
every page (`contentApiUrl`).

## Pages

The pages the menus lead to follow the same rules where they have a header of
their own.

- **Tag page** – the tag name in type at the left like the Notes page, the post
  count from the menu under it in small grey figures, then the description as a
  grey line, at every width. The old grey band with centred text, a serif
  description and a "Home ›" breadcrumb is gone.
- **Notes** (`/notes/` and the `/notes/<topic>/` channels, phone and desktop) –
  - *Colour says what a line is*: white (the title colour) is content – the
    page title and the note titles; the accent marks where you are – the
    current topic, as in the tab bar and the desktop menu; grey is everything
    around it. With the current topic and the months in white too, the page
    read as all one colour.
  - *Topics* are words, not chips: one row at `1.25rem` / 800, grey, the current
    one in the accent colour, each followed by its note count in small grey
    figures (the count comes from the `{{#get}}` that already checks whether
    the topic has notes). On a phone the row scrolls sideways, fades out at the
    right edge, and starts with the current topic in view; from 768px it is a
    size smaller and wraps.
  - *The feed has no rules.* Notes are parted by space, and a heading in the
    words' type (`1.75rem` / 800) at half strength opens each month. `notesMonths()` in
    `src/js/main.js` adds the headings, again after infinite scroll appends a
    page. The heading carries the year when it is not the current one, so the
    dates under it read "4 октября"; without JavaScript they keep the year.
  - Paragraphs in a preview are `0.75em` apart. The gap used to be `4vmin`,
    which on a desktop screen came to about 50px.
- **Home** (phone and desktop) –
  - *Latest notes*: the way to all notes is a quiet grey line by the heading
    ("Все ›", `1rem` / 600, the chevron of the account rows), not a button
    under the cards. A card is a soft fill (`--mobile-navigation-tile-bg`,
    `1.5rem` radius) with no outline. Its title link covers the whole card, so
    the preview is the note's own markup (`{{content}}`) with Ghost cards
    hidden: the plain-text excerpt glued a bookmark's title to the paragraph
    after it and left an empty line between paragraphs.
  - *Post cards* (`partials/story/story-grid.hbs`, also on tag and author
    pages): covers have a `1rem` radius. They keep their hairline, as the
    capsule keeps its outline: a white cover dissolves into a white page.
  - The tag on a cover stays a badge in the tag's own colour. It is the one
    place a tag is boxed and coloured; a grey word above the title and a
    frosted-glass badge were mocked up next to it, and the badge was kept.
  - Dates are not capitalised ("1 сент. 2026", "4 октября 2026"), and reading
    time is "% мин на чтение": Ghost's helper has one plural form, Russian
    needs two ("7 минуты").
- **Posts** – already left-aligned and set in type; unchanged.
- **Author page ("About")** – keeps its dark cover with the avatar. It is a
  designed page of its own, not an overlay, and was left as it is.

## Tried and rejected

- A full-width bar glued to the bottom with labelled tabs – the starting point,
  read as dated next to the capsule.
- Bottom sheets attached to the screen edge – did not go with a floating bar.
- Menu links as ruled text rows – read as a table.
- Menu links as a grid of soft tiles – could not be told apart from the buttons
  above them.
- "Log in" as a soft grey tile – same problem; it is an accent outline now.
- Tags as hashtag chips, or as rows with an emoji badge – considered as mockups
  alongside the type-only list; the list was chosen.
- "All notes" as a grey button under the home carousel, and outlined carousel
  cards – navigation boxed like an action, and a row of outlines.
- Note topics as bordered hashtag chips, and a hairline between every note –
  the Notes page before it followed this document; the chips wrapped into two
  or three rows on a phone and the rules read as a table.
- Search that focused its field on open, in a card anchored to the bottom –
  the keyboard came up with the card and pushed it across the screen, which
  read as the whole screen lurching.
- Ghost Portal for sign-up and account – a full-screen white popup in its own
  design, and always light in dark mode.
- Keeping "Change email" and "More email settings" as links into Portal – the
  one step that still left the card; both are native now.
- Reserving the room for the bar on `.simply-viewport` – left a white band
  under the grey footer of a post.

## Checking a change

Ghost is not run locally. The working method so far:

1. `yarn prod`, then `yarn lint` and `yarn scan`.
2. Save the live HTML of a page, swap in the local `assets/` build and the
   partial rendered with Handlebars, and open it in headless Chrome at 390×844
   in both colour schemes.
3. Drive it over the DevTools protocol: scrolling, opening cards, switching
   panels. `--dump-dom` with a virtual time budget is not enough, scroll events
   and animation frames do not fire there.
4. Load every local script the page uses: posts load `post.js`, not `main.js`.
5. Never let such a page write to the live site: fake the members API in the
   page. Sign-in mails, saving a profile, changing the email and the real
   on-screen keyboard can only be confirmed on the deployed theme with a real
   account and phone.
