const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the source with controlled requests and storage, without an emulator.
function loadSource(file, mocks, globals = {}) {
  const output = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } },
  ).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    ...globals,
    exports,
    require: (name) => {
      assert.ok(name in mocks, `Unexpected import: ${name}`);
      return mocks[name];
    },
  });
  return exports;
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

class ApiRequestError extends Error {
  constructor(status, fields, code = 'REQUEST_FAILED') { super('Request failed'); this.status = status; this.fields = fields; this.code = code; }
}
const beneficiary = (id) => ({ id, firstName: id, middleName: null, lastName: 'Test', contactNumber: '+639000000000' });
const overview = (id) => ({ enrollments: [{ id }], nextSchedule: null });
const wallet = (id) => ({ wallet: { id, balance: 1500 }, currentClaim: null, claims: [], transactions: [] });
const document = (id) => ({ id, docType: 'proof_of_residency', originalName: `${id}.pdf`, mimeType: 'application/pdf', sizeBytes: 30, status: 'received', createdAt: '2026-10-20T01:00:00Z' });

function provider(api = {}, storage = {}) {
  const slots = [];
  let cursor = 0;
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    createElement: (type, props) => ({ type, props }),
    useEffect: () => {},
    useState: (initial) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (value) => {
        slots[index] = typeof value === 'function' ? value(slots[index]) : value;
      }];
    },
    useRef: (initial) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
  };
  const source = loadSource('state.tsx', {
    react,
    './api': {
      ApiRequestError,
      getCurrentBeneficiary: async (token) => beneficiary(token),
      getBeneficiaryOverview: async (token) => overview(token),
      getWalletOverview: async (token) => wallet(token),
      getNotifications: async () => [],
      markNotificationRead: async (_token, id) => ({ id, readAt: '2026-10-20T01:00:00Z' }),
      updateProfile: async (token, input) => ({ ...beneficiary(token), ...input }),
      getDocuments: async () => [],
      uploadDocument: async () => document('saved'),
      ...api,
    },
    './session-storage': {
      getStoredToken: async () => 'restored',
      storeToken: async () => {},
      clearStoredToken: async () => {},
      ...storage,
    },
  });
  return () => {
    cursor = 0;
    return source.DemoProvider({ children: null }).props.value;
  };
}

test('logout discards pending wallet and schedule responses', async () => {
  const waitingWallet = deferred(), waitingOverview = deferred(), started = deferred();
  const render = provider({
    getBeneficiaryOverview: () => waitingOverview.promise,
    getWalletOverview: () => { started.resolve(); return waitingWallet.promise; },
  });
  const signingIn = render().startSession('old', beneficiary('old'));
  await started.promise;
  await render().reset();
  waitingWallet.resolve(wallet('old'));
  waitingOverview.resolve(overview('old'));
  await signingIn;
  assert.equal(render().accessToken, '');
  assert.equal(render().wallet, null);
  assert.equal(render().overview, null);
  assert.equal(render().walletLoading, false);
  assert.equal(render().overviewLoading, false);
});

for (const outcome of ['success', 'unauthorized']) {
  test(`old ${outcome} responses cannot overwrite or sign out a new account`, async () => {
    const waitingWallet = deferred(), waitingOverview = deferred(), started = deferred();
    let oldWalletRequests = 0;
    const render = provider({
      getBeneficiaryOverview: (token) => token === 'old' ? waitingOverview.promise : overview(token),
      getWalletOverview: (token) => {
        if (token !== 'old') return wallet(token);
        oldWalletRequests++;
        started.resolve();
        return waitingWallet.promise;
      },
    });
    const signingIn = render().startSession('old', beneficiary('old'));
    await started.promise;
    const staleRefresh = render().refreshWallet;
    await render().startSession('new', beneficiary('new'));
    await staleRefresh();
    assert.equal(oldWalletRequests, 1);
    waitingOverview.resolve(overview('old'));
    if (outcome === 'unauthorized') waitingWallet.reject(new ApiRequestError(401));
    else waitingWallet.resolve(wallet('old'));
    await signingIn;
    assert.equal(render().accessToken, 'new');
    assert.equal(render().beneficiary.id, 'new');
    assert.equal(render().wallet.wallet.id, 'new');
    assert.equal(render().overview.enrollments[0].id, 'new');
    assert.equal(render().walletError, false);
  });
}

