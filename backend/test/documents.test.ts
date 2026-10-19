import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { ApiError } from "../src/errors.ts";
import { MAX_DOCUMENT_BYTES, documentStoragePath, parseDocumentUpload } from "../src/documents.ts";

test("document validation bounds file size, signatures, names, and categories", () => {
  const pdf = Buffer.from("%PDF-1.4\nTest document\n%%EOF");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0ZkAAAAASUVORK5CYII=", "base64");
  const jpeg = Buffer.from([255, 216, 255, 224, 0, 2, 255, 217]);
  const parsed = parseDocumentUpload("application/pdf", encodeURIComponent("Cebu ñ sample.PDF"), "proof_of_residency", pdf);
  assert.equal(parsed.originalName, "Cebu ñ sample.PDF");
  assert.equal(parsed.extension, ".pdf");
  assert.equal(parseDocumentUpload("image/png", "test.png", "valid_id", png).mimeType, "image/png");
  assert.equal(parseDocumentUpload("image/jpeg", "test.jpeg", "other", jpeg).extension, ".jpg");
  const boundary = Buffer.alloc(MAX_DOCUMENT_BYTES);
  pdf.copy(boundary);
  assert.equal(parseDocumentUpload("application/pdf", "test.pdf", "other", boundary).bytes.length, MAX_DOCUMENT_BYTES);
  for (const input of [
    ["application/pdf", "test.pdf", "other", Buffer.alloc(0)],
    ["application/pdf", "test.pdf", "other", Buffer.alloc(MAX_DOCUMENT_BYTES + 1)],
    ["application/pdf", "test.pdf", "other", Buffer.from("not a PDF")],
    ["image/png", "test.png", "other", pdf],
    ["image/jpeg", "test.jpg", "other", png],
    ["application/pdf", "test.png", "other", pdf],
    ["application/pdf", "../test.pdf", "other", pdf],
    ["application/pdf", "C%3A%5Ctest.pdf", "other", pdf],
    ["application/pdf", "bad%00.pdf", "other", pdf],
    ["application/pdf", "bad%0D%0A.pdf", "other", pdf],
    ["application/pdf", "%broken.pdf", "other", pdf],
    ["application/pdf", `${"a".repeat(252)}.pdf`, "other", pdf],
    ["text/html", "test.html", "other", pdf],
    ["application/pdf", "test.pdf", "approved", pdf],
  ] as const) assert.throws(() => parseDocumentUpload(input[0], input[1], input[2], input[3]), (error) => error instanceof ApiError);
  const key = "62f95c7d-68e7-4c3a-9ced-7fef670b8a3a.pdf";
  assert.equal(documentStoragePath("private-files", key), join("private-files", key));
  assert.throws(() => documentStoragePath("private-files", "../outside.pdf"), ApiError);
});
