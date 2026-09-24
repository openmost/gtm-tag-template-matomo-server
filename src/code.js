const getAllEventData = require('getAllEventData');
const sendHttpRequest = require('sendHttpRequest');
const sha256Sync = require('sha256Sync');
const encodeUriComponent = require('encodeUriComponent');
const makeString = require('makeString');
const makeNumber = require('makeNumber');
const getType = require('getType');
const logToConsole = require('logToConsole');
const getContainerVersion = require('getContainerVersion');
const JSON = require('JSON');
const Object = require('Object');
const Math = require('Math');

const endpoint = stripTrailingSlash(data.matomoUrl) + '/matomo.php';

function stripTrailingSlash(url) {
  let result = makeString(url || '');
  while (result.length && result.charAt(result.length - 1) === '/') {
    result = result.substring(0, result.length - 1);
  }
  return result;
}

function splitList(value) {
  return makeString(value || '').split(',')
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length > 0; });
}

function log(msg) {
  if (getContainerVersion().debugMode) logToConsole('[Matomo Tag] ' + msg);
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = makeNumber(value);
  return n === n ? n : undefined;
}

function compact(obj) {
  const out = {};
  Object.keys(obj).forEach(function (k) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') out[k] = obj[k];
  });
  return out;
}

function extend(a, b) {
  const out = {};
  Object.keys(a).forEach(function (k) { out[k] = a[k]; });
  Object.keys(b).forEach(function (k) { out[k] = b[k]; });
  return out;
}

function copyObject(obj) {
  const out = {};
  Object.keys(obj).forEach(function (k) {
    out[k] = getType(obj[k]) === 'array' ? obj[k].slice(0) : obj[k];
  });
  return out;
}

function isConsentDenied(ev, replayMode) {
  if (data.consentSource === 'variable') {
    const value = makeString(data.consentValue).toLowerCase();
    return value === 'denied' || value === 'false' || value === '0';
  }
  if (replayMode) return false;
  const gcs = makeString(ev['x-ga-gcs'] || '');
  return gcs.length >= 4 && gcs.charAt(3) === '0';
}

function finalizeHit(hit, ev, replayMode) {
  ['token_auth', 'send_image'].forEach(function (k) { Object.delete(hit, k); });
  if (isConsentDenied(ev, replayMode)) {
    ['_id', 'cid', '_idn'].forEach(function (k) { Object.delete(hit, k); });
    if (data.stripUidOnDenied !== false) Object.delete(hit, 'uid');
  }
  splitList(data.removeParams).forEach(function (k) { Object.delete(hit, k); });
  (data.overrides || []).forEach(function (row) {
    if (row.key) hit[row.key] = row.value;
  });
  return hit;
}

function headersFor(ev) {
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' };
  if (ev.user_agent) headers['User-Agent'] = ev.user_agent;
  if (ev.language) headers['Accept-Language'] = ev.language;
  const context = ev['x-matomo-request'];
  if (getType(context) === 'object') {
    Object.keys(context).forEach(function (k) {
      if (k === 'ignore_cookie') {
        headers['Cookie'] = 'matomo_ignore=' + context[k];
      } else {
        headers[k] = context[k];
      }
    });
  }
  return headers;
}

function encodeHit(hit) {
  const parts = [];
  Object.keys(hit).forEach(function (k) {
    const value = hit[k];
    if (value === undefined || value === null) return;
    const values = getType(value) === 'array' ? value : [value];
    values.forEach(function (v) {
      parts.push(encodeUriComponent(k) + '=' + encodeUriComponent(makeString(v)));
    });
  });
  return parts.join('&');
}

// Hits are sent one after another: Matomo must receive them in order to attach them to the same visit.
function sendHits(hits, headers) {
  let failed = false;
  const sendNext = function (index) {
    if (index >= hits.length) {
      if (failed) {
        data.gtmOnFailure();
      } else {
        data.gtmOnSuccess();
      }
      return;
    }
    const body = encodeHit(hits[index]) + '&send_image=0&token_auth=' + encodeUriComponent(makeString(data.tokenAuth));
    sendHttpRequest(endpoint, function (statusCode, responseHeaders, responseBody) {
      if (statusCode < 200 || statusCode >= 300) {
        failed = true;
        log('Matomo responded ' + statusCode + ': ' + responseBody);
      }
      sendNext(index + 1);
    }, { method: 'POST', headers: headers, timeout: 5000 }, body);
  };
  sendNext(0);
}