test('a current 401 clears the session and invalidates its other pending responses', async () => {
  const waitingOverview = deferred(), cleared = deferred();
  const render = provider({
    getBeneficiaryOverview: () => waitingOverview.promise,
    getWalletOverview: async () => { throw new ApiRequestError(401); },
  }, { clearStoredToken: async () => { cleared.resolve(); } });
  const signingIn = render().startSession('expired', beneficiary('expired'));
  await cleared.promise;
  waitingOverview.resolve(overview('expired'));
  await signingIn;
  assert.equal(render().accessToken, '');
  assert.equal(render().wallet, null);
  assert.equal(render().overview, null);
});

test('logout cancels an unfinished session restoration', async () => {
  const waitingBeneficiary = deferred(), started = deferred();
  const render = provider({
    getCurrentBeneficiary: () => { started.resolve(); return waitingBeneficiary.promise; },
  });
  const restoring = render().restoreSession();
  await started.promise;
  await render().reset();
  waitingBeneficiary.resolve(beneficiary('restored'));
  await restoring;
  assert.equal(render().accessToken, '');
  assert.equal(render().beneficiary, null);
  assert.equal(render().wallet, null);
  assert.equal(render().authLoading, false);
});

test('notification reads require server success and survive an older refresh response', async () => {
  const waiting = deferred();
  let reads = 0, loads = 0;
  const render = provider({
    getNotifications: async () => ++loads === 1 ? [{ id: 'message', readAt: null }] : waiting.promise,
    markNotificationRead: async (_token, id) => {
      if (++reads === 1) throw new Error('Offline');
      return { id, readAt: 'saved-read' };
    },
  });
  await render().startSession('owner', beneficiary('owner'));
  assert.equal(await render().markRead('message'), false);
  assert.equal(render().notifications[0].readAt, null);
  const refreshing = render().refreshNotifications();
  assert.equal(await render().markRead('message'), true);
  waiting.resolve([{ id: 'message', readAt: null }]);
  await refreshing;
  assert.equal(render().notifications[0].readAt, 'saved-read');
});

for (const outcome of ['logout', 'success', 'unauthorized']) {
  test(`pending notification loads and reads are isolated after ${outcome}`, async () => {
    const waitingLoad = deferred(), waitingRead = deferred(), started = deferred();
    let oldReads = 0, oldLoads = 0;
    const render = provider({
      getNotifications: (token) => {
        if (token !== 'old') return [{ id: token, readAt: null }];
        oldLoads++;
        started.resolve();
        return waitingLoad.promise;
      },
      markNotificationRead: () => { oldReads++; return waitingRead.promise; },
    });
    const signingIn = render().startSession('old', beneficiary('old'));
    await started.promise;
    const staleRead = render().markRead, staleRefresh = render().refreshNotifications;
    const reading = staleRead('old');
    if (outcome === 'logout') await render().reset();
    else await render().startSession('new', beneficiary('new'));
    assert.equal(await staleRead('old'), false);
    await staleRefresh();
    assert.equal(oldReads, 1);
    assert.equal(oldLoads, 1);
    waitingLoad.resolve([{ id: 'old', readAt: null }]);
    if (outcome === 'unauthorized') waitingRead.reject(new ApiRequestError(401));
    else waitingRead.resolve({ id: 'old', readAt: 'saved' });
    await Promise.all([signingIn, reading]);
    assert.equal(render().accessToken, outcome === 'logout' ? '' : 'new');
    assert.equal(render().notifications.length, outcome === 'logout' ? 0 : 1);
    if (outcome !== 'logout') assert.equal(render().notifications[0].id, 'new');
    assert.equal(render().notificationsLoading, false);
    assert.equal(render().notificationsError, false);
  });
}

test('notification load errors can be retried; a current 401 clears account data', async () => {
  let error = new Error('Offline');
  const render = provider({ getNotifications: async () => { if (error) throw error; return []; } });
  await render().startSession('owner', beneficiary('owner'));
  assert.equal(render().notificationsError, true);
  assert.equal(render().wallet.wallet.id, 'owner');
  error = null;
  await render().refreshNotifications();
  assert.equal(render().notificationsError, false);
  error = new ApiRequestError(401);
  assert.equal(await render().markRead('message'), true);
  await render().refreshNotifications();
  assert.equal(render().accessToken, '');
  assert.equal(render().wallet, null);
  assert.equal(render().notifications.length, 0);
});

