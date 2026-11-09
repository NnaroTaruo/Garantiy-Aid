const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// Exercises the push module, settings card and alert bridge without a device, Expo project or FCM.
function loadSource(file, mocks, globals = {}) {
  const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const exports = {};
  const required = [];
  vm.runInNewContext(output, { ...globals, exports, Promise, require: (name) => {
    required.push(name);
    assert.ok(name in mocks, `Unexpected import: ${name}`);
    return mocks[name];
  } });
  return Object.assign(exports, { required });
}
const tick = () => new Promise(setImmediate);
const plain = (value) => JSON.parse(JSON.stringify(value));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
class ApiRequestError extends Error {
  constructor(status, code = 'REQUEST_FAILED') { super(code); this.status = status; this.code = code; }
}
const PROJECT = '0f1e2d3c-4b5a-4968-8776-655443322110';
const NOTICE = '7a6b5c4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d';
class PushSetupError extends Error { constructor(reason) { super(reason); this.reason = reason; } }
const TOKEN = 'ExponentPushToken[synthetic-phone-token]';

function hooks() {
  const slots = [], effects = [];
  let cursor = 0;
  const useState = (initial) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = initial;
    return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
  };
  return {
    react: {
      createElement: (type, props, ...children) => ({ type, props, children }), useState,
      useRef: (initial) => useState({ current: initial })[0],
      useEffect: (effect, deps) => {
        const index = cursor++, previous = slots[index];
        if (previous && deps && deps.every((value, i) => Object.is(value, previous.deps[i]))) return;
        effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: effect() }; });
      },
    },
    render: (component) => { cursor = 0; return component(); },
    flush: () => { while (effects.length) effects.shift()(); },
    unmount: () => slots.forEach((slot) => slot?.cleanup?.()),
  };
}
const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === 'object' ? [node, ...nodes(node.children ?? [])] : [];
const text = (tree) => nodes(tree).flatMap((node) => node.children ?? []).filter((child) => typeof child === 'string').join(' ');

function fakeNotifications({ granted = false, canAskAgain = true, afterRequest = { granted: true, canAskAgain: true }, tokenError = false } = {}) {
  const calls = [];
  const N = {
    AndroidImportance: { HIGH: 6 }, AndroidNotificationVisibility: { PRIVATE: 2 }, DEFAULT_ACTION_IDENTIFIER: 'default',
    setNotificationChannelAsync: async (id, channel) => { calls.push(['channel', id, channel]); },
    getPermissionsAsync: async () => { calls.push(['permission']); return { granted, canAskAgain, status: granted ? 'granted' : 'undetermined' }; },
    requestPermissionsAsync: async () => { calls.push(['request']); return afterRequest; },
    getExpoPushTokenAsync: async (options) => { calls.push(['token', options]); if (tokenError) throw new Error(`network failed for ${TOKEN}`); return { data: TOKEN }; },
    dismissAllNotificationsAsync: async () => { calls.push(['dismiss']); },
    setBadgeCountAsync: async (count) => { calls.push(['badge', count]); },
  };
  return { N, calls };
}

function pushModule({ os = 'android', environment = 'standalone', projectId = PROJECT, notifications = fakeNotifications(), api = {}, stored = null } = {}) {
  const store = { value: stored, writes: [] };
  const source = loadSource('push.ts', {
    'react-native': { Platform: { OS: os } },
    'expo-constants': { __esModule: true, ExecutionEnvironment: { StoreClient: 'storeClient' },
      default: { executionEnvironment: environment, expoConfig: projectId ? { extra: { eas: { projectId } } } : { extra: {} }, easConfig: null } },
    'expo-secure-store': {
      getItemAsync: async () => store.value,
      setItemAsync: async (_key, value) => { store.writes.push(['set', value]); store.value = value; },
      deleteItemAsync: async () => { store.writes.push(['delete']); store.value = null; },
    },
    'expo-notifications': notifications.N,
    './api': { getPushDevice: async () => ({ status: 'off', enabled: false }), registerPushDevice: async (_token, input) => ({ status: 'on', enabled: true, language: input.language }),
      removePushDevice: async () => ({ status: 'off', enabled: false }), ...api },
  });
  return { source, store, calls: notifications.calls };
}

