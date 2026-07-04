# Legal Pages and Production Trust Audit

Audit date: 2026-07-04
Status: Audit complete; no legal pages or routes created

## Executive finding

Readative has six trust topics, but they are not pages. They are conditional sections inside `InfoPanel` in `src/components/AppPanels.tsx` and open from buttons in the header/footer.

This architecture is suitable for lightweight in-app help, not for production legal disclosure. The content has no durable URL, server response, canonical, metadata, revision date, internal-link equity, or crawl path.

All core trust documents should become dedicated public pages in a later approved release. The existing panel can remain temporarily as a summary/navigation layer, but it should not remain the authoritative legal source.

## Current architecture

### How legal content opens

1. `AppFooter` renders six `<button>` elements.
2. A button sets `showInfoPanel` and an `InfoSection` value in `App.tsx`.
3. `AppPanels` is lazy-loaded.
4. `InfoPanel` mounts as an `aria-modal` dialog.
5. Section buttons swap local React state without updating history or URL.

Consequences:

- Refreshing or sharing cannot restore the selected section.
- Browser back/forward does not represent section navigation.
- Search crawlers do not discover the content through anchors.
- The content is absent from the DOM until a user opens the panel.
- There is no independent title, description, canonical, schema, or status code.
- External references cannot cite a stable policy URL.

## Current content inventory

| Topic | Current content | Completeness | Production concern |
| --- | --- | --- | --- |
| About | Platform summary, founder, company LinkedIn, donation link | Thin | Operator/legal entity relationship is unclear; mission and editorial model are not explained |
| Contact | One email address | Partial | No response expectations, reporting categories, business identity, or dedicated abuse/corrections channel |
| Privacy | Six short policy blocks | Insufficient | Missing controller identity, purposes, retention, processors, rights, deletion, children, transfers, legal bases, and effective date |
| Terms | Three short policy blocks | Insufficient | Missing acceptance, eligibility, accounts, licenses, UGC rights, prohibited use, termination, warranties, liability, disputes, governing law, and effective date |
| Community | Three short guidelines | Insufficient | Missing enforcement tiers, reporting, appeals, impersonation/misinformation rules, dangerous content, and repeat-offender handling |
| Disclaimer | Educational, user-content, and external-link limits | Partial | Missing AI-content, affiliate/advertising, accuracy-update, and jurisdiction-specific review considerations |
| Appearance | Product help | Not legal | Should remain an app setting/help item, not part of legal navigation |

The current text is a product summary, not production legal drafting. Final policy language requires qualified legal review for Readative's actual operator, jurisdictions, advertising, analytics, authentication, user-generated content, and data practices.

## Footer architecture audit

Positive foundations:

- Semantic `<footer>`.
- Clear, readable labels.
- Consistent app-wide placement.
- The six existing topics are sensible starting points.

Professional gaps:

- Buttons do not expose `href` values.
- No legal page has a stable path.
- No “last updated” or “effective date” is shown.
- No policy versioning or archived revision strategy exists.
- No operator/company details are presented consistently.
- No copyright/takedown, moderation appeal, or corrections workflow is linked.
- The donation link is mixed into the About content without a separate support/disclosure context.

SEO and trust gaps:

- Google cannot use footer anchors to discover trust documents.
- Author and content quality claims are not supported by editorial/corrections policies.
- The current modal cannot act as an AboutPage, ContactPage, or policy WebPage.
- Search quality evaluators and readers cannot verify who operates the platform or how errors are corrected.

## Dedicated-page decision

### Required foundation pages

| Page | Recommended path | Status | Why it should exist |
| --- | --- | --- | --- |
| About | `/about` | Required | Defines mission, operator, editorial/product model, and ownership |
| Contact | `/contact` | Required | Creates a stable support, privacy, abuse, business, and corrections entry point |
| Privacy Policy | `/privacy` | Required | Documents actual data collection, processing, sharing, retention, and rights |
| Terms of Use | `/terms` | Required | Governs accounts, content, platform use, ownership, enforcement, and liability |
| Community Guidelines | `/community-guidelines` | Required for UGC | Defines acceptable participation, reporting, moderation, and appeals |
| Disclaimer | `/disclaimer` | Required for current content model | Clarifies educational/user-generated content and professional-advice limits |
| Editorial Policy | `/editorial-policy` | Required for premium knowledge trust | Explains sourcing, curation, author attribution, AI use, trust signals, and independence |
| Corrections Policy | `/corrections-policy` | Required for knowledge trust | Gives errors a public correction/reporting process and establishes revision transparency |
| Cookie Policy | `/cookie-policy` | Required if nonessential cookies/ads apply | Separates cookie, analytics, advertising, consent, and withdrawal disclosures |