test('profile saves update the shared identity only after success and preserve it on failure', async () => {
  const render = provider();
  await render().startSession('owner', beneficiary('owner'));
  const updated = await render().saveProfile({ firstName: 'María', middleName: null, lastName: 'Dela Cruz', address: '24 New Street' });
  assert.equal(updated.address, '24 New Street');
  assert.equal(render().beneficiary.address, '24 New Street');
  assert.equal(render().name, 'María Dela Cruz');
  let failure = new Error('Offline');
  const failing = provider({ updateProfile: async () => { throw failure; } });
  await failing().startSession('owner', beneficiary('owner'));
  await assert.rejects(failing().saveProfile({ firstName: 'Never applied' }));
  assert.equal(failing().beneficiary.firstName, 'owner');
  failure = new ApiRequestError(401);
  assert.equal(await failing().saveProfile({ firstName: 'Never applied' }), null);
  assert.equal(failing().accessToken, '');
  assert.equal(failing().beneficiary, null);
});

for (const outcome of ['logout', 'success', 'unauthorized']) {
  test(`pending profile saves cannot alter an account after ${outcome}`, async () => {
    const waiting = deferred();
    let writes = 0;
    const render = provider({ updateProfile: () => { writes++; return waiting.promise; } });
    await render().startSession('old', beneficiary('old'));
    const staleSave = render().saveProfile;
    const saving = staleSave({ firstName: 'Old changed name' });
    if (outcome === 'logout') await render().reset();
    else await render().startSession('new', beneficiary('new'));
    assert.equal(await staleSave({ firstName: 'No request' }), null);
    assert.equal(writes, 1);
    if (outcome === 'unauthorized') waiting.reject(new ApiRequestError(401));
    else waiting.resolve({ ...beneficiary('old'), firstName: 'Old changed name' });
    assert.equal(await saving, null);
    assert.equal(render().accessToken, outcome === 'logout' ? '' : 'new');
    assert.equal(render().beneficiary?.id ?? null, outcome === 'logout' ? null : 'new');
    assert.ok(!render().name.includes('Old changed name'));
  });
}

test('the profile API keeps server field errors for the form', async () => {
  const source = loadSource('api.ts', { 'react-native': { Platform: { OS: 'web' } } }, {
    process: { env: {} }, AbortController, setTimeout, clearTimeout,
    fetch: async (_url, init) => {
      assert.equal(init.method, 'PATCH');
      assert.equal(init.headers.Authorization, 'Bearer owner');
      return { status: 422, ok: false, json: async () => ({ error: {
        code: 'VALIDATION_ERROR', message: 'Check the name', fields: { firstName: 'Use letters' },
      } }) };
    },
  });
  await assert.rejects(source.updateProfile('owner', { firstName: '123' }),
    (error) => error.status === 422 && error.fields.firstName === 'Use letters');
});

test('a pre-upload document list cannot hide a confirmed upload', async () => {
  const oldList = deferred();
  let loads = 0;
  const render = provider({ getDocuments: () => ++loads === 1 ? oldList.promise : [document('saved')] });
  await render().startSession('owner', beneficiary('owner'));
  const loading = render().refreshDocuments();
  assert.equal((await render().submitDocument({}, 'proof_of_residency')).id, 'saved');
  oldList.resolve([]);
  await loading;
  assert.equal(render().documents[0].id, 'saved');
  assert.equal(render().documentsLoading, false);
});

for (const outcome of ['logout', 'success', 'unauthorized']) {
  test(`pending document lists and uploads are isolated after ${outcome}`, async () => {
    const oldList = deferred(), oldUpload = deferred();
    let loads = 0, writes = 0;
    const render = provider({
      getDocuments: (token) => { if (token !== 'old') return [document(token)]; loads++; return oldList.promise; },
      uploadDocument: () => { writes++; return oldUpload.promise; },
    });
    await render().startSession('old', beneficiary('old'));
    const staleRefresh = render().refreshDocuments, staleUpload = render().submitDocument;
    const loading = staleRefresh(), uploading = staleUpload({}, 'other');
    if (outcome === 'logout') await render().reset();
    else { await render().startSession('new', beneficiary('new')); await render().refreshDocuments(); }
    await staleRefresh();
    assert.equal(await staleUpload({}, 'other'), null);
    assert.equal(loads, 1);
    assert.equal(writes, 1);
    if (outcome === 'unauthorized') {
      oldList.reject(new ApiRequestError(401)); oldUpload.reject(new ApiRequestError(401));
    } else { oldList.resolve([document('old')]); oldUpload.resolve(document('old')); }
    await Promise.all([loading, uploading]);
    assert.equal(render().accessToken, outcome === 'logout' ? '' : 'new');
    assert.equal(render().documents?.[0]?.id ?? null, outcome === 'logout' ? null : 'new');
    assert.equal(render().documentsError, false);
    assert.equal(render().documentsLoading, false);
  });
}

