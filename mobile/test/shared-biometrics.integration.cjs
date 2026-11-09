const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { randomUUID, randomInt, createHash } = require('node:crypto');
const { once } = require('node:events');
const { pathToFileURL } = require('node:url');

test('mobile consent is owned, persistent, revocable, and used by facilitator enrollment without exposing templates', async () => {
  const shared = path.resolve(__dirname, '../../shared-backend');
  require(path.join(shared, 'node_modules/dotenv')).config({ path: path.join(shared, '.env'), quiet: true });
  assert.equal(new URL(process.env.DATABASE_URL).port, '51244', 'Use the isolated migrated test database on port 51244.');
  process.env.BIOMETRIC_PROCESSOR_MODE = 'SIMULATED';
  process.env.BIOMETRIC_RATE_LIMIT_PER_15_MINUTES = '200';
  process.env.AUTH_RATE_LIMIT_PER_15_MINUTES = '100';
  const load = file => import(pathToFileURL(path.join(shared, file)).href);
  const [{ default: app }, { default: prisma }, { signAccessToken }] = await Promise.all([
    load('src/app.js'), load('src/lib/prisma.js'), load('src/modules/auth/auth.service.js'),
  ]);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/v1`, api = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/api.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports: api, require: () => ({ Platform: { OS: 'web' } }),
    process: { env: { EXPO_PUBLIC_API_URL: base + '/mobile' } }, fetch, AbortController, setTimeout, clearTimeout });
  const barangayId = randomUUID(), facilitatorId = randomUUID(), staffSessionId = randomUUID(), owners = [];
  const request = (url, token, body, method = 'POST') => fetch(base + url, { method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    await prisma.barangay.create({ data: { barangayId, barangayCode: barangayId.slice(0, 20), barangayName: 'Synthetic biometric test', city: 'Test', province: 'Test' } });
    await prisma.user.create({ data: { userId: facilitatorId, employeeId: facilitatorId.slice(0, 20), username: `test_${facilitatorId.replaceAll('-', '').slice(0, 16)}`, fullName: 'Synthetic facilitator',
      email: `${facilitatorId}@example.invalid`, passwordHash: 'not-a-login-password', role: 'BARANGAY_FACILITATOR', barangayId } });
    await prisma.staffSession.create({ data: { sessionId: staffSessionId, userId: facilitatorId, expiresAt: new Date(Date.now() + 300_000) } });
    const staffToken = signAccessToken({ userId: facilitatorId, role: 'BARANGAY_FACILITATOR' }, { jwtId: staffSessionId });
    for (const name of ['First', 'Other']) {
      const phone = `+639${randomInt(100_000_000, 1_000_000_000)}`;
      const registered = await api.registerBeneficiary({ firstName: name, middleName: '', lastName: 'Synthetic', birthDate: '1990-01-01', sex: 'female', address: 'Synthetic address', barangayId, contactNumber: phone });
      owners.push({ id: registered.beneficiary.id });
      owners.at(-1).token = (await api.verifyOtp(phone, 'register', registered.developmentOtp)).accessToken;
    }
    const [owner, other] = owners;
    const get = () => api.getBiometrics(owner.token);
    const empty = await get();
    assert.equal(empty.consent, null); assert.equal(empty.profile, null);
    assert.equal(empty.enrollmentMethod, 'staff_assisted'); assert.equal(empty.processorMode, 'simulated');
    assert.ok(new Date(empty.policy.retentionUntil) > new Date());
    for (const token of ['', staffToken]) assert.equal((await request('/mobile/beneficiaries/me/biometrics', token, null, 'GET')).status, 401);
    const input = { consentVersion: empty.policy.version, retentionUntil: empty.policy.retentionUntil, expectedConsentId: null };
    assert.equal((await request('/mobile/beneficiaries/me/biometric-consents', owner.token, { ...input, beneficiaryId: other.id })).status, 400);
    await assert.rejects(api.giveBiometricConsent(owner.token, { ...input, consentVersion: 'obsolete' }), error => error.status === 409);
    await assert.rejects(api.giveBiometricConsent(owner.token, { ...input, retentionUntil: '2099-01-01T00:00:00Z' }), error => error.status === 409);
    let saved = await api.giveBiometricConsent(owner.token, input);
    assert.equal(saved.consent.status, 'active'); assert.equal(saved.profile, null);
    const firstConsentId = saved.consent.id;
    const stored = await prisma.biometricConsent.findUnique({ where: { consentId: firstConsentId } });
    assert.equal(stored.recordedById, null); assert.equal(stored.recordedByBeneficiaryId, owner.id);
    assert.equal(await prisma.biometricData.count({ where: { beneficiaryId: owner.id } }), 0, 'Consent alone never creates a face profile');
    const staffConsents = await request(`/beneficiaries/${owner.id}/biometric-consents`, staffToken, null, 'GET');
    assert.equal(staffConsents.status, 200);
    const staffConsent = (await staffConsents.json()).data.consents[0];
    assert.equal(staffConsent.consentId, firstConsentId); assert.equal(staffConsent.recordedByBeneficiaryId, owner.id);
    await assert.rejects(api.revokeBiometricConsent(other.token, firstConsentId), error => error.status === 404);
    await assert.rejects(prisma.biometricConsent.create({ data: { beneficiaryId: owner.id, consentVersion: 'v1.0', consentGiven: true, consentedAt: new Date(), retentionUntil: new Date(input.retentionUntil), recordedByBeneficiaryId: other.id } }));
    const capture = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      ...Array.from({ length: 40 }, (_, i) => createHash('sha512').update(`synthetic:${barangayId}:${i}`).digest())]);
    const enroll = async (person, consentId, token = staffToken, reenroll = false) => {
      const body = new FormData(); body.append('consentId', consentId);
      body.append('faceCapture', new Blob([capture], { type: 'image/png' }), 'synthetic.png');
      return fetch(`${base}/beneficiaries/${person.id}/biometrics/${reenroll ? 're-enroll' : 'enroll'}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
    };
    assert.equal((await enroll(owner, firstConsentId, owner.token)).status, 401, 'Mobile sessions cannot enroll faces');
    const enrollment = await enroll(owner, firstConsentId);
    assert.equal(enrollment.status, 201, JSON.stringify((await enrollment.json()).error ?? {}));
    saved = await get();
    assert.equal(saved.profile.status, 'enrolled'); assert.equal(saved.profile.simulated, true); assert.equal(saved.profile.processorCompatible, true);
    assert.deepEqual(Object.keys(saved.profile).sort(), ['consentId', 'enrolledAt', 'id', 'lastVerifiedAt', 'processorCompatible', 'simulated', 'status']);
    assert.ok(!JSON.stringify(saved).match(/embedding|livenessScore|password|enrolledBy|matchScore|apiKey/i));
    const encrypted = await prisma.biometricData.findUnique({ where: { beneficiaryId: owner.id } });
    assert.ok(encrypted.faceEmbedding.length > 32); assert.equal(encrypted.enrolledById, facilitatorId);
    assert.equal((await api.giveBiometricConsent(owner.token, input)).consent.id, firstConsentId, 'Exact retry is idempotent after capture');
    assert.equal((await get()).profile.status, 'enrolled');
    const otherEmpty = await api.getBiometrics(other.token);
    const otherSaved = await api.giveBiometricConsent(other.token, { consentVersion: otherEmpty.policy.version, retentionUntil: otherEmpty.policy.retentionUntil, expectedConsentId: null });
    assert.equal((await enroll(other, otherSaved.consent.id)).status, 201);
    assert.equal((await api.getBiometrics(other.token)).profile.status, 'pending_duplicate_review');
    await api.revokeBiometricConsent(other.token, otherSaved.consent.id);
    assert.equal((await api.getBiometrics(other.token)).profile.status, 'revoked');
    const revoked = await api.revokeBiometricConsent(owner.token, firstConsentId);
    assert.equal(revoked.consent.status, 'revoked'); assert.equal(revoked.profile.status, 'revoked');
    assert.ok(revoked.consent.revokedAt);
    assert.equal((await api.revokeBiometricConsent(owner.token, firstConsentId)).consent.revokedAt, revoked.consent.revokedAt);
    assert.equal((await enroll(owner, firstConsentId, staffToken, true)).status, 409);
    await assert.rejects(api.giveBiometricConsent(owner.token, input), error => error.code === 'BIOMETRIC_CONSENT_CHANGED');
    const renewedInput = { consentVersion: revoked.policy.version, retentionUntil: revoked.policy.retentionUntil, expectedConsentId: firstConsentId };
    const renewed = await api.giveBiometricConsent(owner.token, renewedInput);
    assert.notEqual(renewed.consent.id, firstConsentId); assert.equal(renewed.profile.status, 'revoked', 'Renewal does not restore a revoked template');
    await api.revokeBiometricConsent(owner.token, firstConsentId);
    assert.equal((await get()).consent.status, 'active', 'A stale withdrawal cannot revoke a newer consent');
    assert.equal((await enroll(owner, renewed.consent.id, staffToken, true)).status, 200);
    await prisma.biometricConsent.update({ where: { consentId: renewed.consent.id }, data: { retentionUntil: new Date(Date.now() - 1000) } });
    const expired = await get(); assert.equal(expired.consent.status, 'expired'); assert.equal(expired.profile.status, 'expired');
    await prisma.biometricData.update({ where: { beneficiaryId: owner.id }, data: { insightfaceModel: 'ArcFace' } });
    assert.equal((await get()).profile.processorCompatible, false);
    assert.equal((await request('/mobile/beneficiaries/me/biometrics', owner.token, null, 'GET')).headers.get('cache-control'), 'private, no-store');
    await api.logout(owner.token);
    await assert.rejects(get(), error => error.status === 401);
    await assert.rejects(api.revokeBiometricConsent(owner.token, renewed.consent.id), error => error.status === 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
    const ids = owners.map(owner => owner.id);
    const consents = await prisma.biometricConsent.findMany({ where: { beneficiaryId: { in: ids } }, select: { consentId: true } });
    await prisma.biometricDuplicateCase.deleteMany({ where: { OR: [{ candidateBeneficiaryId: { in: ids } }, { matchedBeneficiaryId: { in: ids } }] } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: facilitatorId }, { recordId: { in: [...ids, ...consents.map(c => c.consentId)] } }, { details: { path: ['beneficiaryId'], string_contains: ids[0] ?? 'no-owner' } }] } });
    await prisma.biometricData.deleteMany({ where: { beneficiaryId: { in: ids } } });
    await prisma.biometricConsent.deleteMany({ where: { beneficiaryId: { in: ids } } });
    await prisma.beneficiary.deleteMany({ where: { beneficiaryId: { in: ids } } });
    await prisma.user.deleteMany({ where: { userId: facilitatorId } });
    await prisma.barangay.deleteMany({ where: { barangayId } });
    await prisma.$disconnect();
  }
});
