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

function sendHits(hits, headers) {
  if (!hits.length) {
    data.gtmOnSuccess();
    return;
  }
  let pending = hits.length;
  let failed = false;
  hits.forEach(function (hit) {
    const body = encodeHit(hit) + '&send_image=0&token_auth=' + encodeUriComponent(makeString(data.tokenAuth));
    sendHttpRequest(endpoint, function (statusCode, responseHeaders, responseBody) {
      if (statusCode < 200 || statusCode >= 300) {
        failed = true;
        log('Matomo responded ' + statusCode + ': ' + responseBody);
      }
      pending = pending - 1;
      if (pending === 0) {
        if (failed) {
          data.gtmOnFailure();
        } else {
          data.gtmOnSuccess();
        }
      }
    }, { method: 'POST', headers: headers, timeout: 5000 }, body);
  });
}

function buildReplayHits(ev, raw) {
  const hit = copyObject(raw);
  if (data.idSite) hit.idsite = makeString(data.idSite);
  if (ev.ip_override) hit.cip = ev.ip_override;
  if (ev.user_agent) hit.ua = ev.user_agent;
  if (!hit.lang && ev.language) hit.lang = ev.language;
  return [hit];
}

// Replaced in Task 7.
function buildGa4Hits(ev) {
  return [];
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