test('document load errors can be retried and expired uploads clear the session', async () => {
  let offline = true;
  const render = provider({
    getDocuments: async () => { if (offline) throw new Error('Offline'); return []; },
    uploadDocument: async () => { throw new ApiRequestError(401); },
  });
  await render().startSession('owner', beneficiary('owner'));
  await render().refreshDocuments();
  assert.equal(render().documents, null);
  assert.equal(render().documentsError, true);
  offline = false;
  await render().refreshDocuments();
  assert.equal(render().documents.length, 0);
  assert.equal(render().documentsError, false);
  assert.equal(await render().submitDocument({}, 'other'), null);
  assert.equal(render().accessToken, '');
  assert.equal(render().documents, null);
});

for (const platform of ['web', 'android']) {
  test(`${platform} uploads send file bytes with the correct headers and reject oversized/unreadable files`, async () => {
    const bytes = new TextEncoder().encode('%PDF-1.4\nTest\n%%EOF').buffer;
    let fileSize = bytes.byteLength, unreadable = false, requests = 0;
    const source = loadSource('api.ts', {
      'react-native': { Platform: { OS: platform } },
      'expo-file-system': { File: class {
        get size() { return fileSize; }
        async arrayBuffer() { if (unreadable) throw new Error('No access'); return bytes; }
      } },
    }, {
      process: { env: {} }, AbortController, setTimeout, clearTimeout,
      fetch: async (_url, init) => {
        requests++;
        assert.equal(init.method, 'POST');
        assert.equal(init.headers['Content-Type'], 'application/pdf');
        assert.equal(init.headers['X-File-Name'], encodeURIComponent('Test ñ.pdf'));
        assert.equal(init.headers['X-Document-Type'], 'proof_of_residency');
        assert.equal(init.body.byteLength, bytes.byteLength);
        return { status: 201, ok: true, json: async () => ({ data: document('saved') }) };
      },
    });
    const file = { get size() { return fileSize; }, arrayBuffer: async () => { if (unreadable) throw new Error('No access'); return bytes; } };
    const asset = { name: 'Test ñ.pdf', uri: 'file:///selected.pdf', ...(platform === 'web' ? { file } : {}) };
    assert.equal((await source.uploadDocument('owner', asset, 'proof_of_residency')).id, 'saved');
    fileSize = 5 * 1024 * 1024 + 1;
    await assert.rejects(source.uploadDocument('owner', asset, 'proof_of_residency'), (error) => error.code === 'DOCUMENT_TOO_LARGE');
    fileSize = 0;
    await assert.rejects(source.uploadDocument('owner', asset, 'proof_of_residency'), (error) => error.code === 'EMPTY_DOCUMENT');
    fileSize = bytes.byteLength;
    unreadable = true;
    await assert.rejects(source.uploadDocument('owner', asset, 'proof_of_residency'), (error) => error.code === 'FILE_UNREADABLE');
    await assert.rejects(source.uploadDocument('owner', { name: 'test.exe' }, 'other'), (error) => error.code === 'UNSUPPORTED_FILE_TYPE');
    assert.equal(requests, 1);
  });
}

for (const newerToken of [null, 'new']) {
  test(`native storage keeps logout/login order with final token ${newerToken}`, async () => {
    const waitingWrite = deferred(), started = deferred();
    let saved = null;
    const source = loadSource('session-storage.ts', {
      'react-native': { Platform: { OS: 'android' } },
      'expo-secure-store': {
        getItemAsync: async () => saved,
        setItemAsync: async (_key, token) => {
          started.resolve();
          await waitingWrite.promise;
          saved = token;
        },
        deleteItemAsync: async () => { saved = null; },
      },
    });
    const firstWrite = source.storeToken('old');
    await started.promise;
    const logout = source.clearStoredToken();
    const login = newerToken ? source.storeToken(newerToken) : Promise.resolve();
    waitingWrite.resolve();
    await Promise.all([firstWrite, logout, login]);
    assert.equal(await source.getStoredToken(), newerToken);
  });
}