test('push is available only in Android builds with an EAS project; Expo Go and web never load expo-notifications', async () => {
  for (const [options, expected] of [
    [{ os: 'web' }, 'web'], [{ os: 'ios' }, 'unsupported'], [{ environment: 'storeClient' }, 'expo-go'],
    [{ projectId: null }, 'unconfigured'], [{ projectId: 'not-a-project' }, 'unconfigured'], [{}, 'ready'],
  ]) {
    const { source } = pushModule(options);
    assert.equal(source.pushAvailability(), expected);
    assert.equal(source.notificationsModule() === null, expected !== 'ready');
    if (expected !== 'ready') {
      assert.equal(await source.pushPermission(), null);
      await assert.rejects(source.enablePhoneAlerts('session', 'owner', 'en'), (error) => error.reason === 'unavailable');
      assert.equal(await source.resumePhoneAlerts('session', 'owner', 'en'), false);
      await source.clearPhoneAlerts();
      assert.ok(!source.required.includes('expo-notifications'), `${expected} must not import expo-notifications`);
    }
  }
});

test('turning on phone alerts creates the channel before the permission prompt and sends the token only in the request body', async () => {
  const notifications = fakeNotifications();
  let registered;
  const { source, store, calls } = pushModule({ notifications, api: { registerPushDevice: async (session, input) => { registered = { session, input }; return { status: 'on', enabled: true, language: input.language }; } } });
  assert.equal(source.easProjectId(), PROJECT);
  const state = await source.enablePhoneAlerts('owner-session', 'owner-id', 'bs');
  assert.deepEqual(calls.map(([name]) => name), ['channel', 'permission', 'request', 'token']);
  assert.deepEqual(calls[0].slice(0, 2), ['channel', 'account-updates']);
  assert.equal(calls[0][2].name, 'Mga update sa account');
  assert.equal(calls[0][2].lockscreenVisibility, 2, 'Private lock-screen visibility');
  assert.deepEqual({ ...calls[3][1] }, { projectId: PROJECT });
  assert.deepEqual(plain(registered), { session: 'owner-session', input: { token: TOKEN, platform: 'android', language: 'bs' } });
  assert.equal(state.status, 'on');
  assert.deepEqual(store.writes, [['set', 'owner-id']], 'Only the account id is remembered, never the token');
});

test('denied, blocked and token failures report setup reasons without registering or exposing the token', async () => {
  for (const [options, reason] of [
    [{ afterRequest: { granted: false, canAskAgain: true } }, 'denied'],
    [{ canAskAgain: false }, 'blocked'],
    [{ afterRequest: { granted: false, canAskAgain: false } }, 'blocked'],
    [{ granted: true, tokenError: true }, 'token'],
  ]) {
    let registered = 0;
    const { source, store, calls } = pushModule({ notifications: fakeNotifications(options), api: { registerPushDevice: async () => { registered++; } } });
    await assert.rejects(source.enablePhoneAlerts('session', 'owner', 'en'), (error) => error.reason === reason && !error.message.includes('PushToken'));
    assert.equal(registered, 0);
    assert.deepEqual(store.writes, []);
    if (options.canAskAgain === false) assert.ok(!calls.some(([name]) => name === 'request'), 'A blocked permission is not re-prompted');
  }
});

test('resuming on a new session never prompts and only continues for the account that opted in on this phone', async () => {
  for (const [stored, server, granted, expected] of [
    ['owner', 'off', true, true], ['someone-else', 'off', true, false], [null, 'off', true, false],
    ['owner', 'on', true, true], ['owner', 'unavailable', true, false], ['owner', 'invalid', false, false],
  ]) {
    let registrations = 0;
    const notifications = fakeNotifications({ granted, canAskAgain: true, afterRequest: { granted: true } });
    const { source, calls } = pushModule({ stored, notifications, api: {
      getPushDevice: async () => ({ status: server }), registerPushDevice: async () => { registrations++; return { status: 'on', enabled: true }; } } });
    assert.equal(await source.resumePhoneAlerts('session', 'owner', 'en'), expected);
    assert.ok(!calls.some(([name]) => name === 'request'), 'Resuming never shows the permission prompt');
    assert.equal(registrations, stored === 'owner' && ['off', 'invalid'].includes(server) && granted ? 1 : 0);
  }
  const failing = pushModule({ stored: 'owner', api: { getPushDevice: async () => { throw new ApiRequestError(500); } } });
  assert.equal(await failing.source.resumePhoneAlerts('session', 'owner', 'en'), false);
});

