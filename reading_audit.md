# Release Z.2 — Premium Reading Experience Audit

Status: Phase 1 and Phase 2 audit complete. No production code has been changed for this release gate.

## Scope audited

- `src/App.tsx`
- `src/components/AppShell.tsx`
- `src/components/Header.tsx`
- `src/components/KnowledgeFeed/FeedRenderer.tsx`
- `src/components/KnowledgeCardList.tsx`
- `src/components/KnowledgeCard/KnowledgeCard.tsx`
- `src/components/KnowledgeCard/CardHeader.tsx`
- `src/components/KnowledgeCard/CardMedia.tsx`
- `src/components/KnowledgeCard/CardTrust.tsx`
- `src/components/KnowledgeCard/CardContent.tsx`
- `src/components/KnowledgeCard/CardActions.tsx`
- `src/components/KnowledgeFeed/KnowledgeJourney.tsx`
- `src/components/KnowledgeImageCarousel.tsx`
- `src/components/Skeletons.tsx`
- `src/utils/renderRichText.tsx`
- `src/index.css`

## Current reading architecture

The primary reading surface is the virtualized knowledge feed. `FeedRenderer` renders controls and a `KnowledgeCardList`, and `KnowledgeCardList` virtualizes cards using estimated heights, measured row heights, absolute positioning, `ResizeObserver`, and scroll compensation for height changes above the viewport.

Each card is composed in `KnowledgeCard` as:

1. `CardHeader`
2. `CardMedia`
3. `CardTrust`
4. `CardContent`
5. `CardActions`
6. optional comments

`CardContent` owns the reading title, paragraph rendering, notebook paragraph ids, notebook margin controls, semantic highlight rendering, hashtags, mentions, and top-comment preview. It renders each content section as a paragraph with existing grey separators between sections.

`KnowledgeJourney` is rendered after each card in the feed and in the desktop right rail. It is a continuation/related-content module using already-loaded entries and SmartTalk question data.

## Surface findings

| Surface | Current behavior | Reading impact | Minimal post-approval direction |
| --- | --- | --- | --- |
| Card shell | White card, 8px radius, border, elevated shadow, hover shadow. | Feels more feed-card/social than premium article surface. Shadow and border compete with long-form reading calm. | Slightly soften card chrome with CSS/class tuning only. Do not redesign structure. |
| Header | Avatar, bold author name, username, reputation badge, social links, and menu sit before the title. | Header has high visual weight before reading begins; eye lands on identity/actions before article. | Reduce visual dominance while preserving affordances and layout. |
| Media | Edge-to-edge carousel sits between header and trust/content. Uses gradient overlay, watermark, controls, portal gallery. | Strong image block can interrupt reading rhythm, especially when followed by badges and title. | Improve image-to-text spacing and visual calm only; do not change gallery logic. |
| Trust badge row | Multiple tiny colored badges plus Notebook icon share one row above title. | Trust metadata can feel like CTA/chip clutter before the headline. | Keep badges but make the row feel secondary and quieter. |
| Headline | `text-2xl sm:text-3xl`, `font-black`, tight line-height. | Strong hierarchy, but weight is heavy for long-session reading and can feel app-like. | Tune headline scale/weight/line-height toward editorial reading. |
| Body paragraphs | Sections are paragraphs with `text-[15px]`, `sm:text-base`, `leading-7/8`, `whitespace-pre-wrap`, and grey separators. | Line-height is serviceable, but rhythm is separator-driven rather than editorial. | Preserve separators and spacing anchors; refine text rhythm without moving separators or changing Notebook geometry. |
| Existing separators | `my-6 border-t border-slate-100` between content sections. | Separators establish notebook-paper rhythm and must remain stable. | Keep position and role; only subtle color/consistency adjustments after approval. |
| Rich text | Inline links/mentions are emerald underlined; emphasis variants use emerald/rose/strong text. | Inline treatment can pull the eye away from sustained reading, especially colored emphasis. | Make inline links premium but quiet. Do not add a Markdown parser or dependency. |
| Code / quote / list styling | No dedicated block-level renderer was found in `renderRichText`; content sections render as paragraphs. | Raw markdown-like code, quotes, or lists will not receive article-grade block styling today. | Only style existing/rendered elements if present; do not build a new renderer in this polish release. |
| Notebook visibility | Highlight marks are layout-safe; margin controls appear only in Notebook Mode. | Current highlight model supports reading-first behavior. | Do not change Notebook logic. Minor CSS-only polish is allowed only if it preserves layout. |
| Tags and mentions | Chips appear directly after the body with bright borders/fills. | Tags can feel like feed metadata immediately after reading; the transition is abrupt. | Add breathing room/quietness without changing behavior. |
| Top comment preview | Rendered inside `CardContent` after body metadata. | Blurs article reading and social proof; can interrupt closure of the article. | Keep UI, but make it visually subordinate if implemented. |
| Footer actions | Three bold bordered action buttons, grid on mobile, flex on larger screens. | Social actions are visually loud compared with the reading content. | Improve spacing and quiet styling only; preserve actions and handlers. |
| KnowledgeJourney | Card-like module follows every post; also appears in desktop rail. | Helpful, but currently reads like another card/CTA immediately after an article. | Make continuation feel like gentle next-reading guidance, not social feed furniture. |
| Desktop reading width | Z.1 center column is 780px at `>1400px`; internal card padding leaves a comfortable text line. | Good base for premium reading. Rails must stay secondary. | Keep center width; avoid widening text. |
| Mobile reading | Current mobile layout uses same card stack and dense header/trust/action clusters. | Reading is functional, but metadata density is more pronounced on narrow screens. | Preserve mobile layout exactly; only gentle typography/spacing polish after approval. |
| Loading state | Skeleton mirrors card/social structure with avatar, image, title, text, chips, footer. | Clear but more feed-like than article-like. | Small skeleton rhythm polish only, no timers or new loading logic. |

