const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { randomUUID, randomInt } = require('node:crypto');
const { once } = require('node:events');
const { pathToFileURL } = require('node:url');
const { tmpdir } = require('node:os');

test('the real mobile API shares accounts, schedules, QR verification, releases, ledger history, documents, and logout with staff', async () => {
  const shared = path.resolve(__dirname, '../../shared-backend');
  assert.ok(fs.existsSync(path.join(shared, '.env')), 'Prepare the shared-backend checkout, private .env, and migrated test database using docs/shared-backend-integration.md.');
  require(path.join(shared, 'node_modules/dotenv')).config({ path: path.join(shared, '.env'), quiet: true });
  process.env.AUTH_RATE_LIMIT_PER_15_MINUTES = '100';
  const uploadDirectory = fs.mkdtempSync(path.join(tmpdir(), 'garantiyaid-mobile-documents-'));
  process.env.DOCUMENT_STORAGE_DIR = uploadDirectory;
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
    fetch, AbortController, setTimeout, clearTimeout, FormData, Blob,
  });
  const barangayId = randomUUID();
  const userId = randomUUID();
  const staffSessionId = randomUUID();
  const reviewerId = randomUUID(), reviewerSessionId = randomUUID();
  const facilitatorId = randomUUID(), facilitatorSessionId = randomUUID();
  const programIds = [], distributionIds = [], extraBeneficiaries = [];
  let beneficiaryId;
  try {
    await prisma.barangay.create({ data: { barangayId, barangayCode: barangayId.slice(0, 20), barangayName: 'Mobile API test', city: 'Test', province: 'Test' } });
    await prisma.user.create({ data: { userId, employeeId: userId.slice(0, 20), username: `test_${userId.replaceAll('-', '').slice(0, 16)}`, fullName: 'Synthetic API tester', email: `${userId}@example.invalid`, passwordHash: 'not-a-login-password', role: 'SYSTEM_ADMIN' } });
    await prisma.staffSession.create({ data: { sessionId: staffSessionId, userId, expiresAt: new Date(Date.now() + 300_000) } });
    await prisma.user.create({ data: { userId: reviewerId, employeeId: reviewerId.slice(0, 20), fullName: 'Synthetic enrollment reviewer', email: `${reviewerId}@example.invalid`, passwordHash: 'not-a-login-password', role: 'DSWD_STAFF' } });
    await prisma.staffSession.create({ data: { sessionId: reviewerSessionId, userId: reviewerId, expiresAt: new Date(Date.now() + 300_000) } });
    await prisma.user.create({ data: { userId: facilitatorId, employeeId: facilitatorId.slice(0, 20), username: `test_${facilitatorId.replaceAll('-', '').slice(0, 16)}`, fullName: 'Synthetic release facilitator', email: `${facilitatorId}@example.invalid`, passwordHash: 'not-a-login-password', role: 'BARANGAY_FACILITATOR', barangayId } });
    await prisma.staffSession.create({ data: { sessionId: facilitatorSessionId, userId: facilitatorId, expiresAt: new Date(Date.now() + 300_000) } });
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
    const reviewerToken = signAccessToken({ userId: reviewerId, role: 'DSWD_STAFF' }, { jwtId: reviewerSessionId });
    const facilitatorToken = signAccessToken({ userId: facilitatorId, role: 'BARANGAY_FACILITATOR' }, { jwtId: facilitatorSessionId });
    const staffRequest = async (url, token, body = {}, headers = {}) => {
      const response = await fetch(base + url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
      const payload = await response.json();
      assert.ok(response.ok, JSON.stringify({ status: response.status, error: payload.error }));
      return payload.data;
    };
    const overview = () => api.getBeneficiaryOverview(login.accessToken);
    const records = () => api.getWalletOverview(login.accessToken);
    for (const token of [null, staffToken]) {
      assert.equal((await fetch(`${base}/mobile/beneficiaries/me/wallet`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })).status, 401);
    }
    const emptyRecords = await records();
    assert.equal(emptyRecords.wallet, null);
    assert.equal(emptyRecords.currentClaim, null);
    assert.equal(emptyRecords.claims.length, 0);
    assert.equal(emptyRecords.transactions.length, 0);
    assert.equal(await prisma.walletAccount.count({ where: { beneficiaryId } }), 0, 'GET must not create a wallet');
    const unavailablePass = () => assert.rejects(api.issueClaimPass(login.accessToken), (error) => error.code === 'CLAIM_PASS_UNAVAILABLE');
    await unavailablePass();
    assert.equal((await fetch(`${base}/mobile/beneficiaries/me/claim-pass`, { method: 'POST' })).status, 401);
    assert.equal((await fetch(`${base}/mobile/beneficiaries/me/claim-pass`, { method: 'POST', headers: { Authorization: `Bearer ${staffToken}` } })).status, 401);
    assert.equal((await fetch(`${base}/mobile/beneficiaries/me/overview`)).status, 401);
    assert.equal((await fetch(`${base}/mobile/beneficiaries/me/overview`, { headers: { Authorization: `Bearer ${staffToken}` } })).status, 401);
    const empty = await overview();
    assert.equal(empty.enrollments.length, 0);
    assert.equal(empty.nextSchedule, null);
    const programId = randomUUID();
    programIds.push(programId);
    await prisma.program.create({ data: { programId, programCode: programId.slice(0, 25), programName: 'Synthetic in-kind program', programType: 'RELIEF', description: 'A saved staff program description.', status: 'ACTIVE', grantAmount: null, createdById: userId,
      criteria: { create: { criterionName: 'Adult beneficiary', fieldName: 'AGE', operator: 'GREATER_THAN_OR_EQUAL', expectedValue: 18, isRequired: true } } } });
    const enrolled = await staffRequest(`/programs/${programId}/enrollments`, staffToken, { beneficiaryId });
    const enrollmentId = enrolled.enrollment.enrollmentId;
    assert.equal((await overview()).enrollments[0].status, 'pending');
    await staffRequest(`/enrollments/${enrollmentId}/start-review`, reviewerToken);
    assert.equal((await overview()).enrollments[0].status, 'for_validation');
    await staffRequest(`/enrollments/${enrollmentId}/request-correction`, reviewerToken, { reason: 'Please correct the sample application details.' });
    const correction = (await overview()).enrollments[0];
    assert.equal(correction.status, 'needs_correction');
    assert.equal(correction.reviewNotes, 'Please correct the sample application details.');
    assert.ok(correction.reviewedAt);
    assert.equal(correction.program.grantAmount, null);
    assert.equal(correction.program.description, 'A saved staff program description.');
    assert.deepEqual(Object.keys(correction).sort(), ['enrollmentDate', 'id', 'program', 'reviewNotes', 'reviewedAt', 'status']);
    assert.deepEqual(Object.keys(correction.program).sort(), ['code', 'description', 'grantAmount', 'id', 'name', 'type']);
    const forbiddenApproval = await fetch(`${base}/enrollments/${enrollmentId}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${login.accessToken}`, 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(forbiddenApproval.status, 401);
    await staffRequest(`/enrollments/${enrollmentId}/resubmit`, staffToken);
    await staffRequest(`/enrollments/${enrollmentId}/start-review`, reviewerToken);
    await staffRequest(`/enrollments/${enrollmentId}/approve`, reviewerToken, { remarks: 'Approved for the synthetic schedule test.' });
    assert.equal((await overview()).enrollments[0].status, 'approved');
    const otherPhone = `+639${randomInt(100_000_000, 1_000_000_000)}`;
    const other = await api.registerBeneficiary({ firstName: 'Other', middleName: '', lastName: 'Synthetic', birthDate: '1990-01-01', sex: 'female', address: 'Other sample address', barangayId, contactNumber: otherPhone });
    extraBeneficiaries.push(other.beneficiary.id);
    const otherLogin = await api.verifyOtp(otherPhone, 'register', other.developmentOtp);
    assert.equal((await api.getBeneficiaryOverview(otherLogin.accessToken)).enrollments.length, 0);
    const distributionId = randomUUID();
    distributionIds.push(distributionId);
    const day = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const nextDay = new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10);
    await prisma.distribution.create({ data: { distributionId, programId, createdById: userId, title: 'Synthetic shared distribution', distributionDate: new Date(day), startTime: new Date('1970-01-01T00:00:00Z'), endTime: new Date('1970-01-01T12:00:00Z'), slotDurationMinutes: 30, location: 'Parent event venue', barangayId, deliveryMode: 'PHYSICAL_GOODS', packageName: 'Synthetic relief package', packageUnit: 'pack', packageQuantity: 1 } });
    const allocation = await prisma.distributionAllocation.create({ data: { distributionId, beneficiaryId, enrollmentId, amount: 1000, allocationStatus: 'ALLOCATED', allocatedById: userId, allocatedAt: new Date() } });
    const slots = [];
    for (const [date, location] of [[day, 'Original session venue'], [nextDay, 'Rescheduled session venue']]) {
      slots.push(await prisma.distributionSlot.create({ data: { distributionId, sessionId: randomUUID(), sessionLabel: 'Synthetic session', location, slotStart: new Date(`${date}T00:15:00+08:00`), slotEnd: new Date(`${date}T00:45:00+08:00`), capacity: 1 } }));
    }
    const assigned = await staffRequest(`/distributions/${distributionId}/schedules`, staffToken, { allocationId: allocation.allocationId, slotId: slots[0].slotId });
    const scheduleId = assigned.schedule.scheduleId;
    assert.equal((await overview()).nextSchedule, null); // Draft assignments are not published.
    await unavailablePass();
    await staffRequest(`/distributions/${distributionId}/schedules/${scheduleId}/reschedule`, staffToken, { slotId: slots[1].slotId });
    await staffRequest(`/distributions/${distributionId}/open`, staffToken);
    const upcoming = (await overview()).nextSchedule;
    assert.equal(upcoming.id, scheduleId);
    assert.equal(upcoming.location, slots[1].location);
    assert.equal(upcoming.date, nextDay); // Local session date, including UTC midnight rollover.
    assert.equal(upcoming.slotStart, `${nextDay}T00:15:00+08:00`);
    assert.equal(upcoming.status, 'scheduled');
    assert.equal(upcoming.queueNumber, 1);
    assert.equal(upcoming.program.grantAmount, null);
    const scheduledClaim = (await records()).currentClaim;
    assert.equal(scheduledClaim.status, 'not_claimed');
    assert.equal(scheduledClaim.amount, 1000, 'Use the allocation, not the null program grant');
    assert.equal(scheduledClaim.date, nextDay, 'Use the assigned local session date');
    assert.equal(scheduledClaim.deliveryMode, 'physical_goods');
    assert.deepEqual(Object.keys(scheduledClaim.program).sort(), ['code', 'id', 'name']);
    assert.equal((await api.getBeneficiaryOverview(otherLogin.accessToken)).nextSchedule, null);
    const scopedResponse = await fetch(`${base}/mobile/beneficiaries/me/overview?beneficiaryId=${other.beneficiary.id}`, { headers: { Authorization: `Bearer ${login.accessToken}` } });
    assert.equal(scopedResponse.headers.get('cache-control'), 'private, no-store');
    assert.equal((await scopedResponse.json()).data.nextSchedule.id, scheduleId);
    assert.deepEqual(Object.keys(upcoming).sort(), ['date', 'distributionId', 'id', 'location', 'program', 'queueNumber', 'slotEnd', 'slotStart', 'status', 'title']);
    const firstPasses = await Promise.allSettled([api.issueClaimPass(login.accessToken), api.issueClaimPass(login.accessToken)]);
    const pass = firstPasses.find((result) => result.status === 'fulfilled')?.value;
    assert.ok(pass, 'At least one initial QR request must succeed.');
    for (const result of firstPasses) if (result.status === 'rejected') assert.equal(result.reason.code, 'QR_CLAIM_CONCURRENT_CHANGE');
    assert.match(pass.claimCode, /^gya1_[A-Za-z0-9_-]{43}$/);
    assert.equal(pass.status, 'active');
    assert.equal(pass.schedule.id, scheduleId);
    assert.equal(pass.schedule.location, slots[1].location);
    assert.equal(pass.schedule.date, nextDay);
    assert.equal(pass.expiresAt, slots[1].slotEnd.toISOString());
    assert.deepEqual(Object.keys(pass).sort(), ['claimCode', 'expiresAt', 'id', 'issuedAt', 'schedule', 'status']);
    const passes = await Promise.all([api.issueClaimPass(login.accessToken), api.issueClaimPass(login.accessToken)]);
    assert.ok(passes.every((reopened) => reopened.id === pass.id && reopened.claimCode === pass.claimCode));
    assert.equal(await prisma.qrToken.count({ where: { beneficiaryId, distributionId } }), 1);
    const storedPass = await prisma.qrToken.findUnique({ where: { qrTokenId: pass.id } });
    const { hashQrToken } = await load('src/modules/distributions/distributionClaim.service.js');
    assert.equal(storedPass.tokenHash, hashQrToken(pass.claimCode));
    assert.ok(!JSON.stringify(storedPass).includes(pass.claimCode));
    const passAudit = await prisma.auditLog.findMany({ where: { recordId: pass.id } });
    assert.equal(passAudit.length, 1);
    assert.equal(passAudit[0].actorType, 'BENEFICIARY');
    assert.ok(!JSON.stringify(passAudit).includes(pass.claimCode));
    await assert.rejects(api.issueClaimPass(otherLogin.accessToken), (error) => error.code === 'CLAIM_PASS_UNAVAILABLE');
    const ownPass = await fetch(`${base}/mobile/beneficiaries/me/claim-pass?beneficiaryId=${other.beneficiary.id}`, {
      method: 'POST', headers: { Authorization: `Bearer ${login.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ beneficiaryId: other.beneficiary.id, distributionId: randomUUID() }),
    });
    assert.equal(ownPass.headers.get('cache-control'), 'private, no-store');
    assert.equal((await ownPass.json()).data.id, pass.id);
    const preview = await staffRequest(`/distributions/${distributionId}/claims/preview-qr`, staffToken, { token: pass.claimCode });
    assert.equal(preview.schedule.scheduleId, scheduleId);
    assert.equal(preview.beneficiary.beneficiaryId, beneficiaryId);
    assert.equal(await prisma.claim.count({ where: { beneficiaryId } }), 0); // Opening/previewing does not approve a claim.
    await prisma.qrToken.update({ where: { qrTokenId: pass.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await assert.rejects(api.issueClaimPass(login.accessToken), (error) => error.code === 'CLAIM_PASS_EXPIRED');
    await prisma.qrToken.update({ where: { qrTokenId: pass.id }, data: { expiresAt: storedPass.expiresAt } });
    await prisma.distribution.update({ where: { distributionId }, data: { verificationRequirement: 'BIOMETRIC' } });
    await assert.rejects(api.issueClaimPass(login.accessToken), (error) => error.code === 'QR_NOT_REQUIRED');
    await prisma.distribution.update({ where: { distributionId }, data: { verificationRequirement: 'QR_OR_BIOMETRIC' } });
    assert.equal((await api.issueClaimPass(login.accessToken)).claimCode, pass.claimCode);
    const alternativePreview = await staffRequest(`/distributions/${distributionId}/claims/preview-qr`, staffToken, { token: pass.claimCode });
    assert.equal(alternativePreview.verificationCompleteAfterConfirm, true);
    await prisma.distribution.update({ where: { distributionId }, data: { verificationRequirement: 'QR' } });
    const anotherId = randomUUID();
    distributionIds.push(anotherId);
    await prisma.distribution.create({ data: { distributionId: anotherId, programId, createdById: userId, title: 'Another synthetic event', distributionDate: new Date(nextDay), startTime: new Date('1970-01-01T00:00:00Z'), endTime: new Date('1970-01-01T12:00:00Z'), slotDurationMinutes: 30, location: 'Another venue', barangayId, status: 'OPEN' } });
    await prisma.distributionAllocation.create({ data: { distributionId: anotherId, beneficiaryId, enrollmentId, amount: 1000, allocationStatus: 'ALLOCATED', allocatedById: userId, allocatedAt: new Date() } });
    const anotherSlot = await prisma.distributionSlot.create({ data: { distributionId: anotherId, sessionId: randomUUID(), sessionLabel: 'Another session', location: 'Another venue', slotStart: new Date(`${nextDay}T01:15:00+08:00`), slotEnd: new Date(`${nextDay}T01:45:00+08:00`), capacity: 5 } });
    const anotherSchedule = await prisma.schedule.create({ data: { distributionId: anotherId, beneficiaryId, slotId: anotherSlot.slotId, queueNumber: 1 } });
    assert.equal((await overview()).nextSchedule.id, scheduleId);
    await prisma.distributionSlot.update({ where: { slotId: anotherSlot.slotId }, data: { slotStart: new Date(`${nextDay}T00:00:00+08:00`), slotEnd: new Date(`${nextDay}T00:10:00+08:00`) } });
    assert.equal((await overview()).nextSchedule.id, anotherSchedule.scheduleId);
    await prisma.schedule.update({ where: { scheduleId: anotherSchedule.scheduleId }, data: { status: 'CANCELLED' } });
    assert.equal((await overview()).nextSchedule.id, scheduleId);
    for (const status of ['PENDING', 'FOR_VALIDATION', 'NEEDS_CORRECTION', 'REJECTED', 'SUSPENDED', 'WITHDRAWN']) {
      await prisma.enrollment.update({ where: { enrollmentId }, data: { status } });
      const hidden = await overview();
      assert.equal(hidden.enrollments[0].status, status.toLowerCase());
      assert.equal(hidden.nextSchedule, null);
      await unavailablePass();
    }
    await prisma.enrollment.update({ where: { enrollmentId }, data: { status: 'APPROVED' } });
    for (const status of ['DRAFT', 'CLOSED', 'CANCELLED']) {
      await prisma.distribution.update({ where: { distributionId }, data: { status } });
      assert.equal((await overview()).nextSchedule, null);
      await unavailablePass();
    }
    await prisma.distribution.update({ where: { distributionId }, data: { status: 'OPEN' } });
    for (const status of ['DRAFT', 'CLOSED', 'CANCELLED']) {
      await prisma.program.update({ where: { programId }, data: { status } });
      assert.equal((await overview()).nextSchedule, null);
      await unavailablePass();
    }
    await prisma.program.update({ where: { programId }, data: { status: 'ACTIVE', grantAmount: '1250.50' } });
    assert.equal((await overview()).enrollments[0].program.grantAmount, 1250.5);
    for (const allocationStatus of ['PENDING', 'CANCELLED', 'CLAIMED']) {
      await prisma.distributionAllocation.update({ where: { allocationId: allocation.allocationId }, data: { allocationStatus } });
      assert.equal((await overview()).nextSchedule, null);
      await unavailablePass();
    }
    await prisma.distributionAllocation.update({ where: { allocationId: allocation.allocationId }, data: { allocationStatus: 'ALLOCATED' } });
    for (const status of ['MISSED', 'CANCELLED']) {
      await prisma.schedule.update({ where: { scheduleId }, data: { status } });
      assert.equal((await overview()).nextSchedule, null);
      await unavailablePass();
    }
    await prisma.schedule.update({ where: { scheduleId }, data: { status: 'CHECKED_IN' } });
    assert.equal((await overview()).nextSchedule.status, 'checked_in');
    await assert.rejects(api.issueClaimPass(login.accessToken), (error) => error.code === 'CLAIM_PASS_PROCESSED');
    await prisma.distributionSlot.update({ where: { slotId: slots[1].slotId }, data: { slotStatus: 'CLOSED' } });
    assert.equal((await overview()).nextSchedule, null);
    await unavailablePass();
    await prisma.distributionSlot.update({ where: { slotId: slots[1].slotId }, data: { slotStatus: 'FULL', slotStart: new Date(Date.now() - 60000), slotEnd: new Date(Date.now() - 1000) } });
    assert.equal((await overview()).nextSchedule, null);
    await unavailablePass();
    await prisma.distributionSlot.update({ where: { slotId: slots[1].slotId }, data: { slotStart: slots[1].slotStart, slotEnd: slots[1].slotEnd } });
    await prisma.schedule.update({ where: { scheduleId }, data: { status: 'SCHEDULED' } });
    await staffRequest(`/distributions/${distributionId}/qr-tokens/${pass.id}/revoke`, staffToken);
    await assert.rejects(api.issueClaimPass(login.accessToken), (error) => error.code === 'CLAIM_PASS_REVOKED');
    assert.equal((await prisma.qrToken.findUnique({ where: { qrTokenId: pass.id } })).qrStatus, 'REVOKED');
    const reissued = await staffRequest(`/distributions/${distributionId}/qr-tokens/${pass.id}/reissue`, staffToken);
    await assert.rejects(api.issueClaimPass(login.accessToken), (error) => error.code === 'CLAIM_PASS_STAFF_ISSUED');
    assert.equal((await prisma.qrToken.findUnique({ where: { qrTokenId: pass.id } })).tokenHash, hashQrToken(reissued.qrToken.token));
    // A second event proves the actual mobile credential reaches staff verification.
    await prisma.distribution.update({ where: { distributionId: anotherId }, data: { verificationRequirement: 'QR_AND_BIOMETRIC' } });
    await prisma.schedule.update({ where: { scheduleId: anotherSchedule.scheduleId }, data: { status: 'SCHEDULED' } });
    const combinedPass = await api.issueClaimPass(login.accessToken);
    assert.equal(combinedPass.schedule.distributionId, anotherId);
    // Represent an existing staff biometric-first result, without pretending to run face matching.
    const combinedAllocation = await prisma.distributionAllocation.findUnique({ where: { distributionId_beneficiaryId: { distributionId: anotherId, beneficiaryId } } });
    const biometricFirst = await prisma.claim.create({ data: { beneficiaryId, distributionId: anotherId,
      scheduleId: anotherSchedule.scheduleId, allocationId: combinedAllocation.allocationId, verifiedById: userId,
      claimStatus: 'PENDING', verificationMethod: 'QR_AND_BIOMETRIC', biometricVerified: true, qrVerified: false } });
    await prisma.schedule.update({ where: { scheduleId: anotherSchedule.scheduleId }, data: { status: 'CHECKED_IN' } });
    assert.equal((await api.issueClaimPass(login.accessToken)).claimCode, combinedPass.claimCode);
    assert.equal((await prisma.claim.findUnique({ where: { claimId: biometricFirst.claimId } })).qrVerified, false);
    await prisma.claim.delete({ where: { claimId: biometricFirst.claimId } });
    await prisma.schedule.update({ where: { scheduleId: anotherSchedule.scheduleId }, data: { status: 'SCHEDULED' } });
    const verify = (eventId, token, idempotencyKey, bearer = staffToken) => fetch(`${base}/distributions/${eventId}/claims/verify-qr`, {
      method: 'POST', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ token }),
    });
    assert.equal((await verify(anotherId, combinedPass.claimCode, randomUUID(), login.accessToken)).status, 401);
    const verificationKey = randomUUID();
    const verified = await verify(anotherId, combinedPass.claimCode, verificationKey);
    assert.equal(verified.status, 201);
    const verification = (await verified.json()).data;
    assert.equal(verification.claim.claimStatus, 'PENDING');
    assert.equal(verification.claim.qrVerified, true);
    assert.equal(verification.claim.biometricVerified, false);
    assert.equal(verification.nextRequiredVerification, 'BIOMETRIC');
    assert.equal(verification.walletTransactionCreated, false);
    const replay = await verify(anotherId, combinedPass.claimCode, verificationKey);
    assert.equal(replay.status, 201);
    assert.equal(replay.headers.get('idempotency-replayed'), 'true');
    assert.equal((await verify(anotherId, combinedPass.claimCode, randomUUID())).status, 409);
    assert.equal(await prisma.claim.count({ where: { beneficiaryId, distributionId: anotherId } }), 1);
    assert.equal((await prisma.qrToken.findUnique({ where: { qrTokenId: combinedPass.id } })).qrStatus, 'USED');
    await assert.rejects(api.issueClaimPass(login.accessToken), (error) => error.code === 'CLAIM_PASS_PROCESSED');
    const qrOnly = await verify(distributionId, reissued.qrToken.token, randomUUID());
    assert.equal(qrOnly.status, 201);
    const physicalClaimId = (await qrOnly.json()).data.claim.claimId;
    assert.equal((await prisma.claim.findUnique({ where: { claimId: physicalClaimId } })).claimStatus, 'VERIFIED');
    assert.equal(await prisma.transaction.count({ where: { beneficiaryId } }), 0);
    let claimRecords = await records();
    assert.equal(claimRecords.claims.find(item => item.id === physicalClaimId).status, 'verified');
    assert.equal(claimRecords.claims.find(item => item.id === physicalClaimId).releasedAt, null);
    assert.equal(claimRecords.claims.find(item => item.distributionId === anotherId).status, 'pending');
    await staffRequest(`/distributions/${distributionId}/claims/${physicalClaimId}/release`, facilitatorToken, {
      evidenceType: 'OTHER', evidenceReference: 'SYNTHETIC-RELEASE-001',
      notes: 'Synthetic API test only; no physical goods transferred.', beneficiaryAcknowledged: true, releasedQuantity: 1,
    }, { 'Idempotency-Key': randomUUID() });
    await staffRequest(`/distributions/${distributionId}/claims/${physicalClaimId}/receipt`, facilitatorToken);
    claimRecords = await records();
    const released = claimRecords.claims.find(item => item.id === physicalClaimId);
    assert.equal(released.status, 'claimed');
    assert.ok(released.verifiedAt);
    assert.ok(released.claimedAt);
    assert.ok(released.releasedAt);
    assert.equal(released.package.name, 'Synthetic relief package');
    assert.equal(released.package.quantity, 1);
    assert.equal(released.package.unit, 'pack');
    assert.ok(released.receipt.number);
    assert.ok(released.receipt.issuedAt);
    assert.deepEqual(Object.keys(released).sort(), ['amount', 'claimedAt', 'createdAt', 'date', 'deliveryMode', 'distributionId', 'id', 'needsReview', 'package', 'program', 'receipt', 'releasedAt', 'scheduleId', 'status', 'verificationMethod', 'verifiedAt']);
    assert.deepEqual(Object.keys(released.receipt).sort(), ['issuedAt', 'number']);
    assert.equal(claimRecords.wallet, null, 'Physical release must not create a wallet');
    assert.equal(claimRecords.transactions.length, 0, 'Physical assistance must not become a wallet credit');
    assert.notEqual(claimRecords.currentClaim?.id, physicalClaimId);
    assert.equal(released.needsReview, false);
    await prisma.claim.update({ where: { claimId: physicalClaimId }, data: { isDuplicateFlag: true } });
    assert.equal((await records()).claims.find(item => item.id === physicalClaimId).needsReview, true);
    await prisma.claim.update({ where: { claimId: physicalClaimId }, data: { isDuplicateFlag: false } });
    // A closed event remains historical; a later staff decision is reflected without losing its receipt.
    await prisma.distribution.update({ where: { distributionId }, data: { status: 'CLOSED' } });
    for (const claimStatus of ['REJECTED', 'VOIDED', 'CLAIMED']) {
      await prisma.claim.update({ where: { claimId: physicalClaimId }, data: { claimStatus } });
      assert.equal((await records()).claims.find(item => item.id === physicalClaimId).status, claimStatus.toLowerCase());
    }
    // Seed only synthetic ledger fixtures to exercise signed amounts and inconsistent ownership defenses.
    const ownWallet = await prisma.walletAccount.create({ data: { beneficiaryId, balance: 0, currency: 'PHP', accountStatus: 'ACTIVE' } });
    const otherWallet = await prisma.walletAccount.create({ data: { beneficiaryId: other.beneficiary.id, balance: 0, currency: 'PHP', accountStatus: 'ACTIVE' } });
    const ledgerClaimId = claimRecords.claims.find(item => item.distributionId === anotherId).id;
    for (const [transactionType, walletId, claimId] of [
      ['BENEFIT_CREDIT', ownWallet.walletId, ledgerClaimId],
      ['BENEFIT_REVERSAL', ownWallet.walletId, ledgerClaimId],
      ['BENEFIT_CREDIT', otherWallet.walletId, physicalClaimId],
      ['SIMULATED_TRANSFER_IN', ownWallet.walletId, null],
    ]) await prisma.transaction.create({ data: { beneficiaryId, walletId, claimId, amount: 1000,
      transactionType, referenceNo: randomUUID(), status: 'COMPLETED', balanceBefore: 0, balanceAfter: 0 } });
    const ledger = await records();
    assert.equal(ledger.wallet.balance, 0);
    assert.equal(ledger.transactions.length, 2);
    assert.deepEqual(ledger.transactions.map(item => item.amount).sort((a, b) => a - b), [-1000, 1000]);
    assert.deepEqual(Object.keys(ledger.transactions[0]).sort(), ['amount', 'claimId', 'claimStatus', 'claimedAt', 'createdAt', 'date', 'id', 'program', 'reference', 'status', 'type']);
    const otherRecords = await api.getWalletOverview(otherLogin.accessToken);
    assert.equal(otherRecords.claims.length, 0);
    assert.equal(otherRecords.transactions.length, 0);
    assert.equal(otherRecords.currentClaim, null);
    const scopedWallet = await fetch(`${base}/mobile/beneficiaries/me/wallet?beneficiaryId=${other.beneficiary.id}`, { headers: { Authorization: `Bearer ${login.accessToken}` } });
    assert.equal(scopedWallet.headers.get('cache-control'), 'private, no-store');
    assert.equal((await scopedWallet.json()).data.claims.length, 2);
    const staff = await fetch(`${base}/beneficiaries/${beneficiaryId}`, { headers: { Authorization: `Bearer ${staffToken}` } });
    assert.equal(staff.status, 200);
    assert.equal((await staff.json()).data.beneficiary.firstName, 'Updated');
    const asset = { name: 'Málaga ñ sample.pdf', uri: 'blob:synthetic-test', file: new File(['%PDF-1.4\nSynthetic file\n%%EOF'], 'Málaga ñ sample.pdf', { type: 'application/pdf' }) };
    const document = await api.uploadDocument(login.accessToken, asset, 'proof_of_residency');
    assert.equal(document.originalName, asset.name);
    assert.equal(document.status, 'received');
    const staffDocuments = await fetch(`${base}/beneficiaries/${beneficiaryId}/documents`, { headers: { Authorization: `Bearer ${staffToken}` } });
    const staffDocument = (await staffDocuments.json()).data.documents.find((item) => item.documentId === document.id);
    assert.equal(staffDocument.uploadedBy, null);
    const review = (id, body) => fetch(`${base}/beneficiaries/${beneficiaryId}/documents/${id}/review`, {
      method: 'POST', headers: { Authorization: `Bearer ${staffToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    assert.equal((await review(document.id, { decision: 'REJECTED', reason: 'Please upload a clear copy.' })).status, 200);
    let documents = await api.getDocuments(login.accessToken);
    assert.equal(documents[0].status, 'rejected');
    assert.equal(documents[0].reviewNotes, 'Please upload a clear copy.');
    assert.equal(documents[0].canReplace, true);
    const correctedAsset = { ...asset, name: 'Corrected.pdf', file: new File(['%PDF-1.4\nCorrected synthetic file\n%%EOF'], 'Corrected.pdf', { type: 'application/pdf' }) };
    const corrected = await api.uploadDocument(login.accessToken, correctedAsset, 'proof_of_residency', document.id);
    assert.equal(corrected.status, 'received');
    assert.equal(corrected.replacesDocumentId, document.id);
    assert.equal((await review(corrected.id, { decision: 'ACCEPTED' })).status, 200);
    documents = await api.getDocuments(login.accessToken);
    assert.equal(documents.find((item) => item.id === corrected.id).status, 'accepted');
    assert.ok(documents.find((item) => item.id === corrected.id).reviewedAt);
    assert.equal(documents.find((item) => item.id === document.id).status, 'superseded');
    await api.logout(login.accessToken);
    await assert.rejects(api.getCurrentBeneficiary(login.accessToken), (error) => error.status === 401);
    await assert.rejects(overview(), (error) => error.status === 401);
    await assert.rejects(records(), (error) => error.status === 401);
    await assert.rejects(api.issueClaimPass(login.accessToken), (error) => error.status === 401);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    const ownerIds = [beneficiaryId, ...extraBeneficiaries].filter(Boolean);
    const documents = await prisma.beneficiaryDocument.findMany({ where: { beneficiaryId: { in: ownerIds } }, select: { documentId: true } });
    const qrTokens = await prisma.qrToken.findMany({ where: { beneficiaryId: { in: ownerIds } }, select: { qrTokenId: true } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: [userId, reviewerId, facilitatorId] } }, { recordId: { in: [...ownerIds, ...documents.map((item) => item.documentId), ...qrTokens.map((item) => item.qrTokenId)] } }] } });
    await prisma.idempotencyRecord.deleteMany({ where: { userId: { in: [userId, reviewerId, facilitatorId] } } });
    await prisma.qrScanLog.deleteMany({ where: { distributionId: { in: distributionIds } } });
    await prisma.transaction.deleteMany({ where: { beneficiaryId: { in: ownerIds } } });
    await prisma.walletAccount.deleteMany({ where: { beneficiaryId: { in: ownerIds } } });
    await prisma.claimReceipt.deleteMany({ where: { claim: { beneficiaryId: { in: ownerIds } } } });
    await prisma.claim.deleteMany({ where: { beneficiaryId: { in: ownerIds } } });
    await prisma.qrToken.deleteMany({ where: { beneficiaryId: { in: ownerIds } } });
    await prisma.schedule.deleteMany({ where: { distributionId: { in: distributionIds } } });
    await prisma.distributionSlot.deleteMany({ where: { distributionId: { in: distributionIds } } });
    await prisma.distributionAllocation.deleteMany({ where: { distributionId: { in: distributionIds } } });
    await prisma.distribution.deleteMany({ where: { distributionId: { in: distributionIds } } });
    await prisma.enrollment.deleteMany({ where: { beneficiaryId: { in: ownerIds } } });
    await prisma.programCriterion.deleteMany({ where: { programId: { in: programIds } } });
    await prisma.program.deleteMany({ where: { programId: { in: programIds } } });
    await prisma.beneficiaryDocument.deleteMany({ where: { beneficiaryId: { in: ownerIds } } });
    await prisma.beneficiary.deleteMany({ where: { beneficiaryId: { in: ownerIds } } });
    await prisma.user.deleteMany({ where: { userId: { in: [userId, reviewerId, facilitatorId] } } });
    await prisma.barangay.deleteMany({ where: { barangayId } });
    await prisma.$disconnect();
    for (const file of fs.readdirSync(uploadDirectory)) fs.unlinkSync(path.join(uploadDirectory, file));
    fs.rmdirSync(uploadDirectory);
  }
});