test('turning off forgets the opt-in, and alerts already shown are cleared for account changes', async () => {
  const { source, store, calls } = pushModule({ stored: 'owner' });
  assert.equal((await source.disablePhoneAlerts('session')).status, 'off');
  assert.deepEqual(store.writes, [['delete']]);
  await source.clearPhoneAlerts();
  assert.deepEqual(calls, [['dismiss'], ['badge', 0]]);
  const failed = pushModule({ api: { removePushDevice: async () => { throw new ApiRequestError(503); } }, stored: 'owner' });
  await assert.rejects(failed.source.disablePhoneAlerts('session'));
  assert.equal(failed.store.value, 'owner', 'A failed removal keeps the opt-in so the user can retry');
});

test('only GarantiyAid alert payloads with a notification id are accepted', () => {
  const { source } = pushModule();
  assert.equal(source.alertNotificationId({ kind: 'garantiyaid.notification', notificationId: NOTICE }), NOTICE);
  for (const data of [null, 'x', {}, { kind: 'other', notificationId: NOTICE }, { kind: 'garantiyaid.notification', notificationId: '../wallet' }, { kind: 'garantiyaid.notification', notificationId: 7 }]) {
    assert.equal(source.alertNotificationId(data), null);
  }
});

test('push device API calls keep the token out of URLs and send it once in the JSON body', async () => {
  const requests = [];
  const source = loadSource('api.ts', { 'react-native': { Platform: { OS: 'android' } } }, {
    process: { env: { EXPO_PUBLIC_API_URL: 'http://10.0.2.2:4000/api/v1/mobile' } }, AbortController, setTimeout, clearTimeout,
    fetch: async (url, init) => { requests.push({ url, init }); return { status: 200, ok: true, json: async () => ({ data: { status: 'on' } }) }; },
  });
  await source.getPushDevice('session');
  await source.registerPushDevice('session', { token: TOKEN, platform: 'android', language: 'en' });
  await source.removePushDevice('session');
  assert.deepEqual(requests.map(({ url, init }) => [init.method ?? 'GET', url]), [
    ['GET', 'http://10.0.2.2:4000/api/v1/mobile/beneficiaries/me/push-device'],
    ['PUT', 'http://10.0.2.2:4000/api/v1/mobile/beneficiaries/me/push-device'],
    ['DELETE', 'http://10.0.2.2:4000/api/v1/mobile/beneficiaries/me/push-device'],
  ]);
  assert.ok(requests.every(({ url, init }) => !url.includes('PushToken') && init.headers.Authorization === 'Bearer session'));
  assert.deepEqual(JSON.parse(requests[1].init.body), { token: TOKEN, platform: 'android', language: 'en' });
});

function phoneAlerts({ availability = 'ready', language = 'en', push = {}, api = {} } = {}) {
  const runtime = hooks();
  let resets = 0, opened = 0;
  const state = { accessToken: 'owner-session', beneficiary: { id: 'owner-id' }, language, reset: async () => { resets++; }, t: (en, bs) => language === 'en' ? en : bs };
  const source = loadSource('screens/phone-alerts.tsx', {
    react: runtime.react, 'react-native': { Linking: { openSettings: async () => { opened++; } }, View: 'View' },
    'lucide-react-native': { Bell: 'Bell' }, '../components': { Button: 'Button', Card: 'Card', Notice: 'Notice', Txt: 'Txt' },
    '../api': { ApiRequestError, getPushDevice: async () => ({ configured: true, status: 'off', enabled: false }), ...api },
    '../push': { pushAvailability: () => availability, pushPermission: async () => 'ask', PushSetupError,
      enablePhoneAlerts: async () => ({ configured: true, status: 'on', enabled: true }), disablePhoneAlerts: async () => ({ configured: true, status: 'off', enabled: false }), ...push },
    '../state': { useDemo: () => state }, '../theme': { colors: {} },
  });
  const view = () => runtime.render(source.PhoneAlerts);
  const button = (label) => nodes(view()).find((node) => node.type === 'Button' && node.children.includes(state.t(...label)));
  return { runtime, view, button, state, resets: () => resets, opened: () => opened, say: (en, bs) => state.t(en, bs) };
}

