import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import { app } from "../src/app.ts";
import { config } from "../src/config.ts";
import { prisma } from "../src/db.ts";
import { createSessionToken, hashSecret } from "../src/security.ts";

test("profile updates are scoped, validated, and persist across sessions", async () => {
  const beneficiaryIds = [randomUUID(), randomUUID()];
  const barangayIds = [randomUUID(), randomUUID(), randomUUID()];
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const call = (token?: string, input?: unknown, path = "/beneficiaries/me", method = input === undefined ? "GET" : "PATCH") =>
    fetch(`http://127.0.0.1:${address.port}${path}`, {
      method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
    });
  const newSession = async (beneficiaryId: string) => {
    const token = createSessionToken();
    await prisma.authSession.create({ data: {
      beneficiaryId, tokenHash: hashSecret(token, "session", config.authPepper),
      expiresAt: new Date(Date.now() + 60_000),
    } });
    return token;
  };
  try {
    for (const [index, barangayId] of barangayIds.entries()) {
      await prisma.barangay.create({ data: {
        barangayId, barangayCode: `TEST-${barangayId.slice(0, 8)}`, barangayName: `Profile test ${index}`,
        city: "Test", province: "Test", isActive: index !== 2,
      } });
    }
    for (const beneficiaryId of beneficiaryIds) {
      await prisma.beneficiary.create({ data: {
        beneficiaryId, barangayId: barangayIds[0], firstName: "Profile", middleName: "Test", lastName: "Owner",
        contactNumber: `+639${randomInt(100_000_000, 1_000_000_000)}`,
        birthDate: new Date("1990-01-01T00:00:00Z"), sex: "female", address: "12 Original Street",
        isVerified: true, status: "active",
      } });
    }
    const [owner, other] = await Promise.all(beneficiaryIds.map(newSession));
    const original = (await (await call(owner)).json()).data;
    assert.equal((await call(undefined, { address: "12 New Street" })).status, 401);
    for (const input of [
      { address: "12 New Street", beneficiaryId: beneficiaryIds[1] },
      { contactNumber: "+639000000001" }, { isVerified: false }, { status: "approved" }, { birthDate: "1991-01-01" },
    ]) assert.equal((await call(owner, input)).status, 422);
    assert.equal((await call(owner, { firstName: "123" })).status, 422);
    for (const barangayId of [barangayIds[2], randomUUID()]) {
      const invalid = await call(owner, { firstName: "Never Saved", barangayId });
      assert.equal(invalid.status, 422);
      assert.ok((await invalid.json()).error.fields.barangayId);
    }
    assert.equal((await (await call(owner)).json()).data.firstName, original.firstName);
    const response = await call(owner, {
      firstName: "  María-José ", middleName: "", lastName: "D’Cruz", address: "  24 New Street ", barangayId: barangayIds[1],
    });
    assert.equal(response.status, 200);
    const saved = (await response.json()).data;
    assert.equal(saved.id, beneficiaryIds[0]);
    assert.equal(saved.firstName, "María-José");
    assert.equal(saved.middleName, null);
    assert.equal(saved.address, "24 New Street");
    assert.equal(saved.barangayId, barangayIds[1]);
    for (const field of ["contactNumber", "birthDate", "sex", "isVerified", "status"]) assert.equal(saved[field], original[field]);
    assert.equal((await (await call(other)).json()).data.address, "12 Original Street");
    // An existing service area becoming inactive does not prevent name/address corrections.
    await prisma.barangay.update({ where: { barangayId: barangayIds[1] }, data: { isActive: false } });
    assert.equal((await call(owner, { barangayId: barangayIds[1], address: "26 New Street" })).status, 200);
    assert.equal((await call(owner, undefined, "/auth/logout", "POST")).status, 204);
    assert.equal((await call(owner, { address: "Should not save" })).status, 401);
    const nextSession = await newSession(beneficiaryIds[0]);
    const restored = (await (await call(nextSession)).json()).data;
    assert.equal(restored.firstName, saved.firstName);
    assert.equal(restored.middleName, null);
    assert.equal(restored.address, "26 New Street");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await prisma.beneficiary.deleteMany({ where: { beneficiaryId: { in: beneficiaryIds } } });
    await prisma.barangay.deleteMany({ where: { barangayId: { in: barangayIds } } });
    await prisma.$disconnect();
  }
});