test('a rejected storage write does not prevent a later logout', async () => {
  let deleted = false;
  const source = loadSource('session-storage.ts', {
    'react-native': { Platform: { OS: 'android' } },
    'expo-secure-store': {
      setItemAsync: async () => { throw new Error('Storage unavailable'); },
      deleteItemAsync: async () => { deleted = true; },
    },
  });
  await assert.rejects(source.storeToken('old'));
  await source.clearStoredToken();
  assert.equal(deleted, true);
});

test('browser storage reads wait for pending login and logout writes', async () => {
  const saved = new Map();
  const source = loadSource('session-storage.ts', {
    'react-native': { Platform: { OS: 'web' } },
    'expo-secure-store': {},
  }, {
    localStorage: {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
      removeItem: (key) => saved.delete(key),
    },
  });
  const login = source.storeToken('web-token');
  assert.equal(await source.getStoredToken(), 'web-token');
  await login;
  const logout = source.clearStoredToken();
  assert.equal(await source.getStoredToken(), null);
  await logout;
});

test('wallet empty history appears only after a successful load', () => {
  const state = { wallet: null, walletLoading: false, walletError: false, t: (en) => en };
  const components = new Proxy({}, { get: (_, key) => String(key) });
  const source = loadSource('screens/main.tsx', {
    react: {
      createElement: (type, props, ...children) => ({ type, props, children }),
      useState: (initial) => [initial, () => {}],
    },
    'react-native': { StyleSheet: { create: (styles) => styles } },
    'expo-router': {},
    'lucide-react-native': components,
    '../components': components,
    '../state': { useDemo: () => state, peso: String },
    '../api': {},
    '../format': {},
    '../theme': { colors: {}, fonts: {} },
  });
  const content = () => JSON.stringify(source.WalletScreen());
  state.walletLoading = true;
  assert.ok(content().includes('Loading wallet records'));
  assert.ok(!content().includes('No wallet history yet'));
  state.walletLoading = false;
  state.walletError = true;
  assert.ok(content().includes('Your claim and wallet records could not be loaded.'));
  assert.ok(!content().includes('No wallet history yet'));
  state.walletError = false;
  state.wallet = wallet('empty');
  assert.ok(content().includes('No wallet history yet'));
});

test('notification screens render saved records, translations, and honest loading/error/empty states', () => {
  const state = {
    accessToken: 'owner', notifications: [], notificationsLoading: false, notificationsError: false,
    refreshNotifications: async () => {}, markRead: async () => true, t: (en) => en,
  };
  let params = { page: 'notifications' };
  const components = new Proxy({}, { get: (_, key) => String(key) });
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (initial) => [initial, () => {}], useRef: () => ({ current: false }), useEffect: () => {},
  };
  const mocks = {
    react, 'react-native': { StyleSheet: { create: (styles) => styles } },
    'expo-router': { useLocalSearchParams: () => params },
    'lucide-react-native': components, '../components': components,
    '../state': { useDemo: () => state, peso: String }, '../api': {},
    '../format': { formatDateTime: (value) => value }, '../theme': { colors: {}, fonts: {} },
  };
  const source = loadSource('screens/details.tsx', {
    ...mocks, 'expo-document-picker': {}, 'react-native-qrcode-svg': 'QRCode', './main': { s: {} },
  });
  const content = () => JSON.stringify(source.DetailScreen().children[0].children[0].type());
  state.notificationsLoading = true;
  assert.ok(content().includes('Loading notifications'));
  assert.ok(!content().includes('No notifications yet'));
  state.notificationsLoading = false;
  state.notificationsError = true;
  assert.ok(content().includes('Your notifications could not be loaded'));
  assert.ok(!content().includes('No notifications yet'));
  state.notificationsError = false;
  assert.ok(content().includes('No notifications yet'));
  state.notifications = [{
    id: 'saved', title: 'Saved title', titleBs: 'Natipig nga titulo', message: 'Saved message',
    messageBs: null, notificationType: 'other', sentAt: '2026-10-20T01:00:00Z', readAt: null,
  }];
  assert.ok(content().includes('Saved title. Unread'));
  state.t = (_en, bs) => bs;
  assert.ok(content().includes('Natipig nga titulo'));
  assert.ok(content().includes('Saved message')); // Missing translation falls back to stored English.
  params = { page: 'notification-details', id: 'saved' };
  assert.ok(content().includes('Saved message'));
  state.notifications = [];
  assert.ok(content().includes('Dili magamit nga pahibalo.'));

  const main = loadSource('screens/main.tsx', mocks);
  state.t = (en) => en;
  state.notifications = [{ id: 'saved', readAt: null }];
  assert.ok(JSON.stringify(main.HomeScreen()).includes('Open notifications, unread messages'));
  state.notifications[0].readAt = 'saved';
  assert.ok(!JSON.stringify(main.HomeScreen()).includes('Open notifications, unread messages'));
});