test('phone alert settings explain unavailable builds in English and Bisaya without loading device state', async () => {
  for (const language of ['en', 'bs']) for (const [availability, en, bs] of [
    ['web', 'Phone alerts work in the GarantiyAid Android app.', 'Ang mga alerto sa cellphone molihok sa GarantiyAid Android app.'],
    ['expo-go', 'Expo Go cannot receive them.', 'Dili kini madawat sa Expo Go.'],
    ['unconfigured', 'This copy of the app is not set up for phone alerts yet.', 'Kining kopya sa app wala pa ma-set up alang sa mga alerto.'],
    ['unsupported', 'available on Android only for now', 'Sa Android lamang magamit karon'],
  ]) {
    let loads = 0;
    const screen = phoneAlerts({ availability, language, api: { getPushDevice: async () => { loads++; } } });
    const shown = text(screen.view());
    screen.runtime.flush(); await tick();
    assert.ok(shown.includes(language === 'en' ? en : bs), `${availability} ${language}`);
    assert.equal(loads, 0);
    assert.ok(!nodes(screen.view()).some((node) => node.type === 'Button'), 'Nothing to turn on in an unsupported build');
  }
});

test('turning phone alerts on happens only from the button, once, and shows the saved result in both languages', async () => {
  for (const language of ['en', 'bs']) {
    let enables = 0;
    const result = deferred();
    const screen = phoneAlerts({ language, push: { enablePhoneAlerts: async (session, beneficiaryId, lang) => {
      enables++; assert.deepEqual([session, beneficiaryId, lang], ['owner-session', 'owner-id', language]); return result.promise; } } });
    screen.view(); screen.runtime.flush(); await tick();
    assert.equal(enables, 0, 'Opening settings never requests permission');
    const turnOn = screen.button(['Turn on phone alerts', 'I-on ang mga alerto sa cellphone']);
    assert.ok(text(screen.view()).includes(screen.say('Alerts never show your name, programs or amounts.', 'Dili makita sa alerto ang imong ngalan, programa o kantidad.')));
    const pending = turnOn.props.onPress();
    screen.button(['Turn on phone alerts', 'I-on ang mga alerto sa cellphone']).props.onPress();
    assert.equal(enables, 1, 'Repeated taps are ignored while setting up');
    result.resolve({ configured: true, status: 'on', enabled: true }); await pending; await tick();
    assert.ok(text(screen.view()).includes(screen.say('Phone alerts are on for this phone.', 'Naka-on ang mga alerto niining cellphone.')));
    assert.ok(screen.button(['Turn off phone alerts', 'I-off ang mga alerto sa cellphone']));
  }
});

test('denied, blocked, token, server and connection problems show retry guidance; 401 signs out', async () => {
  const cases = [
    ['denied', 'Notifications were not allowed, so phone alerts are still off.', false],
    ['blocked', 'Android is blocking notifications for GarantiyAid.', true],
    ['token', 'This phone could not be set up for alerts.', false],
  ];
  for (const [reason, message, settings] of cases) {
    const source = phoneAlerts({ push: { enablePhoneAlerts: async () => { throw new PushSetupError(reason); } } });
    source.view(); source.runtime.flush(); await tick();
    await source.button(['Turn on phone alerts', '']).props.onPress(); await tick();
    assert.ok(text(source.view()).includes(message), reason);
    assert.ok(source.button(['Turn on phone alerts', '']), 'The user can try again');
    const openSettings = source.button(['Open Android settings', '']);
    assert.equal(Boolean(openSettings), settings);
    if (settings) { await openSettings.props.onPress(); assert.equal(source.opened(), 1); }
  }
  const unavailable = phoneAlerts({ push: { enablePhoneAlerts: async () => { throw new ApiRequestError(503, 'PUSH_UNAVAILABLE'); } } });
  unavailable.view(); unavailable.runtime.flush(); await tick();
  await unavailable.button(['Turn on phone alerts', '']).props.onPress(); await tick();
  assert.ok(text(unavailable.view()).includes('Phone alerts are not set up on this server yet.'));
  assert.ok(!unavailable.button(['Turn on phone alerts', '']));
  const offline = phoneAlerts({ push: { disablePhoneAlerts: async () => { throw new ApiRequestError(undefined, 'NETWORK_ERROR'); } },
    api: { getPushDevice: async () => ({ configured: true, status: 'on', enabled: true }) } });
  offline.view(); offline.runtime.flush(); await tick();
  await offline.button(['Turn off phone alerts', '']).props.onPress(); await tick();
  assert.ok(text(offline.view()).includes('We could not confirm the change.'));
  assert.ok(offline.button(['Turn off phone alerts', '']), 'A failed removal keeps alerts shown as on');
  const expired = phoneAlerts({ api: { getPushDevice: async () => { throw new ApiRequestError(401); } } });
  expired.view(); expired.runtime.flush(); await tick();
  assert.equal(expired.resets(), 1);
  const failedLoad = phoneAlerts({ api: { getPushDevice: async () => { throw new ApiRequestError(500); } } });
  failedLoad.view(); failedLoad.runtime.flush(); await tick();
  assert.ok(text(failedLoad.view()).includes('Phone alert status could not be loaded.'));
  assert.ok(failedLoad.button(['Try again', '']));
});