## Premium reading review

- Reading speed: Body line-height is acceptable, but dense metadata before and after the text slows entry and exit from the article.
- Eye movement: The eye currently jumps through avatar, menu, media, trust chips, title, body, chips, footer actions, then journey. The title/body should become the dominant path.
- Visual hierarchy: Headline and action metadata both use heavy weights. The hierarchy should be title, body, media/context, then actions.
- Reading fatigue: Long articles benefit from calm line-height and subdued chrome. Current card shadows, chips, and bold actions add friction over repeated cards.
- Scanning: Titles scan well. Body scanning is limited because all content sections render as paragraphs; there is no heading/list/quote hierarchy at the renderer level.
- Long article comfort: The 780px desktop column is appropriate. Paragraph rhythm can be made more editorial without changing card height unpredictably.
- Image interruption: Edge-to-edge media can be appropriate, but the transition from media to trust badges to headline currently has too many visual stops.
- CTA placement: Footer actions and KnowledgeJourney are useful but visually strong. They should read as post-reading utilities, not primary content.
- Paragraph rhythm: Separators provide notebook rhythm. Any polish must preserve separator placement and avoid layout shifts around Notebook controls.
- Headline rhythm: Current headline is strong but heavy. A premium reading feel would benefit from slightly calmer tracking/weight/line-height.

## Inconsistencies found

1. Card chrome is more elevated than the desired calm reading surface.
2. Header identity and action menu compete with the headline.
3. Trust badges, Notebook control, and title are packed into the same pre-body region.
4. Inline link/emphasis colors are high-saturation compared with the body.
5. Tags and mentions sit close to the article body and visually read as feed chips.
6. Footer actions are heavy and equally weighted against the content.
7. KnowledgeJourney uses another card container immediately after the post, creating CTA density.
8. Skeleton state mirrors social-card density rather than reading rhythm.
9. Dedicated quote/list/code block rendering is not currently present in the rich-text path.
10. Virtualized row height estimates assume current typography rhythm, so large spacing changes would risk scroll correction churn.

## Audit conclusion

Z.2 should be implemented as a CSS/class-level premium reading polish pass. It should not introduce new data, schema, routing, Notebook behavior, SmartTalk logic, virtualization changes, dependencies, timers, listeners, or render loops.

The safest path is to tune existing component presentation while preserving the component tree, event handlers, semantic highlighting, feed virtualization, and responsive breakpoints.
