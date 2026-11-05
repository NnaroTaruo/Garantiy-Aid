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

test('the real mobile API shares accounts, enrollments, schedules, documents, and logout with staff', async () => {
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
  const programIds = [], distributionIds = [], extraBeneficiaries = [];
  let beneficiaryId;
  try {
    await prisma.barangay.create({ data: { barangayId, barangayCode: barangayId.slice(0, 20), barangayName: 'Mobile API test', city: 'Test', province: 'Test' } });
    await prisma.user.create({ data: { userId, employeeId: userId.slice(0, 20), username: `test_${userId.replaceAll('-', '').slice(0, 16)}`, fullName: 'Synthetic API tester', email: `${userId}@example.invalid`, passwordHash: 'not-a-login-password', role: 'SYSTEM_ADMIN' } });
    await prisma.staffSession.create({ data: { sessionId: staffSessionId, userId, expiresAt: new Date(Date.now() + 300_000) } });
    await prisma.user.create({ data: { userId: reviewerId, employeeId: reviewerId.slice(0, 20), fullName: 'Synthetic enrollment reviewer', email: `${reviewerId}@example.invalid`, passwordHash: 'not-a-login-password', role: 'DSWD_STAFF' } });
    await prisma.staffSession.create({ data: { sessionId: reviewerSessionId, userId: reviewerId, expiresAt: new Date(Date.now() + 300_000) } });
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
    const staffRequest = async (url, token, body = {}) => {
      const response = await fetch(base + url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const payload = await response.json();
      assert.ok(response.ok, JSON.stringify({ status: response.status, error: payload.error }));
      return payload.data;
    };
    const overview = () => api.getBeneficiaryOverview(login.accessToken);
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
    await prisma.distribution.create({ data: { distributionId, programId, createdById: userId, title: 'Synthetic shared distribution', distributionDate: new Date(day), startTime: new Date('1970-01-01T00:00:00Z'), endTime: new Date('1970-01-01T12:00:00Z'), slotDurationMinutes: 30, location: 'Parent event venue', barangayId, deliveryMode: 'PHYSICAL_GOODS' } });
    const allocation = await prisma.distributionAllocation.create({ data: { distributionId, beneficiaryId, enrollmentId, amount: 1000, allocationStatus: 'ALLOCATED', allocatedById: userId, allocatedAt: new Date() } });
    const slots = [];
    for (const [date, location] of [[day, 'Original session venue'], [nextDay, 'Rescheduled session venue']]) {
      slots.push(await prisma.distributionSlot.create({ data: { distributionId, sessionId: randomUUID(), sessionLabel: 'Synthetic session', location, slotStart: new Date(`${date}T00:15:00+08:00`), slotEnd: new Date(`${date}T00:45:00+08:00`), capacity: 1 } }));
    }
    const assigned = await staffRequest(`/distributions/${distributionId}/schedules`, staffToken, { allocationId: allocation.allocationId, slotId: slots[0].slotId });
    const scheduleId = assigned.schedule.scheduleId;
    assert.equal((await overview()).nextSchedule, null); // Draft assignments are not published.
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
    assert.equal((await api.getBeneficiaryOverview(otherLogin.accessToken)).nextSchedule, null);
    const scopedResponse = await fetch(`${base}/mobile/beneficiaries/me/overview?beneficiaryId=${other.beneficiary.id}`, { headers: { Authorization: `Bearer ${login.accessToken}` } });
    assert.equal(scopedResponse.headers.get('cache-control'), 'private, no-store');
    assert.equal((await scopedResponse.json()).data.nextSchedule.id, scheduleId);
    assert.deepEqual(Object.keys(upcoming).sort(), ['date', 'distributionId', 'id', 'location', 'program', 'queueNumber', 'slotEnd', 'slotStart', 'status', 'title']);
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
    }
    await prisma.enrollment.update({ where: { enrollmentId }, data: { status: 'APPROVED' } });
    for (const status of ['DRAFT', 'CLOSED', 'CANCELLED']) {
      await prisma.distribution.update({ where: { distributionId }, data: { status } });
      assert.equal((await overview()).nextSchedule, null);
    }
    await prisma.distribution.update({ where: { distributionId }, data: { status: 'OPEN' } });
    for (const status of ['DRAFT', 'CLOSED', 'CANCELLED']) {
      await prisma.program.update({ where: { programId }, data: { status } });
      assert.equal((await overview()).nextSchedule, null);
    }
    await prisma.program.update({ where: { programId }, data: { status: 'ACTIVE', grantAmount: '1250.50' } });
    assert.equal((await overview()).enrollments[0].program.grantAmount, 1250.5);
    for (const allocationStatus of ['PENDING', 'CANCELLED', 'CLAIMED']) {
      await prisma.distributionAllocation.update({ where: { allocationId: allocation.allocationId }, data: { allocationStatus } });
      assert.equal((await overview()).nextSchedule, null);
    }
    await prisma.distributionAllocation.update({ where: { allocationId: allocation.allocationId }, data: { allocationStatus: 'ALLOCATED' } });
    for (const status of ['MISSED', 'CANCELLED']) {
      await prisma.schedule.update({ where: { scheduleId }, data: { status } });
      assert.equal((await overview()).nextSchedule, null);
    }
    await prisma.schedule.update({ where: { scheduleId }, data: { status: 'CHECKED_IN' } });
    assert.equal((await overview()).nextSchedule.status, 'checked_in');
    await prisma.distributionSlot.update({ where: { slotId: slots[1].slotId }, data: { slotStatus: 'CLOSED' } });
    assert.equal((await overview()).nextSchedule, null);
    await prisma.distributionSlot.update({ where: { slotId: slots[1].slotId }, data: { slotStatus: 'FULL', slotStart: new Date(Date.now() - 60000), slotEnd: new Date(Date.now() - 1000) } });
    assert.equal((await overview()).nextSchedule, null);
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
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    const ownerIds = [beneficiaryId, ...extraBeneficiaries].filter(Boolean);
    const documents = await prisma.beneficiaryDocument.findMany({ where: { beneficiaryId: { in: ownerIds } }, select: { documentId: true } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: [userId, reviewerId] } }, { recordId: { in: [...ownerIds, ...documents.map((item) => item.documentId)] } }] } });
    await prisma.schedule.deleteMany({ where: { distributionId: { in: distributionIds } } });
    await prisma.distributionSlot.deleteMany({ where: { distributionId: { in: distributionIds } } });
    await prisma.distributionAllocation.deleteMany({ where: { distributionId: { in: distributionIds } } });
    await prisma.distribution.deleteMany({ where: { distributionId: { in: distributionIds } } });
    await prisma.enrollment.deleteMany({ where: { beneficiaryId: { in: ownerIds } } });
    await prisma.programCriterion.deleteMany({ where: { programId: { in: programIds } } });
    await prisma.program.deleteMany({ where: { programId: { in: programIds } } });
    await prisma.beneficiaryDocument.deleteMany({ where: { beneficiaryId: { in: ownerIds } } });
    await prisma.beneficiary.deleteMany({ where: { beneficiaryId: { in: ownerIds } } });
    await prisma.user.deleteMany({ where: { userId: { in: [userId, reviewerId] } } });
    await prisma.barangay.deleteMany({ where: { barangayId } });
    await prisma.$disconnect();
    for (const file of fs.readdirSync(uploadDirectory)) fs.unlinkSync(path.join(uploadDirectory, file));
    fs.rmdirSync(uploadDirectory);
  }
});
