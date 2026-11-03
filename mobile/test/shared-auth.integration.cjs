const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { randomUUID, randomInt } = require('node:crypto');
const { once } = require('node:events');
const { pathToFileURL } = require('node:url');

test('the real mobile API registers a shared beneficiary, edits its profile, and revokes its session', async () => {
  const shared = path.resolve(__dirname, '../../shared-backend');
  assert.ok(fs.existsSync(path.join(shared, '.env')), 'Prepare the shared-backend checkout, private .env, and migrated test database using docs/shared-backend-integration.md.');
  require(path.join(shared, 'node_modules/dotenv')).config({ path: path.join(shared, '.env'), quiet: true });
  process.env.AUTH_RATE_LIMIT_PER_15_MINUTES = '100';
  const load = (file) => import(pathToFileURL(path.join(shared, file)).href);
  const [{ default: app }, { default: prisma }, { signAccessToken }] = await Promise.all([
    load('src/app.js'), load('src/lib/prisma.js'), load('src/modules/auth/auth.service.js'),
  ]);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/api.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const api = {};
  vm.runInNewContext(output, {
    exports: api,
    require: (name) => { assert.equal(name, 'react-native'); return { Platform: { OS: 'web' } }; },
    process: { env: { EXPO_PUBLIC_API_URL: `${base}/mobile` } },
    fetch, AbortController, setTimeout, clearTimeout,
  });
  const barangayId = randomUUID();
  const userId = randomUUID();
  const staffSessionId = randomUUID();
  let beneficiaryId;
  try {
    await prisma.barangay.create({ data: { barangayId, barangayCode: barangayId.slice(0, 20), barangayName: 'Mobile API test', city: 'Test', province: 'Test' } });
    await prisma.user.create({ data: { userId, employeeId: userId.slice(0, 20), username: `test_${userId.replaceAll('-', '').slice(0, 16)}`, fullName: 'Synthetic API tester', email: `${userId}@example.invalid`, passwordHash: 'not-a-login-password', role: 'SYSTEM_ADMIN' } });
    await prisma.staffSession.create({ data: { sessionId: staffSessionId, userId, expiresAt: new Date(Date.now() + 300_000) } });
    assert.ok((await api.getBarangays()).some((area) => area.id === barangayId));
    const contactNumber = `+639${randomInt(100_000_000, 1_000_000_000)}`;
    const registered = await api.registerBeneficiary({ firstName: 'API', middleName: '', lastName: 'Test', birthDate: '1990-01-01', sex: 'female', address: '12 Synthetic Street', barangayId, contactNumber });
    beneficiaryId = registered.beneficiary.id;
    const login = await api.verifyOtp(contactNumber, 'register', registered.developmentOtp);
    assert.equal((await api.getCurrentBeneficiary(login.accessToken)).id, beneficiaryId);
    assert.equal(login.beneficiary.isVerified, false);
    await assert.rejects(api.updateProfile(login.accessToken, { firstName: '123' }), (error) => Boolean(error.fields.firstName));
    const updated = await api.updateProfile(login.accessToken, { firstName: 'Updated', middleName: null, lastName: 'Test', address: '24 Shared Street', barangayId });
    assert.equal(updated.firstName, 'Updated');
    assert.equal((await api.getCurrentBeneficiary(login.accessToken)).address, '24 Shared Street');
    const staffToken = signAccessToken({ userId, role: 'SYSTEM_ADMIN' }, { jwtId: staffSessionId });
    const staff = await fetch(`${base}/beneficiaries/${beneficiaryId}`, { headers: { Authorization: `Bearer ${staffToken}` } });
    assert.equal(staff.status, 200);
    assert.equal((await staff.json()).data.beneficiary.firstName, 'Updated');
    await api.logout(login.accessToken);
    await assert.rejects(api.getCurrentBeneficiary(login.accessToken), (error) => error.status === 401);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (beneficiaryId) {
      await prisma.auditLog.deleteMany({ where: { recordId: beneficiaryId, actorType: 'BENEFICIARY' } });
      await prisma.beneficiary.deleteMany({ where: { beneficiaryId } });
    }
    await prisma.user.deleteMany({ where: { userId } });
    await prisma.barangay.deleteMany({ where: { barangayId } });
    await prisma.$disconnect();
  }
});
