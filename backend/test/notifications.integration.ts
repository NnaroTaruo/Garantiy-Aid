import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import { app } from "../src/app.ts";
import { config } from "../src/config.ts";
import { prisma } from "../src/db.ts";
import { createSessionToken, hashSecret } from "../src/security.ts";

// Uses an explicitly configured local database; all test records are removed.
test("notifications enforce ownership and preserve the first read across logout/login", async () => {
  const barangayId = randomUUID();
  const beneficiaryIds = [randomUUID(), randomUUID()];
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const call = (path: string, token?: string, method = "GET") => fetch(baseUrl + path, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const newSession = async (beneficiaryId: string) => {
    const token = createSessionToken();
    await prisma.authSession.create({ data: {
      beneficiaryId, tokenHash: hashSecret(token, "session", config.authPepper),
      expiresAt: new Date(Date.now() + 60_000),
    } });
    return token;
  };
  const path = "/beneficiaries/me/notifications";
  try {
    await prisma.barangay.create({ data: {
      barangayId, barangayCode: `TEST-${barangayId.slice(0, 8)}`,
      barangayName: "Notification test", city: "Test", province: "Test",
    } });
    for (const beneficiaryId of beneficiaryIds) {
      await prisma.beneficiary.create({ data: {
        beneficiaryId, barangayId, firstName: "Notification", lastName: "Test",
        contactNumber: `+639${randomInt(100_000_000, 1_000_000_000)}`,
        birthDate: new Date("1990-01-01Z"), sex: "female", address: "Test record",
        isVerified: true, status: "active",
      } });
    }
    const [owner, other] = await Promise.all(beneficiaryIds.map(newSession));
    const notice = await prisma.notification.create({ data: {
      beneficiaryId: beneficiaryIds[0], title: "Claim recorded", message: "Saved assistance update",
      titleBs: "Narekord ang claim", messageBs: "Natipig nga update sa ayuda", notificationType: "claim",
      sentAt: new Date(Date.now() - 1000),
    } });
    const hidden = await Promise.all([
      { channel: "sms" }, { status: "queued" }, { sentAt: new Date(Date.now() + 3_600_000) },
    ].map((fields) => prisma.notification.create({ data: {
      beneficiaryId: beneficiaryIds[0], title: "Not in inbox", message: "Hidden delivery",
      notificationType: "schedule", ...fields,
    } })));
    assert.equal((await call(path)).status, 401);
    assert.equal((await call(`${path}/${notice.notificationId}/read`, undefined, "PATCH")).status, 401);
    assert.deepEqual((await (await call(path, other)).json()).data, []);
    assert.equal((await call(`${path}/${notice.notificationId}/read`, other, "PATCH")).status, 404);
    for (const item of hidden) {
      assert.equal((await call(`${path}/${item.notificationId}/read`, owner, "PATCH")).status, 404);
    }
    assert.equal((await call(`${path}/invalid/read`, owner, "PATCH")).status, 422);
    assert.equal((await call(`${path}/${randomUUID()}/read`, owner, "PATCH")).status, 404);

    const inbox = (await (await call(path, owner)).json()).data;
    assert.equal(inbox.length, 1);
    assert.equal(inbox[0].id, notice.notificationId);
    assert.equal(inbox[0].titleBs, "Narekord ang claim");
    assert.equal(inbox[0].readAt, null); // GET does not mark messages as read.
    assert.equal("beneficiaryId" in inbox[0], false);
    const readPath = `${path}/${notice.notificationId}/read`;
    const firstRead = (await (await call(readPath, owner, "PATCH")).json()).data;
    assert.ok(firstRead.readAt);
    const repeated = await Promise.all([call(readPath, owner, "PATCH"), call(readPath, owner, "PATCH")]);
    for (const response of repeated) assert.equal((await response.json()).data.readAt, firstRead.readAt);
    assert.equal((await call("/auth/logout", owner, "POST")).status, 204);
    assert.equal((await call(path, owner)).status, 401);
    const nextSession = await newSession(beneficiaryIds[0]);
    const restored = (await (await call(path, nextSession)).json()).data;
    assert.equal(restored[0].readAt, firstRead.readAt);
    assert.deepEqual((await (await call(path, other)).json()).data, []);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await prisma.beneficiary.deleteMany({ where: { beneficiaryId: { in: beneficiaryIds } } });
    await prisma.barangay.deleteMany({ where: { barangayId } });
    await prisma.$disconnect();
  }
});
