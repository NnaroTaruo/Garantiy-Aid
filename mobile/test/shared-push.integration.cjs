const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { randomUUID, randomInt } = require('node:crypto');
const { once } = require('node:events');
const { pathToFileURL } = require('node:url');

// Real mobile API module + real staff routes on the isolated test database. A fake Expo sender stands
// in for the provider: this proves registration, post-commit queueing and logout, not phone delivery.
test('a real staff enrollment approval alerts the opted-in phone once after commit, and logout stops alerts', async () => {
  const shared = path.resolve(__dirname, '../../shared-backend');
  assert.ok(fs.existsSync(path.join(shared, '.env')), 'Prepare the shared-backend checkout and migrated test database using docs/shared-backend-integration.md.');
  require(path.join(shared, 'node_modules/dotenv')).config({ path: path.join(shared, '.env'), quiet: true });
  process.env.AUTH_RATE_LIMIT_PER_15_MINUTES = '100';
  const load = (file) => import(pathToFileURL(path.join(shared, file)).href);
  const [{ default: app }, { default: prisma }, { signAccessToken }, { env }, { dispatchMobilePushes }] = await Promise.all([
    load('src/app.js'), load('src/lib/prisma.js'), load('src/modules/auth/auth.service.js'), load('src/config/env.js'),
    load('src/modules/mobile/mobilePush.dispatcher.js'),
  ]);
  const savedMode = env.mobilePushMode;
  env.mobilePushMode = 'EXPO';
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const api = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/api.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports: api, require: () => ({ Platform: { OS: 'android' } }), process: { env: { EXPO_PUBLIC_API_URL: `${base}/mobile` } },
    fetch, AbortController, setTimeout, clearTimeout, FormData, Blob,
  });
  const barangayId = randomUUID(), adminId = randomUUID(), adminSession = randomUUID(), reviewerId = randomUUID(), reviewerSession = randomUUID(), programId = randomUUID();
  const ids = [];
  const deviceToken = 'ExponentPushToken[shared-suite-phone]';
  try {
    await prisma.barangay.create({ data: { barangayId, barangayCode: barangayId.slice(0, 20), barangayName: 'Push API test', city: 'Test', province: 'Test' } });
    await prisma.user.create({ data: { userId: adminId, employeeId: adminId.slice(0, 20), username: `test_${adminId.replaceAll('-', '').slice(0, 16)}`, fullName: 'Synthetic push admin', email: `${adminId}@example.invalid`, passwordHash: 'not-a-login-password', role: 'SYSTEM_ADMIN' } });
    await prisma.staffSession.create({ data: { sessionId: adminSession, userId: adminId, expiresAt: new Date(Date.now() + 300_000) } });
    await prisma.user.create({ data: { userId: reviewerId, employeeId: reviewerId.slice(0, 20), fullName: 'Synthetic push reviewer', email: `${reviewerId}@example.invalid`, passwordHash: 'not-a-login-password', role: 'DSWD_STAFF' } });
    await prisma.staffSession.create({ data: { sessionId: reviewerSession, userId: reviewerId, expiresAt: new Date(Date.now() + 300_000) } });
    const staffToken = signAccessToken({ userId: adminId, role: 'SYSTEM_ADMIN' }, { jwtId: adminSession });
    const reviewerToken = signAccessToken({ userId: reviewerId, role: 'DSWD_STAFF' }, { jwtId: reviewerSession });
    const staff = async (url, token, body = {}) => {
      const response = await fetch(base + url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.ok(response.ok, `${url} ${response.status}`);
      return (await response.json()).data;
    };
    const contactNumber = `+639${randomInt(100_000_000, 1_000_000_000)}`;
    const registered = await api.registerBeneficiary({ firstName: 'Push', middleName: '', lastName: 'Client', birthDate: '1990-01-01', sex: 'female', address: '12 Synthetic Street', barangayId, contactNumber });
    ids.push(registered.beneficiary.id);
    const login = await api.verifyOtp(contactNumber, 'register', registered.developmentOtp);

    assert.deepEqual({ ...await api.getPushDevice(login.accessToken) }, { configured: true, status: 'off', enabled: false, language: null, updatedAt: null });
    await assert.rejects(api.registerPushDevice(login.accessToken, { token: 'nope', platform: 'android', language: 'en' }), (error) => error.status === 400);
    await assert.rejects(api.registerPushDevice(staffToken, { token: deviceToken, platform: 'android', language: 'en' }), (error) => error.status === 401);
    const on = await api.registerPushDevice(login.accessToken, { token: deviceToken, platform: 'android', language: 'en' });
    assert.equal(on.status, 'on');
    assert.ok(!JSON.stringify(on).includes('PushToken'));

    await prisma.program.create({ data: { programId, programCode: programId.slice(0, 25), programName: 'Synthetic push program', programType: 'RELIEF', status: 'ACTIVE', grantAmount: null, createdById: adminId,
      criteria: { create: { criterionName: 'Adult beneficiary', fieldName: 'AGE', operator: 'GREATER_THAN_OR_EQUAL', expectedValue: 18, isRequired: true } } } });
    const enrollmentId = (await staff(`/programs/${programId}/enrollments`, staffToken, { beneficiaryId: ids[0] })).enrollment.enrollmentId;
    await staff(`/enrollments/${enrollmentId}/start-review`, reviewerToken);
    await staff(`/enrollments/${enrollmentId}/approve`, reviewerToken, { remarks: 'Approved in the synthetic push test.' });
    const notices = await api.getNotifications(login.accessToken);
    const approval = notices.find((item) => item.title === 'Enrollment approved');
    assert.ok(approval, 'The real staff transaction saved the in-app notice');
    const queued = await prisma.beneficiaryMobilePushDelivery.findMany({ where: { notification: { beneficiaryId: ids[0] } }, include: { notification: true } });
    assert.equal(queued.filter((row) => row.notification.notificationType === 'ENROLLMENT_APPROVED').length, 1);
    assert.equal(queued.length, notices.length, 'One alert per committed in-app notice');

    const sent = [];
    const outcome = await dispatchMobilePushes({ sender: async (messages) => { sent.push(...messages); return messages.map((_m, i) => ({ ok: true, ticketId: `shared-${i}` })); } });
    assert.equal(outcome.sent, notices.filter((item) => !item.readAt).length);
    const approvalAlert = sent.find((message) => message.data.notificationId === approval.id);
    assert.ok(approvalAlert);
    assert.equal(approvalAlert.to, deviceToken);
    assert.equal(approvalAlert.body, 'You have a new account update. Open the app to view it.');
    assert.ok(!JSON.stringify(sent).match(/Client|Synthetic push program|approved/i));
    assert.equal((await dispatchMobilePushes({ sender: async () => assert.fail('No duplicate send') })).claimed, 0);

    await api.logout(login.accessToken);
    assert.equal(await prisma.beneficiaryMobilePushDevice.count({ where: { account: { beneficiaryId: ids[0] } } }), 0, 'Logout removes the phone registration');
    await assert.rejects(api.getPushDevice(login.accessToken), (error) => error.status === 401);
  } finally {
    env.mobilePushMode = savedMode;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await prisma.notification.deleteMany({ where: { beneficiaryId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: [adminId, reviewerId] } }, { recordId: { in: ids } }] } });
    await prisma.idempotencyRecord.deleteMany({ where: { userId: { in: [adminId, reviewerId] } } });
    await prisma.enrollment.deleteMany({ where: { beneficiaryId: { in: ids } } });
    await prisma.programCriterion.deleteMany({ where: { programId } });
    await prisma.program.deleteMany({ where: { programId } });
    await prisma.beneficiary.deleteMany({ where: { beneficiaryId: { in: ids } } });
    await prisma.user.deleteMany({ where: { userId: { in: [adminId, reviewerId] } } });
    await prisma.barangay.deleteMany({ where: { barangayId } });
    await prisma.$disconnect();
  }
});