function buildReplayHits(ev, raw) {
  const hit = copyObject(raw);
  if (data.idSite) hit.idsite = makeString(data.idSite);
  if (ev.ip_override) hit.cip = ev.ip_override;
  if (ev.user_agent) hit.ua = ev.user_agent;
  if (!hit.lang && ev.language) hit.lang = ev.language;
  return [hit];
}

const CATEGORY_BY_EVENT = {
  add_payment_info: 'Ecommerce', add_shipping_info: 'Ecommerce', add_to_cart: 'Ecommerce',
  add_to_wishlist: 'Ecommerce', begin_checkout: 'Ecommerce', purchase: 'Ecommerce',
  refund: 'Ecommerce', remove_from_cart: 'Ecommerce', select_item: 'Ecommerce',
  select_promotion: 'Ecommerce', view_cart: 'Ecommerce', view_item: 'Ecommerce',
  view_item_list: 'Ecommerce', view_promotion: 'Ecommerce',
  generate_lead: 'Lead', qualify_lead: 'Lead', disqualify_lead: 'Lead',
  working_lead: 'Lead', close_convert_lead: 'Lead', close_unconvert_lead: 'Lead',
  login: 'Auth', logout: 'Auth', sign_up: 'Auth',
  select_content: 'Content', share: 'Content', join_group: 'Content',
  tutorial_begin: 'Onboarding', tutorial_complete: 'Onboarding',
  level_start: 'Game', level_end: 'Game', level_up: 'Game', post_score: 'Game',
  unlock_achievement: 'Game', earn_virtual_currency: 'Game', spend_virtual_currency: 'Game',
  ad_impression: 'Advertising',
  video_start: 'Video', video_progress: 'Video', video_complete: 'Video',
  form_start: 'Form', form_submit: 'Form',
  scroll: 'Engagement'
};

function labelize(name) {
  const text = makeString(name).split('_').join(' ');
  return text.charAt(0).toUpperCase() + text.substring(1);
}

function firstDefined(list) {
  return list.filter(function (v) { return v !== undefined && v !== null && v !== ''; })[0];
}

function itemsOf(ev) {
  return getType(ev.items) === 'array' ? ev.items : [];
}

function autoEventName(ev) {
  const name = ev.event_name;
  const category = CATEGORY_BY_EVENT[name];
  const firstItem = itemsOf(ev)[0] || {};
  if (category === 'Ecommerce') {
    if (name === 'purchase' || name === 'refund') return ev.transaction_id;
    if (name === 'select_promotion' || name === 'view_promotion') return firstDefined([ev.promotion_name, firstItem.promotion_name]);
    if (name === 'view_item_list' || name === 'select_item') return firstDefined([ev.item_list_name, firstItem.item_list_name]);
    return firstItem.item_name;
  }
  if (category === 'Lead') return ev.lead_source;
  return undefined;
}

function matomoEventParams(ev) {
  return {
    e_c: firstDefined([data.eventCategory, ev.event_category, CATEGORY_BY_EVENT[ev.event_name], 'Other']),
    e_a: firstDefined([data.eventAction, ev.event_action, labelize(ev.event_name)]),
    e_n: firstDefined([data.eventName, ev.event_label, autoEventName(ev)]),
    e_v: toNumber(firstDefined([data.eventValue, ev.value]))
  };
}

function ga4BaseHit(ev) {
  const hit = {
    idsite: makeString(data.idSite),
    rec: '1',
    url: ev.page_location,
    urlref: ev.page_referrer,
    cip: ev.ip_override,
    ua: ev.user_agent,
    lang: ev.language,
    res: ev.screen_resolution,
    uid: ev.user_id
  };
  if (ev.client_id) {
    const clientId = makeString(ev.client_id);
    const visitorId = sha256Sync(clientId, { outputEncoding: 'hex' }).substring(0, 16);
    hit._id = visitorId;
    hit.cid = visitorId;
    hit.pv_id = sha256Sync(clientId + '|' + makeString(ev.ga_session_id || '') + '|' + makeString(ev.page_location || ''), { outputEncoding: 'hex' }).substring(0, 6);
  }
  (data.dimensions || []).forEach(function (row) {
    const value = ev[row.key];
    if (row.dimensionId && value !== undefined && value !== null && value !== '') {
      hit['dimension' + row.dimensionId] = value;
    }
  });
  return hit;
}

const CART_EVENTS = ['add_to_cart', 'remove_from_cart', 'view_cart'];

function round2(n) {
  return Math.round(n * 100) / 100;
}