test('the profile form retains failed edits, prevents double saves, and sends only editable fields', async () => {
  let response = deferred(), writes = 0, sent, cursor = 0, loadAreas;
  const slots = [];
  const state = {
    beneficiary: { ...beneficiary('owner'), middleName: 'Test', birthDate: '1990-01-01', sex: 'female',
      address: '12 Old Street', barangayId: 'old', isVerified: true, status: 'active' },
    t: (en) => en,
    saveProfile: async (input) => {
      writes++;
      sent = input;
      const updated = await response.promise;
      state.beneficiary = updated;
      return updated;
    },
  };
  const components = new Proxy({}, { get: (_, key) => String(key) });
  const useState = (initial) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = initial;
    return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
  };
  const source = loadSource('screens/details.tsx', {
    react: {
      createElement: (type, props, ...children) => ({ type, props, children }), useState,
      useRef: (initial) => useState({ current: initial })[0], useEffect: (effect) => { loadAreas = effect; },
    },
    'react-native': {}, 'expo-router': { useLocalSearchParams: () => ({ page: 'edit-profile' }) },
    'expo-document-picker': {}, 'react-native-qrcode-svg': 'QRCode', 'lucide-react-native': components,
    '../components': components, '../state': { useDemo: () => state },
    '../theme': { colors: {}, fonts: {} }, '../format': {}, './main': { s: {} },
    '../api': { ApiRequestError, getBarangays: async () => [
      { id: 'old', barangayName: 'Old Area', city: 'Cebu', province: 'Cebu' },
      { id: 'new', barangayName: 'New Area', city: 'Cebu', province: 'Cebu' },
    ] },
  });
  const form = source.DetailScreen().children[0].children[0].type();
  const render = () => { cursor = 0; return form.type({ beneficiary: state.beneficiary }); };
  const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes)
    : node && typeof node === 'object' ? [node, ...nodes(node.children ?? [])] : [];
  const field = (tree, label) => nodes(tree).find((node) => node.type === 'Field' && node.props.label === label);
  const saveButton = (tree) => nodes(tree).find((node) => node.type === 'Button' && node.children[0] === 'Save changes');
  render();
  const cleanup = loadAreas();
  await new Promise(setImmediate);
  assert.equal(saveButton(render()).props.disabled, true);
  field(render(), 'First name').props.onChangeText('123');
  const button = saveButton(render());
  button.props.onPress();
  button.props.onPress();
  assert.equal(writes, 1);
  assert.equal(field(render(), 'First name').props.editable, false);
  response.reject(new ApiRequestError(422, { firstName: 'Use letters' }));
  await new Promise(setImmediate);
  assert.equal(field(render(), 'First name').props.value, '123');
  assert.ok(field(render(), 'First name').props.error);
  assert.ok(!JSON.stringify(render()).includes('Your profile was saved.'));
  field(render(), 'First name').props.onChangeText('  María  ');
  nodes(render()).find((node) => node.props?.accessibilityRole === 'radio' && node.props.key === 'new').props.onPress();
  response = deferred();
  saveButton(render()).props.onPress();
  assert.equal(writes, 2);
  assert.equal(sent.barangayId, 'new');
  assert.deepEqual(Object.keys(sent).sort(), ['address', 'barangayId', 'firstName', 'lastName', 'middleName']);
  response.resolve({ ...state.beneficiary, ...sent, firstName: 'María' });
  await new Promise(setImmediate);
  assert.equal(field(render(), 'First name').props.value, 'María');
  assert.equal(saveButton(render()).props.disabled, true);
  assert.ok(JSON.stringify(render()).includes('Your profile was saved.'));
  assert.equal(field(render(), 'Mobile number'), undefined);
  cleanup();
});