### Content Policy relationship

Readative needs a content policy, but it does not necessarily need a second page duplicating Community Guidelines.

Recommended approach:

- Use `/community-guidelines` as the user-facing behavior and enforcement document.
- Include or clearly link a “Content Policy” section covering prohibited content, copyright, spam, impersonation, manipulated media, dangerous content, and commercial promotion.
- Create `/content-policy` only if the rules become extensive enough to require a separate operational document.

### Additional high-value operational pages

| Page | Priority | Notes |
| --- | --- | --- |
| Copyright/DMCA or takedown policy | High for UGC | Required operationally in some jurisdictions; legal review needed |
| Advertising/affiliate disclosure | Conditional | Can live in Editorial Policy or Disclaimer if concise |
| Accessibility statement | Optional but valuable | Trust and accessibility commitment, not an SEO prerequisite |
| Safety/reporting center | Optional initially | Useful when moderation volume grows |
| Data request/deletion guide | Optional page | Privacy Policy can link to it when workflow exists |

## Page-content requirements

### About

Should identify:

- Readative's mission and audience;
- the operating person/entity and relationship to Innovation InfoHub;
- how user posts, SmartTalk, trust badges, and recommendations work at a high level;
- editorial versus community-created content;
- founder/team attribution;
- contact and policy links.

### Privacy

Should accurately document:

- operator/controller identity and contact;
- account/authentication data;
- posts, comments, reactions, profiles, notifications, and Notebook data;
- analytics, advertising, cookies, local storage, and third-party processors;
- purposes and legal bases where applicable;
- retention and deletion;
- public versus private fields;
- user rights and request process;
- children/minor policy;
- security and international transfer disclosures;
- effective date and revision process.

### Terms

Should cover:

- acceptance and eligibility;
- account responsibility;
- user-content ownership and the platform license needed to host/display it;
- prohibited behavior/content;
- moderation, suspension, termination, and appeals;
- intellectual property and takedown process;
- service changes and availability;
- disclaimers, limitation of liability, indemnity, disputes, and governing law;
- policy changes and contact.

### Community/Content Policy

Should cover:

- educational relevance and content quality;
- harassment, hate, sexual content, violence, scams, spam, and impersonation;
- misinformation, dangerous instructions, and manipulated/AI-generated content;
- copyright and attribution;
- commercial promotion and affiliate disclosure;
- reporting, enforcement levels, appeals, and repeat violations.

### Editorial and Corrections

Should explain:

- what Readative curates versus what users publish;
- sourcing and attribution expectations;
- how trust badges/community signals should and should not be interpreted;
- AI-assisted content disclosure expectations;
- conflicts, sponsorship, advertising, and affiliate independence;
- correction submission, review, update labeling, and material-change history.

## Indexing and schema strategy

Recommended later behavior:

- About and Contact: indexable, self-canonical, included in sitemap.
- Editorial and Corrections policies: indexable, self-canonical, included in sitemap.
- Privacy, Terms, Community Guidelines, Disclaimer, Cookie Policy: public and crawlable; sitemap inclusion is acceptable but lower priority.
- Use ordinary server-delivered semantic HTML. Heavy schema is not required.
- About may use `AboutPage`; Contact may use `ContactPage`; policies can use `WebPage`.
- Organization identity should use one stable `@id` shared with site/article schemas.

## Migration impact

There are no existing legal URLs to redirect because the current sections are modal state only.

Safe migration sequence:

1. Finalize legally reviewed source content outside component JSX.
2. Add dedicated routes and server-delivered pages.
3. Add canonical metadata and appropriate page schema.
4. Replace footer/header policy buttons with real anchors.
5. Keep the current modal temporarily as a summary with “Read full policy” anchors, or retire it after route adoption.
6. Add approved trust URLs to the sitemap.
7. Verify every footer link without JavaScript and on direct refresh.

Regression considerations:

- Do not break the existing Appearance panel or notifications panel when separating `AppPanels` responsibilities.
- Preserve mobile/tablet interaction until dedicated pages are verified.
- Avoid maintaining two authoritative copies of policy text.
- Do not publish template legal language that contradicts actual Firestore, analytics, advertising, or authentication behavior.

## Recommendation

Proceed with dedicated pages in Phase 1.1, but treat legal review and operator/data-flow accuracy as release gates. The first implementation should establish stable URLs and a single content source, not redesign the app.

Related documents:

- [production_seo_audit.md](production_seo_audit.md)
- [implementation_plan.md](implementation_plan.md)
- [migration_plan.md](migration_plan.md)
- [engineering_risk.md](engineering_risk.md)
