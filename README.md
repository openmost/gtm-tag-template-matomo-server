# Matomo — server-side Google Tag Manager tag template

Send hits to Matomo from your server-side GTM container. One template, two levels:

| Level | Browser | sGTM client | What this tag does |
|---|---|---|---|
| **Standard** | gtag / GA4 | GA4 client | Maps GA4 events to Matomo pageviews, events, site search, downloads, outlinks, ecommerce orders, goals and custom dimensions |
| **Advanced** | `matomo.js` served by the [**Matomo Client**](https://github.com/openmost/gtm-client-template-matomo) template | Matomo Client | Replays every Matomo hit **losslessly** — FormAnalytics, MediaAnalytics, A/B testing, CrashAnalytics, page performance, custom dimensions… |

Authored by Ronan HELLO — [Openmost](https://openmost.com).

---

## Requirements

- A Matomo `token_auth` of a user with at least *write* access to the site. It lets Matomo record the real visitor IP (`cip`). The token is sent in the POST body only, never in the URL.
- For the advanced level: the [Matomo Client](https://github.com/openmost/gtm-client-template-matomo) template.

## How hits are sent

One HTTP `POST <matomo>/matomo.php` per hit, `application/x-www-form-urlencoded`, with `send_image=0`, the real IP (`cip`), user agent (`ua`) and language. Request headers useful to Matomo (Referer, DNT, client hints, `matomo_ignore` cookie) are forwarded in advanced mode.

The tag calls `gtmOnFailure` when Matomo answers with a non-2xx status (invalid token, unknown site…), so failures are visible in the sGTM preview.

## Tracking types

| Tracking type | Use it for |
|---|---|
| **Automatic** (default) | One tag for everything: replays every hit of the Matomo Client, or maps every GA4 event as described below |
| **Matomo event** | One Matomo event with the *Event category / action / name / value* you set (GTM variables allowed). Create one tag per event and give each its own trigger. The event is attached to the visitor of the incoming event (GA4 client or Matomo Client) |

## GA4 events mapping (Automatic)

- `page_view` → pageview
- `search` / `view_search_results` → site search (category and result count from configurable event data keys)
- `file_download` → download
- outbound `click` → outlink
- every other event → Matomo event with an automatic **category**, an **action** derived from the event name (`add_to_cart` → `Add to cart`) and an automatic **name**:

| Category | GA4 events |
|---|---|
| Ecommerce | add_payment_info, add_shipping_info, add_to_cart, add_to_wishlist, begin_checkout, purchase, refund, remove_from_cart, select_item, select_promotion, view_cart, view_item, view_item_list, view_promotion |
| Lead | generate_lead, qualify_lead, disqualify_lead, working_lead, close_convert_lead, close_unconvert_lead |
| Auth | login, logout, sign_up |
| Content | select_content, share, join_group |
| Onboarding | tutorial_begin, tutorial_complete |
| Game | level_start, level_end, level_up, post_score, unlock_achievement, earn_virtual_currency, spend_virtual_currency |
| Advertising | ad_impression |
| Video | video_start, video_progress, video_complete |
| Form | form_start, form_submit |
| Engagement | scroll |
| Other | anything else |

Event name: `transaction_id` for purchase/refund, promotion or list name for promotion/list events, first item name for other ecommerce events, `lead_source` for lead events.

Send `event_category`, `event_action` or `event_label` with a GA4 event to override the automatic values. For full control over a specific event, use the **Matomo event** tracking type.

- `purchase` also sends the Matomo **ecommerce order**: items, subtotal (GA4 `value`), tax, shipping, discount, and revenue = value + tax + shipping.
- Cart events also send a Matomo **cart update** when *Full cart content* is set (Matomo requires the whole cart on every update).
- *Also send view_item / view_item_list as product/category page views* sends the Matomo product or category view.
- *Goals* table: map a GA4 event to a Matomo goal (one extra hit, optional revenue).
- *Custom dimensions* table: map any event data key to a Matomo dimension ID.
- *Events not sent to Matomo*: `session_start`, `first_visit` and `user_engagement` by default.
- Visitor ID: first 16 hex characters of `sha256(client_id)` — the tag sets no cookie.

## Consent

When analytics consent is **denied** (GA4 consent mode `analytics_storage=denied`, or your own variable), the tag behaves like Matomo's `requireCookieConsent`: the hit is still sent, without visitor identifiers (`_id`, `cid`, and `uid` unless disabled). Matomo then recognises the visit with its cookieless daily fingerprint. When consent is granted, full hits are sent.

For hits from the Matomo Client, *Automatic* follows the `x-matomo-consent` signal set by the client (`matomo.js` sends no visitor ID until cookie consent is given); choose *Variable* to enforce your own server-side decision.

## Advanced

- *Set or override Matomo parameters* and *Remove Matomo parameters* apply to every hit, in both modes.
- Hits coming from the Matomo Client keep their own site ID. Tick *Override the site ID of Matomo Client hits* to send them to the *Site ID* of the tag instead.

## License

Apache 2.0