test('document selection, uploading, failure retry, and received status follow server confirmation', async () => {
  let cursor = 0, effect, writes = 0, response = deferred(), sent, options;
  let selection = { canceled: true };
  const slots = [];
  const state = {
    beneficiary: beneficiary('owner'), documents: null, documentsLoading: true, documentsError: false,
    t: (en) => en, refreshDocuments: async () => {},
    submitDocument: async (file, docType) => {
      writes++; sent = { file, docType };
      const saved = await response.promise;
      state.documents = [saved];
      return saved;
    },
  };
  const components = new Proxy({}, { get: (_, key) => String(key) });
  const useState = (initial) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = initial;
    return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
  };
  const source = loadSource('screens/details.tsx', {
    react: { createElement: (type, props, ...children) => ({ type, props, children }), useState,
      useRef: (initial) => useState({ current: initial })[0], useEffect: (fn) => { effect = fn; } },
    'react-native': {}, 'expo-router': { useLocalSearchParams: () => ({ page: 'enrollment-documents' }) },
    'expo-document-picker': { getDocumentAsync: async (input) => { options = input; return selection; } },
    'react-native-qrcode-svg': 'QRCode', 'lucide-react-native': components, '../components': components,
    '../state': { useDemo: () => state }, '../theme': { colors: {}, fonts: {} },
    '../api': { ApiRequestError, MAX_DOCUMENT_BYTES: 5 * 1024 * 1024 },
    '../format': { formatDateTime: (value) => value, formatStatus: (value) => value }, './main': { s: {} },
  });
  const form = source.DetailScreen().children[0].children[0].type();
  const render = () => { cursor = 0; return form.type(); };
  const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes)
    : node && typeof node === 'object' ? [node, ...nodes(node.children ?? [])] : [];
  const button = (label) => nodes(render()).find((node) => node.type === 'Button' && node.children[0] === label);
  const content = () => JSON.stringify(render());
  render();
  const cleanup = effect();
  assert.ok(content().includes('Loading your documents'));
  assert.ok(!content().includes('No documents uploaded yet.'));
  state.documentsLoading = false; state.documentsError = true;
  assert.ok(content().includes('Your document list could not be loaded.'));
  assert.ok(!content().includes('No documents uploaded yet.'));
  state.documentsError = false; state.documents = [];
  assert.ok(content().includes('No documents uploaded yet.'));
  button('Choose document').props.onPress();
  await new Promise(setImmediate);
  assert.equal(button('Upload document').props.disabled, true);
  const selected = { name: 'Selected.pdf', uri: 'file:///selected.pdf', size: 30 };
  selection = { canceled: false, assets: [selected] };
  button('Choose document').props.onPress();
  await new Promise(setImmediate);
  assert.equal(options.copyToCacheDirectory, true);
  assert.equal(options.base64, false);
  const upload = button('Upload document');
  upload.props.onPress(); upload.props.onPress();
  assert.equal(writes, 1);
  assert.ok(button('Uploading document…').props.loading);
  assert.ok(!content().includes('Received: '));
  response.reject(new ApiRequestError(500, undefined, 'NETWORK_ERROR'));
  await new Promise(setImmediate);
  assert.ok(content().includes('The upload could not be confirmed.'));
  assert.ok(content().includes('Selected.pdf'));
  selection = { canceled: false, assets: [{ ...selected, size: 5 * 1024 * 1024 + 1 }] };
  button('Choose another file').props.onPress();
  await new Promise(setImmediate);
  assert.ok(content().includes('Choose a file up to 5 MB.'));
  assert.equal(button('Upload document').props.disabled, true);
  selection = { canceled: false, assets: [selected] };
  button('Choose document').props.onPress();
  await new Promise(setImmediate);
  response = deferred();
  button('Upload document').props.onPress();
  assert.equal(sent.file.name, selected.name);
  assert.equal(sent.docType, 'proof_of_residency');
  response.resolve(document('confirmed'));
  await new Promise(setImmediate);
  assert.ok(content().includes('confirmed.pdf'));
  assert.ok(content().includes('Received · awaiting staff review'));
  assert.equal(button('Upload document').props.disabled, true);
  cleanup();
});