function toEcItems(items) {
  if (getType(items) !== 'array') return [];
  return items.map(function (item) {
    const categories = [item.item_category, item.item_category2, item.item_category3, item.item_category4, item.item_category5]
      .filter(function (c) { return c !== undefined && c !== null && c !== ''; });
    return [
      makeString(item.item_id || ''),
      makeString(item.item_name || ''),
      categories.length > 1 ? categories : (categories[0] || ''),
      toNumber(item.price) || 0,
      toNumber(item.quantity) || 1
    ];
  });
}

function sumDiscount(items) {
  let total = 0;
  let found = false;
  (getType(items) === 'array' ? items : []).forEach(function (item) {
    const discount = toNumber(item.discount);
    if (discount !== undefined) {
      total = total + discount * (toNumber(item.quantity) || 1);
      found = true;
    }
  });
  return found ? round2(total) : undefined;
}

function cartTotal(items) {
  let total = 0;
  items.forEach(function (item) {
    total = total + (toNumber(item.price) || 0) * (toNumber(item.quantity) || 1);
  });
  return round2(total);
}

function productViewParams(ev) {
  const firstItem = itemsOf(ev)[0] || {};
  if (ev.event_name === 'view_item_list') {
    return { action_name: ev.page_title, _pkc: firstDefined([ev.item_list_name, firstItem.item_list_name]) };
  }
  return {
    action_name: ev.page_title,
    _pks: firstItem.item_id,
    _pkn: firstItem.item_name,
    _pkc: firstItem.item_category,
    _pkp: toNumber(firstItem.price)
  };
}

function ecommerceHits(ev, base) {
  const name = ev.event_name;
  if (name === 'purchase') {
    // GA4 "value" excludes tax and shipping; Matomo "revenue" is the grand total.
    const subtotal = toNumber(ev.value);
    const tax = toNumber(ev.tax);
    const shipping = toNumber(ev.shipping);
    return [extend(base, {
      idgoal: '0',
      ec_id: ev.transaction_id,
      revenue: subtotal === undefined ? undefined : round2(subtotal + (tax || 0) + (shipping || 0)),
      ec_st: subtotal,
      ec_tx: tax,
      ec_sh: shipping,
      ec_dt: sumDiscount(ev.items),
      ec_items: JSON.stringify(toEcItems(ev.items))
    })];
  }
  if (CART_EVENTS.indexOf(name) !== -1 && getType(data.cartItems) === 'array') {
    return [extend(base, {
      idgoal: '0',
      ec_items: JSON.stringify(toEcItems(data.cartItems)),
      revenue: cartTotal(data.cartItems)
    })];
  }
  if (data.sendProductViews && (name === 'view_item' || name === 'view_item_list')) {
    return [extend(base, productViewParams(ev))];
  }
  return [];
}

function goalHits(ev, base) {
  return (data.goals || [])
    .filter(function (row) { return row.eventName === ev.event_name && row.goalId; })
    .map(function (row) {
      return extend(base, {
        idgoal: makeString(row.goalId),
        revenue: row.useValue === 'yes' ? toNumber(ev.value) : undefined
      });
    });
}

function buildGa4Hits(ev) {
  const name = ev.event_name;
  const excluded = splitList(data.excludedEvents);
  if (!name || excluded.indexOf(name) !== -1) return [];
  const base = ga4BaseHit(ev);
  const hits = [];
  if (name === 'page_view') {
    hits.push(extend(base, { action_name: ev.page_title }));
  } else if (name === 'search' || name === 'view_search_results') {
    hits.push(extend(base, {
      search: ev.search_term,
      search_cat: data.searchCategoryKey ? ev[data.searchCategoryKey] : undefined,
      search_count: data.searchCountKey ? ev[data.searchCountKey] : undefined
    }));
  } else if (name === 'file_download') {
    hits.push(extend(base, { download: ev.link_url }));
  } else if (name === 'click' && (ev.outbound === true || ev.outbound === 'true')) {
    hits.push(extend(base, { link: ev.link_url }));
  } else {
    hits.push(extend(base, matomoEventParams(ev)));
    ecommerceHits(ev, base).forEach(function (h) { hits.push(h); });
  }
  goalHits(ev, base).forEach(function (h) { hits.push(h); });
  return hits.map(compact);
}

// ---- main ----
const eventData = getAllEventData();
const matomoHit = eventData['x-matomo-hit'];
const replayMode = getType(matomoHit) === 'object';

if (!replayMode && !data.idSite) {
  log('Site ID is required for events that do not come from the Matomo Client');
  data.gtmOnFailure();
  return;
}

const rawHits = replayMode ? buildReplayHits(eventData, matomoHit) : buildGa4Hits(eventData);
sendHits(rawHits.map(function (hit) { return finalizeHit(hit, eventData, replayMode); }), headersFor(eventData));
