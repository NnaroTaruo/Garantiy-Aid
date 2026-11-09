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
    const notices = () => api.getNotifications(login.accessToken);
    assert.equal((await notices()).length, 0);
    for (const token of [null, staffToken]) {
      assert.equal((await fetch(`${base}/mobile/beneficiaries/me/notifications`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })).status, 401);
    }
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
    const approvalNotice = (await notices()).find(item => item.title === 'Enrollment approved');
    assert.ok(approvalNotice);
    assert.ok(approvalNotice.message.includes('Synthetic in-kind program'));
    assert.ok(approvalNotice.messageBs.includes('Naaprubahan'));
    assert.equal(approvalNotice.readAt, null);
    assert.equal((await fetch(`${base}/mobile/beneficiaries/me/notifications/${approvalNotice.id}/read`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${staffToken}` },
    })).status, 401);
    assert.deepEqual(Object.keys(approvalNotice).sort(), ['id', 'message', 'messageBs', 'notificationType', 'readAt', 'scheduleId', 'sentAt', 'title', 'titleBs']);
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
    assert.equal((await notices()).filter(item => item.notificationType === 'schedule').length, 0);
    await unavailablePass();
    await staffRequest(`/distributions/${distributionId}/schedules/${scheduleId}/reschedule`, staffToken, { slotId: slots[1].slotId });
    await staffRequest(`/distributions/${distributionId}/open`, staffToken);
    assert.equal((await notices()).filter(item => item.title === 'Claiming schedule available').length, 1);
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
    const releaseKey = randomUUID();
    const releaseBody = {
      evidenceType: 'OTHER', evidenceReference: 'SYNTHETIC-RELEASE-001',
      notes: 'Synthetic API test only; no physical goods transferred.', beneficiaryAcknowledged: true, releasedQuantity: 1,
    };
    await staffRequest(`/distributions/${distributionId}/claims/${physicalClaimId}/release`, facilitatorToken, releaseBody, { 'Idempotency-Key': releaseKey });
    await staffRequest(`/distributions/${distributionId}/claims/${physicalClaimId}/release`, facilitatorToken, releaseBody, { 'Idempotency-Key': releaseKey });
    await staffRequest(`/distributions/${distributionId}/claims/${physicalClaimId}/receipt`, facilitatorToken);
    const releaseNotices = (await notices()).filter(item => item.title === 'Assistance release recorded');
    assert.equal(releaseNotices.length, 1, 'Replayed release must not duplicate an in-app notification');
    assert.equal((await notices()).filter(item => item.title === 'Claim identity verified').length, 1, 'Pending combined verification must not claim verification is complete');
    assert.ok(!releaseNotices[0].message.includes('SYNTHETIC-RELEASE-001'), 'Private evidence must not enter messages');
    const noticeId = releaseNotices[0].id;
    const readResults = await Promise.all([api.markNotificationRead(login.accessToken, noticeId), api.markNotificationRead(login.accessToken, noticeId)]);
    assert.equal(readResults[0].readAt, readResults[1].readAt);
    assert.equal((await api.markNotificationRead(login.accessToken, noticeId)).readAt, readResults[0].readAt);
    assert.equal((await notices()).find(item => item.id === noticeId).readAt, readResults[0].readAt);
    assert.equal((await prisma.notification.findUnique({ where: { notificationId: noticeId } })).status, 'SENT');
    await assert.rejects(api.markNotificationRead(otherLogin.accessToken, noticeId), error => error.status === 404);
    await assert.rejects(api.markNotificationRead(login.accessToken, 'invalid-id'), error => error.status === 400);
    const hiddenNotices = [];
    for (const [channel, status, sentAt, recipient, linkedSchedule] of [
      ['SMS', 'SENT', new Date(), beneficiaryId, null],
      ['EMAIL', 'SENT', new Date(), beneficiaryId, null],
      ['IN_APP', 'FAILED', new Date(), beneficiaryId, null],
      ['IN_APP', 'PENDING', new Date(), beneficiaryId, null],
      ['IN_APP', 'SENT', new Date(Date.now() + 86400000), beneficiaryId, null],
      ['IN_APP', 'SENT', new Date(), other.beneficiary.id, null],
      ['IN_APP', 'SENT', new Date(), other.beneficiary.id, scheduleId],
    ]) hiddenNotices.push(await prisma.notification.create({ data: { beneficiaryId: recipient, scheduleId: linkedSchedule,
      channel, status, sentAt, notificationType: 'OTHER', message: 'Synthetic private delivery record.', providerReference: randomUUID() } }));
    const visibleIds = new Set((await notices()).map(item => item.id));
    assert.ok(hiddenNotices.every(item => !visibleIds.has(item.notificationId)));
    for (const hidden of hiddenNotices) await assert.rejects(api.markNotificationRead(login.accessToken, hidden.notificationId), error => error.status === 404);
    const otherNotices = await api.getNotifications(otherLogin.accessToken);
    assert.equal(otherNotices.length, 1, 'Cross-owner schedule links must not expose a notification');
    const scopedInbox = await fetch(`${base}/mobile/beneficiaries/me/notifications?beneficiaryId=${other.beneficiary.id}`, { headers: { Authorization: `Bearer ${login.accessToken}` } });
    assert.equal(scopedInbox.headers.get('cache-control'), 'private, no-store');
    assert.ok((await scopedInbox.json()).data.some(item => item.id === noticeId));
    // Age only this synthetic account's challenge to exercise login without waiting through the real resend cooldown.
    await prisma.beneficiaryMobileOtp.updateMany({ where: { account: { beneficiaryId } }, data: { createdAt: new Date(Date.now() - 61_000) } });
    const returningCode = await api.requestOtp(contactNumber, 'login');
    const returning = await api.verifyOtp(contactNumber, 'login', returningCode.developmentOtp);
    assert.equal((await api.getNotifications(returning.accessToken)).find(item => item.id === noticeId).readAt, readResults[0].readAt);
    const { createMobileNotifications } = await load('src/modules/mobile/mobileNotifications.service.js');
    const beforeRollback = await prisma.notification.count({ where: { beneficiaryId } });
    await assert.rejects(prisma.$transaction(async tx => {
      await createMobileNotifications(tx, [{ beneficiaryId, type: 'ENROLLMENT_REJECTED', reference: randomUUID() }]);
      throw new Error('Synthetic transaction rollback');
    }), /Synthetic transaction rollback/);
    assert.equal(await prisma.notification.count({ where: { beneficiaryId } }), beforeRollback);
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
    // Seed a completed biometric prerequisite; this exercises simulated settlement, not live face matching.
    const ownWallet = await prisma.walletAccount.create({ data: { beneficiaryId, balance: 0, currency: 'PHP', accountStatus: 'ACTIVE' } });
    const otherWallet = await prisma.walletAccount.create({ data: { beneficiaryId: other.beneficiary.id, balance: 0, currency: 'PHP', accountStatus: 'ACTIVE' } });
    const ledgerClaimId = claimRecords.claims.find(item => item.distributionId === anotherId).id;
    await prisma.claim.update({ where: { claimId: ledgerClaimId }, data: { claimStatus: 'VERIFIED', biometricVerified: true, isDuplicateFlag: false, verifiedAt: new Date() } });
    const creditKey = randomUUID();
    await staffRequest(`/distributions/${anotherId}/claims/${ledgerClaimId}/credit`, reviewerToken, {}, { 'Idempotency-Key': creditKey });
    await staffRequest(`/distributions/${anotherId}/claims/${ledgerClaimId}/credit`, reviewerToken, {}, { 'Idempotency-Key': creditKey });
    const credit = await prisma.transaction.findFirstOrThrow({ where: { claimId: ledgerClaimId, transactionType: 'BENEFIT_CREDIT' } });
    const reversalKey = randomUUID();
    const reversalPath = `/wallets/${ownWallet.walletId}/transactions/${credit.transactionId}/reverse`;
    await staffRequest(reversalPath, reviewerToken, { reason: 'Synthetic notification test reversal.' }, { 'Idempotency-Key': reversalKey });
    await staffRequest(reversalPath, reviewerToken, { reason: 'Synthetic notification test reversal.' }, { 'Idempotency-Key': reversalKey });
    const ledgerNotices = await notices();
    assert.equal(ledgerNotices.filter(item => item.title === 'Simulated benefit credit recorded').length, 1);
    assert.equal(ledgerNotices.filter(item => item.title === 'Simulated benefit credit reversed').length, 1);
    assert.ok(ledgerNotices.find(item => item.title === 'Simulated benefit credit recorded').message.includes('No real funds moved'));
    // Inconsistent ownership and unrelated transfers are still excluded from the beneficiary ledger.
    for (const [transactionType, walletId, claimId] of [
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
    const cancelledId = randomUUID();
    distributionIds.push(cancelledId);
    await prisma.distribution.create({ data: { distributionId: cancelledId, programId, createdById: userId,
      title: 'Synthetic cancellation event', distributionDate: new Date(nextDay), startTime: new Date('1970-01-01T02:00:00Z'),
      endTime: new Date('1970-01-01T03:00:00Z'), slotDurationMinutes: 30, location: 'Cancellation test venue', barangayId } });
    await prisma.distributionAllocation.create({ data: { distributionId: cancelledId, beneficiaryId, enrollmentId, amount: 1000,
      allocationStatus: 'ALLOCATED', allocatedById: userId, allocatedAt: new Date() } });
    const cancelledSlot = await prisma.distributionSlot.create({ data: { distributionId: cancelledId, sessionId: randomUUID(),
      sessionLabel: 'Cancellation session', location: 'Cancellation test venue', slotStart: new Date(`${nextDay}T02:00:00+08:00`),
      slotEnd: new Date(`${nextDay}T02:30:00+08:00`), capacity: 1 } });
    await staffRequest(`/distributions/${cancelledId}/schedules`, staffToken, { allocationId: (await prisma.distributionAllocation.findUnique({ where: { distributionId_beneficiaryId: { distributionId: cancelledId, beneficiaryId } } })).allocationId, slotId: cancelledSlot.slotId });
    const noticesBeforeDraftCancellation = (await notices()).length;
    await staffRequest(`/distributions/${cancelledId}/cancel`, staffToken);
    assert.equal((await notices()).length, noticesBeforeDraftCancellation, 'Cancelling an unpublished draft must not announce a schedule');
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
    // Named requirements must reach the same checklist used by staff enrollment review.
    const createChecklist = async (status, enrolledOwner) => {
      const id = randomUUID(); programIds.push(id);
      await prisma.program.create({ data: { programId: id, programCode: id.slice(0, 25), programName: 'Synthetic named documents ' + id.slice(0, 8),
        programType: 'RELIEF', status, createdById: userId, requiredDocumentTypes: ['BIRTH_CERTIFICATE', 'OTHER'],
        otherRequiredDocumentNames: ['Certificate of Indigency', 'School Enrollment Proof'], otherRequiredDocumentName: 'Certificate of Indigency',
        criteria: { create: { criterionName: 'Adult', fieldName: 'AGE', operator: 'GREATER_THAN_OR_EQUAL', expectedValue: 18, isRequired: true } },
        ...(enrolledOwner ? { enrollments: { create: { beneficiaryId: enrolledOwner, submittedById: userId } } } : {}) } });
      return id;
    };
    const namedProgram = await createChecklist('ACTIVE');
    const ownClosed = await createChecklist('CLOSED', beneficiaryId);
    const foreignClosed = await createChecklist('CLOSED', other.beneficiary.id);
    const hiddenDraft = await createChecklist('DRAFT', beneficiaryId);
    const hiddenCancelled = await createChecklist('CANCELLED', beneficiaryId);
    const catalog = await api.getDocumentRequirements(login.accessToken);
    assert.ok(catalog.programs.some(item => item.id === ownClosed));
    for (const id of [foreignClosed, hiddenDraft, hiddenCancelled]) assert.ok(!catalog.programs.some(item => item.id === id));
    const checklist = catalog.programs.find(item => item.id === namedProgram);
    assert.deepEqual(Object.keys(checklist).sort(), ['code', 'id', 'name', 'requirements', 'status']);
    assert.equal(checklist.requirements.filter(item => item.docType === 'other').length, 2);
    assert.equal(checklist.requirements[1].documentName, 'Certificate of Indigency');
    assert.ok(!JSON.stringify(catalog).match(/budgetAmount|createdBy|eligibilitySnapshot|criteria|beneficiaryId/));
    const paging = await fetch(`${base}/mobile/beneficiaries/me/document-requirements?page=1&pageSize=1`, { headers: { Authorization: `Bearer ${login.accessToken}` } });
    assert.equal(paging.headers.get('cache-control'), 'private, no-store');
    assert.ok((await paging.json()).data.pagination.totalPages > 1);
    assert.equal((await fetch(`${base}/mobile/beneficiaries/me/document-requirements?beneficiaryId=${other.beneficiary.id}`, { headers: { Authorization: `Bearer ${login.accessToken}` } })).status, 400);
    for (const token of ['', staffToken]) await assert.rejects(api.getDocumentRequirements(token), error => error.status === 401);
    const submitNamed = () => fetch(`${base}/programs/${namedProgram}/enrollments`, { method: 'POST', headers: { Authorization: `Bearer ${staffToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ beneficiaryId }) });
    assert.equal((await submitNamed()).status, 409);
    const namedOne = await api.uploadDocument(login.accessToken, asset, 'other', undefined, 'Certificate of Indigency');
    const namedTwo = await api.uploadDocument(login.accessToken, asset, 'other', undefined, 'School Enrollment Proof');
    assert.notEqual(namedOne.id, namedTwo.id, 'The same bytes can satisfy separate named requirements');
    assert.equal(namedOne.documentName, 'Certificate of Indigency'); assert.equal(namedTwo.documentName, 'School Enrollment Proof');
    assert.equal((await api.uploadDocument(login.accessToken, asset, 'other', undefined, 'Certificate of Indigency')).id, namedOne.id);
    assert.equal((await submitNamed()).status, 409, 'A birth certificate is still required');
    const birth = await api.uploadDocument(login.accessToken, asset, 'birth_certificate');
    const namedEnrollment = await staffRequest(`/programs/${namedProgram}/enrollments`, staffToken, { beneficiaryId });
    const namedEnrollmentId = namedEnrollment.enrollment.enrollmentId;
    await staffRequest(`/enrollments/${namedEnrollmentId}/start-review`, reviewerToken);
    assert.equal((await review(namedOne.id, { decision: 'REJECTED', reason: 'Correct the named certificate sample.' })).status, 200);
    await assert.rejects(api.uploadDocument(login.accessToken, correctedAsset, 'other', namedOne.id, 'School Enrollment Proof'), error => error.code === 'DOCUMENT_NAME_MISMATCH');
    await assert.rejects(api.uploadDocument(otherLogin.accessToken, correctedAsset, 'other', namedOne.id, 'Certificate of Indigency'), error => error.status === 404);
    const namedCorrection = await api.uploadDocument(login.accessToken, correctedAsset, 'other', namedOne.id, ' certificate   of indigency ');
    assert.equal(namedCorrection.documentName, 'Certificate of Indigency', 'Corrections retain the original canonical requirement');
    assert.equal((await api.uploadDocument(login.accessToken, correctedAsset, 'other', namedOne.id)).id, namedCorrection.id);
    for (const id of [namedCorrection.id, namedTwo.id, birth.id]) assert.equal((await review(id, { decision: 'ACCEPTED' })).status, 200);
    await staffRequest(`/enrollments/${namedEnrollmentId}/approve`, reviewerToken, { remarks: 'All synthetic named requirements accepted.' });
    assert.equal((await api.getBeneficiaryOverview(login.accessToken)).enrollments.find(item => item.id === namedEnrollmentId).status, 'approved');
    const finalNamed = (await api.getDocuments(login.accessToken)).filter(item => item.docType === 'other');
    assert.equal(finalNamed.find(item => item.id === namedOne.id).status, 'superseded');
    assert.ok(finalNamed.some(item => item.id === namedCorrection.id && item.documentName === 'Certificate of Indigency' && item.status === 'accepted'));
    const visibleToStaff = await fetch(`${base}/beneficiaries/${beneficiaryId}/documents`, { headers: { Authorization: `Bearer ${staffToken}` } });
    assert.equal((await visibleToStaff.json()).data.documents.find(item => item.documentId === namedCorrection.id).documentName, 'Certificate of Indigency');
    await api.logout(login.accessToken);
    await assert.rejects(api.getDocumentRequirements(login.accessToken), error => error.status === 401);
    await assert.rejects(api.getCurrentBeneficiary(login.accessToken), (error) => error.status === 401);
    await assert.rejects(overview(), (error) => error.status === 401);
    await assert.rejects(records(), (error) => error.status === 401);
    await assert.rejects(notices(), (error) => error.status === 401);
    await assert.rejects(api.markNotificationRead(login.accessToken, approvalNotice.id), (error) => error.status === 401);
    await assert.rejects(api.issueClaimPass(login.accessToken), (error) => error.status === 401);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    const ownerIds = [beneficiaryId, ...extraBeneficiaries].filter(Boolean);
    const documents = await prisma.beneficiaryDocument.findMany({ where: { beneficiaryId: { in: ownerIds } }, select: { documentId: true } });
    const qrTokens = await prisma.qrToken.findMany({ where: { beneficiaryId: { in: ownerIds } }, select: { qrTokenId: true } });
    await prisma.notification.deleteMany({ where: { beneficiaryId: { in: ownerIds } } });
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
