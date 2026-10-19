import { extname, join } from "node:path";
import { ApiError } from "./errors.ts";

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const DOCUMENT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const documentTypes = ["proof_of_residency", "valid_id", "other"];

export function parseDocumentUpload(contentType: string, encodedName: string, docType: string, bytes: unknown) {
  const mimeType = contentType.split(";")[0].trim().toLowerCase();
  if (!DOCUMENT_MIME_TYPES.includes(mimeType)) throw new ApiError(415, "UNSUPPORTED_FILE_TYPE", "Choose a PDF, JPEG, or PNG file.");
  if (!documentTypes.includes(docType)) throw new ApiError(422, "INVALID_DOCUMENT_TYPE", "Choose a document category.");
  let originalName: string;
  try { originalName = decodeURIComponent(encodedName).trim(); }
  catch { throw new ApiError(422, "INVALID_FILE_NAME", "Choose a file with a valid name."); }
  if (!originalName || originalName.length > 255 || /[\x00-\x1f\x7f/\\]/.test(originalName)) {
    throw new ApiError(422, "INVALID_FILE_NAME", "Use a file name without folders or control characters, up to 255 characters.");
  }
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw new ApiError(422, "EMPTY_DOCUMENT", "The selected file is empty.");
  if (bytes.length > MAX_DOCUMENT_BYTES) throw new ApiError(413, "DOCUMENT_TOO_LARGE", "Choose a file up to 5 MB.");
  const extension = extname(originalName).toLowerCase();
  // ponytail: signature checks identify file types, not malware or document authenticity; add scanning before production intake.
  const valid = mimeType === "application/pdf"
    ? extension === ".pdf" && bytes.subarray(0, 5).toString("ascii") === "%PDF-"
    : mimeType === "image/png"
      ? extension === ".png" && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : [".jpg", ".jpeg"].includes(extension) && bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217;
  if (!valid) throw new ApiError(415, "FILE_TYPE_MISMATCH", "The file contents must match its PDF, JPEG, or PNG name and type.");
  return { originalName, docType, mimeType, bytes, extension: mimeType === "image/jpeg" ? ".jpg" : extension };
}

export function documentStoragePath(storageDir: string, key: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(pdf|png|jpg)$/.test(key)) {
    throw new ApiError(404, "DOCUMENT_UNAVAILABLE", "The document file is unavailable.");
  }
  return join(storageDir, key);
}