test('saved server states: unavailable, invalid tokens and OS-blocked notifications are explained', async () => {
  const unavailable = phoneAlerts({ api: { getPushDevice: async () => ({ configured: false, status: 'unavailable', enabled: false }) } });
  unavailable.view(); unavailable.runtime.flush(); await tick();
  assert.ok(text(unavailable.view()).includes('Phone alerts are not set up on this server yet.'));
  assert.ok(!nodes(unavailable.view()).some((node) => node.type === 'Button'));
  const invalid = phoneAlerts({ api: { getPushDevice: async () => ({ configured: true, status: 'invalid', enabled: false }) } });
  invalid.view(); invalid.runtime.flush(); await tick();
  assert.ok(text(invalid.view()).includes('Phone alerts stopped working on this phone. Turn them on again.'));
  assert.ok(invalid.button(['Turn on phone alerts again', '']));
  const blocked = phoneAlerts({ push: { pushPermission: async () => 'blocked' }, api: { getPushDevice: async () => ({ configured: true, status: 'on', enabled: true }) } });
  blocked.view(); blocked.runtime.flush(); await tick();
  assert.ok(text(blocked.view()).includes('Phone alerts are on, but Android is blocking notifications for GarantiyAid.'));
  assert.ok(blocked.button(['Open Android settings', '']));
});

test('late phone alert responses cannot change a closed settings screen or sign out another account', async () => {
  for (const outcome of ['success', 'unauthorized']) {
    const waiting = deferred();
    let resets = 0;
    const screen = phoneAlerts({ api: { getPushDevice: async () => waiting.promise } });
    screen.state.reset = async () => { resets++; };
    screen.view(); screen.runtime.flush(); await tick();
    screen.runtime.unmount();
    if (outcome === 'success') waiting.resolve({ configured: true, status: 'on', enabled: true }); else waiting.reject(new ApiRequestError(401));
    await tick();
    assert.equal(resets, 0);
    assert.ok(text(screen.view()).includes('Checking phone alerts'));
  }
});

function bridge({ accessToken = 'owner-session', beneficiaryId = 'owner-id', navigationReady = false, launch = null } = {}) {
  const runtime = hooks();
  const listeners = {}, calls = [];
  let cleared = 0;
  const N = {
    DEFAULT_ACTION_IDENTIFIER: 'default',
    setNotificationHandler: (handler) => { calls.push(['handler', handler]); },
    addNotificationResponseReceivedListener: (listener) => { listeners.response = listener; return { remove: () => { delete listeners.response; } }; },
    addNotificationReceivedListener: (listener) => { listeners.received = listener; return { remove: () => { delete listeners.received; } }; },
    addPushTokenListener: (listener) => { listeners.token = listener; return { remove: () => { delete listeners.token; } }; },
    getLastNotificationResponseAsync: async () => launch,
    clearLastNotificationResponseAsync: async () => { cleared++; },
  };
  const state = { accessToken, beneficiary: beneficiaryId ? { id: beneficiaryId } : null, language: 'bs', refreshNotifications: async () => { calls.push(['refresh']); } };
  const source = loadSource('push-bridge.tsx', {
    react: runtime.react, './components': { go: (screen, params) => calls.push(['go', screen, params]) },
    './state': { useDemo: () => state },
    './push': { notificationsModule: () => Promise.resolve(N), clearPhoneAlerts: async () => { calls.push(['clear']); },
      resumePhoneAlerts: async (...args) => { calls.push(['resume', ...args]); return true; },
      alertNotificationId: (data) => data?.kind === 'garantiyaid.notification' ? data.notificationId : null },
  });
  const props = { navigationReady };
  const render = () => { runtime.render(() => source.PushBridge(props)); runtime.flush(); };
  return { render, props, state, listeners, calls, cleared: () => cleared, unmount: runtime.unmount };
}
const response = (data, identifier = 'alert-1', actionIdentifier = 'default') => ({ actionIdentifier, notification: { request: { identifier, content: { data } } } });

