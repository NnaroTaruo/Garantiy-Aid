import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readdir, readFile, rmdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { app } from "../src/app.ts";
import { config } from "../src/config.ts";
import { prisma } from "../src/db.ts";
import { createSessionToken, hashSecret } from "../src/security.ts";
import { MAX_DOCUMENT_BYTES } from "../src/documents.ts";

test("private document uploads persist, deduplicate retries, and enforce ownership", async () => {
  const directory = await mkdtemp(join(tmpdir(), "garantiyaid-documents-test-"));
  const originalStorage = config.documentStorageDir;
  config.documentStorageDir = directory;
  const beneficiaryIds = [randomUUID(), randomUUID()];
  const barangayId = randomUUID();
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const path = "/beneficiaries/me/documents";
  const pdf = Buffer.from("%PDF-1.4\nSynthetic integration test, no personal data.\n%%EOF");
  const call = (url: string, token?: string, init: RequestInit = {}) => fetch(baseUrl + url, {
    ...init, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  const upload = (token?: string, extra: Record<string, string> = {}, body = pdf) => call(path, token, {
    method: "POST", body, headers: { "Content-Type": "application/pdf", "X-File-Name": encodeURIComponent("Test ñ record.pdf"), "X-Document-Type": "proof_of_residency", ...extra },
  });
  const newSession = async (beneficiaryId: string) => {
    const token = createSessionToken();
    await prisma.authSession.create({ data: {
      beneficiaryId, tokenHash: hashSecret(token, "session", config.authPepper), expiresAt: new Date(Date.now() + 60_000),
    } });
    return token;
  };
  try {
    await prisma.barangay.create({ data: { barangayId, barangayCode: `TEST-${barangayId.slice(0, 8)}`, barangayName: "Documents test", city: "Test", province: "Test" } });
    for (const beneficiaryId of beneficiaryIds) await prisma.beneficiary.create({ data: {
      beneficiaryId, barangayId, firstName: "Document", lastName: "Test", contactNumber: `+639${randomInt(100_000_000, 1_000_000_000)}`,
      birthDate: new Date("1990-01-01T00:00:00Z"), sex: "female", address: "12 Test Street", isVerified: true, status: "active",
    } });
    const [owner, other] = await Promise.all(beneficiaryIds.map(newSession));
    assert.equal((await call(path)).status, 401);
    assert.equal((await upload()).status, 401);
    assert.deepEqual(await readdir(directory), []);
    const preflight = await call(path, undefined, { method: "OPTIONS", headers: { Origin: "http://127.0.0.1:8765", "Access-Control-Request-Method": "POST" } });
    assert.ok(preflight.headers.get("Access-Control-Allow-Headers")?.includes("X-File-Name"));
    assert.equal((await upload(owner, { "Content-Type": "text/plain" })).status, 415);
    assert.equal((await upload(owner, { "X-File-Name": "..%2Foutside.pdf" })).status, 422);
    assert.equal((await upload(owner, { "X-Document-Type": "approved" })).status, 422);
    assert.equal((await upload(owner, {}, Buffer.from("not a PDF"))).status, 415);
    assert.equal((await upload(owner, {}, Buffer.alloc(0))).status, 422);
    const large = await upload(owner, {}, Buffer.alloc(MAX_DOCUMENT_BYTES + 1));
    assert.equal(large.status, 413);
    assert.equal((await large.json()).error.code, "PAYLOAD_TOO_LARGE");
    assert.deepEqual(await readdir(directory), []);

    const first = await upload(owner);
    assert.equal(first.status, 201);
    const saved = (await first.json()).data;
    assert.equal(saved.originalName, "Test ñ record.pdf");
    assert.equal(saved.sizeBytes, pdf.length);
    assert.equal(saved.status, "received");
    for (const field of ["filePath", "contentHash", "beneficiaryId"]) assert.equal(field in saved, false);
    const repeated = await Promise.all([upload(owner), upload(owner)]);
    for (const result of repeated) {
      assert.equal(result.status, 200);
      assert.equal((await result.json()).data.id, saved.id);
    }
    assert.equal((await readdir(directory)).length, 1);
    assert.deepEqual(await readFile(join(directory, (await readdir(directory))[0])), pdf);
    const concurrent = await Promise.all([
      upload(owner, { "X-Document-Type": "other" }), upload(owner, { "X-Document-Type": "other" }),
    ]);
    assert.deepEqual(concurrent.map((result) => result.status).sort(), [200, 201]);
    assert.equal((await concurrent[0].json()).data.id, (await concurrent[1].json()).data.id);
    assert.equal((await readdir(directory)).length, 2);
    const contentPath = `${path}/${saved.id}/content`;
    assert.equal((await call(contentPath)).status, 401);
    assert.equal((await call(contentPath, other)).status, 404);
    assert.equal((await call(`${path}/invalid/content`, owner)).status, 422);
    const content = await call(contentPath, owner);
    assert.equal(content.status, 200);
    assert.ok(content.headers.get("Content-Disposition")?.startsWith("attachment;"));
    assert.equal(content.headers.get("Cache-Control"), "private, no-store");
    assert.equal(content.headers.get("X-Content-Type-Options"), "nosniff");
    assert.deepEqual(Buffer.from(await content.arrayBuffer()), pdf);
    assert.deepEqual((await (await call(path, other)).json()).data, []);
    const second = (await (await upload(other, { "X-Beneficiary-Id": beneficiaryIds[0] })).json()).data;
    assert.notEqual(second.id, saved.id);
    assert.equal((await call(`${path}/${second.id}/content`, owner)).status, 404);
    assert.equal((await (await call(path, owner)).json()).data.length, 2);
    assert.equal((await call(`/storage/documents/${saved.id}.pdf`)).status, 404);
    assert.equal((await call("/auth/logout", owner, { method: "POST" })).status, 204);
    assert.equal((await upload(owner)).status, 401);
    const nextToken = await newSession(beneficiaryIds[0]);
    assert.ok((await (await call(path, nextToken)).json()).data.some((item: { id: string }) => item.id === saved.id));
    assert.equal((await call(contentPath, nextToken)).status, 200);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await prisma.beneficiary.deleteMany({ where: { beneficiaryId: { in: beneficiaryIds } } });
    await prisma.barangay.deleteMany({ where: { barangayId } });
    await prisma.$disconnect();
    for (const name of await readdir(directory)) await unlink(join(directory, name));
    await rmdir(directory);
    config.documentStorageDir = originalStorage;
  }
});
