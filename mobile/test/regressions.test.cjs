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
  constructor(status) { super('Request failed'); this.status = status; }
}
const beneficiary = (id) => ({ id, firstName: id, middleName: null, lastName: 'Test', contactNumber: '+639000000000' });
const overview = (id) => ({ enrollments: [{ id }], nextSchedule: null });
const wallet = (id) => ({ wallet: { id, balance: 1500 }, currentClaim: null, claims: [], transactions: [] });

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
