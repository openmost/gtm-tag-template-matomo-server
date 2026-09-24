# Matomo tag for server-side Google Tag Manager

**Send your data to Matomo from your server-side GTM container.** This tag sends hits to the Matomo tracking API (`matomo.php`) with the real visitor IP, from two possible sources:

- the [**Matomo Client**](https://github.com/openmost/gtm-client-template-matomo) — your website keeps using `matomo.js`, and every hit is replayed **without any loss** (FormAnalytics, MediaAnalytics, A/B Testing, CrashAnalytics, custom dimensions…);
- the **GA4 client** — your website uses gtag / Google Analytics 4, and GA4 events are **automatically translated** into Matomo page views, events, site searches, downloads, outlinks, goals and ecommerce orders.

Authored by Ronan HELLO — [Openmost](https://openmost.com). License: Apache 2.0.

---

## Contents

1. [Which setup is right for me?](#which-setup-is-right-for-me)
2. [Requirements](#requirements)
3. [Quick start](#quick-start)
4. [Settings reference](#settings-reference)
5. [How hits are sent](#how-hits-are-sent)
6. [Tracking type "Automatic" with the Matomo Client](#tracking-type-automatic-with-the-matomo-client)
7. [Tracking type "Automatic" with GA4 events](#tracking-type-automatic-with-ga4-events)
8. [Tracking type "Matomo event"](#tracking-type-matomo-event)
9. [Consent](#consent)
10. [Troubleshooting](#troubleshooting)
11. [FAQ](#faq)
12. [For developers](#for-developers)

---

## Which setup is right for me?

| Your website uses… | Server-side client | Result |
|---|---|---|
| The Matomo snippet (`matomo.js`) or Matomo Tag Manager | [Matomo Client](https://github.com/openmost/gtm-client-template-matomo) | **Complete**: everything `matomo.js` tracks reaches Matomo, premium plugins included. Recommended. |
| gtag.js / Google Analytics 4 only | GA4 client (built into server-side GTM) | **Standard**: page views, events, site search, downloads, outlinks, goals, ecommerce orders and custom dimensions, mapped from GA4 events. Premium plugins (forms, media…) are not available because GA4 does not collect them. |

You can use both at the same time, with one tag per client.

The tag has two **tracking types**:

| Tracking type | Use it for |
|---|---|
| **Automatic** (default) | One tag handles everything: it replays every hit of the Matomo Client, or maps every GA4 event. |
| **Matomo event** | Send one Matomo event with the category, action, name and value you choose (GTM variables allowed). Create one tag per event, each with its own trigger. |

---

## Requirements

- A **server-side Google Tag Manager** container.
- A **Matomo** instance (On-Premise or Cloud), version 4, 5 or 6.
- A Matomo **`token_auth`** of a user with at least ***write*** access to the site(s) you track (*Matomo → Personal → Security → Auth tokens*). Matomo needs it to accept the real visitor IP from a server. The token is sent in the body of the request only, never in a URL.

---

## Quick start

### With the Matomo Client

1. Import and configure the [Matomo Client](https://github.com/openmost/gtm-client-template-matomo) (see its quick start).
2. *Tags → New → Matomo*:

   | Field | Value |
   |---|---|
   | Tracking type | Automatic |
   | Matomo instance URL | `https://analytics.example.com` |
   | Auth token | your `token_auth` |
   | Site ID | leave empty (each hit keeps the site ID set in your snippet) |
   | Trigger | *Custom* → **Client Name equals `Matomo Client`** |

3. Publish the container.

### With GA4 events

1. Make sure your website sends GA4 data to your server container (`server_container_url` in gtag, or the GA4 tag of a GTM web container pointing to your server-side domain), and that the **GA4 client** exists in the server container.
2. *Tags → New → Matomo*:

   | Field | Value |
   |---|---|
   | Tracking type | Automatic |
   | Matomo instance URL | `https://analytics.example.com` |
   | Auth token | your `token_auth` |
   | Site ID | **required**: the Matomo site ID, e.g. `1` |
   | GA4 events mapping | optional: goals, custom dimensions (see below) |
   | Trigger | *Custom* → **Client Name equals `GA4`** (the name of your GA4 client) |

3. Publish the container.

Allow one or two minutes after publishing for all server instances to use the new version.

---

## Settings reference

### Main settings

| Field | Default | Description |
|---|---|---|
| **Tracking type** | Automatic | *Automatic* or *Matomo event* (see above). |
| **Matomo instance URL** | — (required) | e.g. `https://analytics.example.com`. Hits are sent to `<URL>/matomo.php`. |
| **Auth token (token_auth)** | — (required) | Token of a user with at least *write* access. |
| **Site ID** | empty | Required for GA4 events. Hits from the Matomo Client keep their own site ID. |
| **Override the site ID of Matomo Client hits with this site ID** | off | Sends Matomo Client hits to the *Site ID* above instead of their own site. |

### Matomo event (tracking type "Matomo event" only)

| Field | Description |
|---|---|
| **Event category** | required |
| **Event action** | required |
| **Event name** | optional |
| **Event value** | optional, numeric (a non-numeric value is ignored) |

### Consent

| Field | Default | Description |
|---|---|---|
| **Analytics consent source** | Automatic | *Automatic*: GA4 consent mode for GA4 events, the Matomo Client's signal for Matomo hits. *Variable*: your own GTM variable. |
| **Consent value** | — | With *Variable*: `granted` / `denied` (or `true` / `false`). |
| **Also remove the User ID when consent is denied** | on | See [Consent](#consent). |

### GA4 events mapping (tracking type "Automatic" only)

| Field | Default | Description |
|---|---|---|
| **Events not sent to Matomo** | `session_start, first_visit, user_engagement` | Comma-separated GA4 event names to ignore. |
| **Event data key of the search category** | `search_category` | Where to read the site search category. |
| **Event data key of the search results count** | `search_total` | Where to read the number of search results. |
| **Goals** | — | Table *GA4 event name → Matomo goal ID*, with *Use event value as revenue* (Yes/No). |
| **Custom dimensions** | — | Table *Event data key → Matomo dimension ID*. |
| **Full cart content** | — | A variable returning the **whole** cart as GA4 `items` (see [ecommerce](#ecommerce)). |
| **Also send view_item / view_item_list as Matomo product/category page views** | off | See [ecommerce](#ecommerce). |

### Advanced

| Field | Description |
|---|---|
| **Set or override Matomo parameters** | Table *parameter → value* applied to every hit, e.g. `dimension3` → `{{Server region}}`. |
| **Remove Matomo parameters** | Comma-separated parameters removed from every hit, e.g. `uid, urlref`. |

---

## How hits are sent

- One HTTP `POST <Matomo URL>/matomo.php` **per hit**, `application/x-www-form-urlencoded`. No batching.
- The hits of one event are sent **one after the other**, so Matomo attaches them to the same visit in the right order.
- Every request includes the real visitor IP (`cip`), user agent (`ua`), language, `send_image=0` and the `token_auth` (in the body).
- For Matomo Client hits, the request headers useful to Matomo are forwarded: Referer, Do-Not-Track, client hints (`sec-ch-ua*`) and the `matomo_ignore` cookie (so excluding your own visits keeps working).
- The tag reports **failure** when Matomo answers with an error (for example `400` for an invalid token or site): you can see it in the server preview.

---

## Tracking type "Automatic" with the Matomo Client

Each hit received by the Matomo Client is replayed as is: every parameter is kept, including those of premium plugins and any parameter this tag does not know. The tag only:

- adds the real IP, user agent and language;
- applies consent rules (see [Consent](#consent));
- applies the *Advanced* settings, and the site ID override if you ticked it.

---

## Tracking type "Automatic" with GA4 events

### What each GA4 event becomes

| GA4 event | Matomo |
|---|---|
| `page_view` | page view (title = `page_title`) |
| `search`, `view_search_results` | site search: keyword `search_term`, category `search_category`, results count `search_total` |
| `file_download` | download of `link_url` |
| `click` with `outbound = true` | outlink to `link_url` |
| any other event | Matomo **event** (see below) |
| `purchase` | Matomo event **+ ecommerce order** |
| `add_to_cart`, `remove_from_cart`, `view_cart` | Matomo event **+ cart update** if *Full cart content* is set |
| `view_item`, `view_item_list` | Matomo event **+ product / category view** if the option is ticked |
| event listed in the *Goals* table | **+ goal conversion** |
| `session_start`, `first_visit`, `user_engagement` | ignored (configurable) |

### Automatic event category, action and name

**Category** — from this table, based on the [GA4 recommended events](https://support.google.com/analytics/answer/9267735):

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
| Other | any other event |

**Action** — the event name made readable: `add_to_cart` → `Add to cart`, `close_convert_lead` → `Close convert lead`.

**Name** — depends on the event:

| Event | Name |
|---|---|
| `purchase`, `refund` | `transaction_id` |
| `view_promotion`, `select_promotion` | `promotion_name` |
| `view_item_list`, `select_item` | `item_list_name` |
| other Ecommerce events | name of the first item |
| Lead events | `lead_source` |
| others | none |

**Value** — the GA4 `value` parameter, when it is a number.

**Your own values win**: send `event_category`, `event_action` or `event_label` as parameters of a GA4 event to replace the automatic category, action or name. Example with gtag:

```js
gtag('event', 'newsletter_signup', {
  event_category: 'Newsletter',
  event_action: 'Subscribe',
  event_label: 'Footer form'
});
```

### Ecommerce

- **Orders**: `purchase` sends a Matomo ecommerce order with the order ID (`transaction_id`), the products (`items`), the subtotal (GA4 `value`), `tax`, `shipping` and the discount (sum of item discounts). As in GA4, `value` excludes tax and shipping; Matomo's revenue is `value + tax + shipping`.
- **Carts**: Matomo needs the **whole cart** on every cart update, whereas GA4 `add_to_cart` only contains the product just added. Set *Full cart content* to a variable returning all cart items (GA4 `items` format) to also send Matomo cart updates. Without it, only the Matomo event is sent.
- **Product and category views**: tick the option to also send `view_item` as a Matomo product page view (first item: SKU, name, category, price) and `view_item_list` as a category page view (`item_list_name`). It adds a page view to your reports, which is why it is off by default.

Item mapping: `item_id` → SKU, `item_name` → name, `item_category` … `item_category5` → categories, `price`, `quantity`.

### Goals

In the *Goals* table, map a GA4 event name to a Matomo goal ID. Each time the event occurs, a goal conversion is sent (optionally with the event value as revenue), in addition to the event itself.

### Custom dimensions

In the *Custom dimensions* table, map an event data key to a Matomo dimension ID, e.g. `page_type` → `6`. The value is sent with every hit of the event, when present. GA4 event parameters are available under their own name (`page_type`), user properties under their GA4 name.

### Visitor identification

- Visitor ID: first 16 hexadecimal characters of `sha256(client_id)`. Your GA4 `client_id` becomes a stable Matomo visitor, and **the tag sets no cookie**.
- User ID: GA4 `user_id`.
- Page view ID: derived from the client, session and page, so events are attached to the right page view.

---

## Tracking type "Matomo event"

Sends exactly one Matomo event with the *Event category*, *Event action*, *Event name* and *Event value* fields, for the visitor of the incoming event:

- with the Matomo Client: same site, visitor, User ID and page as the original hit;
- with the GA4 client: same visitor mapping as above (*Site ID* required).

Use GTM variables in the fields, and one tag per event you need. Goals, ecommerce and exclusions do not apply to this tracking type.

---

## Consent

When analytics consent is **denied**, the tag behaves like Matomo's `requireCookieConsent`: the hit is **still sent**, but without persistent identifiers (visitor ID `_id`, `cid`, and User ID unless you untick the option). Matomo then recognises the visit with its cookieless fingerprint (IP, browser, language, reset daily). When consent is granted, full hits are sent.

Where the consent state comes from:

| Source | GA4 events | Matomo Client hits |
|---|---|---|
| **Automatic** | GA4 consent mode (`analytics_storage` in `x-ga-gcs`). No signal = granted. | `x-matomo-consent` from the client (`matomo.js` sends no visitor ID until cookie consent is given). No signal = granted. |
| **Variable** | your variable | your variable |

> Good to know: because a hit without visitor ID is recognised by fingerprint, it can be attached to a visit of the same device that is already in progress. This is the normal cookieless behaviour of Matomo.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| The tag fails with **400** | Invalid `token_auth`, token without *write* access to the site, or unknown site ID. The server preview shows Matomo's answer. |
| The tag fails with *"Site ID is required…"* | A GA4 event reached the tag without *Site ID*. Fill it in, or restrict the trigger to the Matomo Client. |
| Visits show the IP of Google / your server | The token is missing or has no *write* access, so Matomo ignores `cip`. |
| Nothing arrives right after publishing | Server instances take one or two minutes to load a new container version. |
| Hits of one site end up in another site | *Override the site ID of Matomo Client hits* is ticked. |
| GA4 events arrive, but some are missing | Check *Events not sent to Matomo*, and that the trigger matches the GA4 client. |
| Duplicate data | Two Matomo tags fire on the same event (for example one per client without a *Client Name* condition). |

---

## FAQ

**Does it replace the Matomo tracking code?**
No. With the Matomo Client, your site keeps `matomo.js`; only its URL changes. With GA4, your site keeps gtag and Matomo is fed from the server.

**Can I send the same GA4 data to several Matomo sites?**
Yes: create one tag per site, each with its own *Site ID*.

**Why do I need a token?**
Matomo only accepts the visitor IP (`cip`) from requests authenticated with a token. Without it, all visits would show the IP of your server.

**Is the token exposed?**
No. It stays in your server container and is only sent to Matomo, in the body of HTTPS requests.

---

## For developers

- The template (code, parameters, permissions and unit tests) is in `template.tpl`. Open it in the GTM template editor; the tests run from the **Tests** tab.
- Issues and pull requests are welcome.

## License

Apache 2.0 — see [LICENSE](LICENSE).