test('an alert that launched the app opens its notice through the signed-in account once navigation is ready', async () => {
  const app = bridge({ launch: response({ kind: 'garantiyaid.notification', notificationId: NOTICE }) });
  app.render(); await tick(); await tick();
  assert.ok(!app.calls.some(([name]) => name === 'go'), 'Navigation waits for session restoration');
  const [, handler] = app.calls.find(([name]) => name === 'handler');
  assert.deepEqual({ ...await handler.handleNotification() }, { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false });
  app.props.navigationReady = true; app.render();
  assert.deepEqual(plain(app.calls.filter(([name]) => name === 'go')), [['go', 'notification-details', { id: NOTICE }]]);
  assert.equal(app.cleared(), 1);
  app.listeners.response(response({ kind: 'garantiyaid.notification', notificationId: NOTICE }));
  assert.equal(app.calls.filter(([name]) => name === 'go').length, 1, 'The same alert is not opened twice');
  for (const ignored of [response({ kind: 'other', notificationId: NOTICE }, 'alert-2'), response({ kind: 'garantiyaid.notification', notificationId: NOTICE }, 'alert-3', 'dismiss')]) app.listeners.response(ignored);
  assert.equal(app.calls.filter(([name]) => name === 'go').length, 1);
  app.unmount();
  assert.deepEqual(Object.keys(app.listeners), [], 'Listeners are removed on unmount');
});

test('signed-out alerts open nothing; received alerts refresh the inbox; account changes clear shown alerts and resume only the owner', async () => {
  const app = bridge({ accessToken: '', beneficiaryId: '', navigationReady: true });
  app.render(); await tick(); await tick();
  app.listeners.response(response({ kind: 'garantiyaid.notification', notificationId: NOTICE }));
  assert.ok(!app.calls.some(([name]) => name === 'go'));
  app.listeners.received({ request: { content: { data: { kind: 'garantiyaid.notification', notificationId: NOTICE } } } });
  assert.ok(!app.calls.some(([name]) => name === 'refresh'), 'No inbox refresh without a session');
  app.state.accessToken = 'owner-session'; app.state.beneficiary = { id: 'owner-id' }; app.render();
  assert.deepEqual(app.calls.filter(([name]) => name === 'resume'), [['resume', 'owner-session', 'owner-id', 'bs']]);
  app.listeners.received({ request: { content: { data: { kind: 'garantiyaid.notification', notificationId: NOTICE } } } });
  assert.equal(app.calls.filter(([name]) => name === 'refresh').length, 1);
  app.listeners.token({ type: 'android', data: 'rotated' });
  assert.equal(app.calls.filter(([name]) => name === 'resume').length, 2, 'A rotated token re-registers the current owner');
  app.state.accessToken = ''; app.state.beneficiary = null; app.render();
  assert.equal(app.calls.filter(([name]) => name === 'clear').length, 1, 'Logout clears alerts already shown');
  app.state.accessToken = 'other-session'; app.state.beneficiary = { id: 'other-id' }; app.render();
  assert.deepEqual(app.calls.filter(([name]) => name === 'resume').at(-1), ['resume', 'other-session', 'other-id', 'bs']);
  app.unmount();
});

test('a notification opened from an alert is loaded once through the current account before it is called unavailable', async () => {
  const runtime = hooks();
  let refreshes = 0;
  const waiting = deferred();
  const state = { accessToken: 'owner', notifications: [], notificationsLoading: false, notificationsError: false,
    refreshNotifications: () => { refreshes++; return waiting.promise; }, markRead: async () => true, t: (en) => en };
  const components = new Proxy({}, { get: (_, key) => String(key) });
  const source = loadSource('screens/details.tsx', {
    react: runtime.react, 'react-native': { StyleSheet: { create: (styles) => styles } },
    'expo-router': { useLocalSearchParams: () => ({ page: 'notification-details', id: NOTICE }) },
    'lucide-react-native': components, '../components': components, '../state': { useDemo: () => state, peso: String },
    '../api': {}, '../format': { formatDateTime: (value) => value }, '../theme': { colors: {}, fonts: {} },
    'expo-document-picker': {}, 'react-native-qrcode-svg': 'QRCode', './main': { s: {} },
    './biometrics': {}, './support': {}, './document-checklist': {}, './document-preview': {}, './notification-settings': {},
  });
  const content = () => JSON.stringify(runtime.render(() => source.DetailScreen().children[0].children[0].type()));
  content(); runtime.flush();
  assert.equal(refreshes, 1);
  assert.ok(content().includes('Loading notifications'));
  runtime.flush();
  assert.equal(refreshes, 1, 'Only one lookup per notice and account');
  waiting.resolve(); await tick();
  assert.ok(content().includes('Notification unavailable.'), 'Another account\'s alert reveals nothing');
});
