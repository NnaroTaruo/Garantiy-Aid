import { ApiError } from "./errors.ts";
import { normalizePhilippinePhone } from "./security.ts";

type RegistrationInput = {
  firstName: string;
  middleName: string | null;
  lastName: string;
  birthDate: Date;
  sex: "female" | "male" | "prefer_not_to_say";
  address: string;
  barangayId: string;
  contactNumber: string;
};

function bodyRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "INVALID_BODY", "Request body must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

function text(body: Record<string, unknown>, field: string, max: number): string {
  const value = body[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(422, "VALIDATION_ERROR", "Please correct the highlighted fields.", {
      [field]: "This field is required.",
    });
  }
  const cleaned = value.trim();
  if (cleaned.length > max) {
    throw new ApiError(422, "VALIDATION_ERROR", "Please correct the highlighted fields.", {
      [field]: `Must be ${max} characters or fewer.`,
    });
  }
  return cleaned;
}

function optionalText(body: Record<string, unknown>, field: string, max: number): string | null {
  const value = body[field];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max) {
    throw new ApiError(422, "VALIDATION_ERROR", "Please correct the highlighted fields.", {
      [field]: `Must be ${max} characters or fewer.`,
    });
  }
  return value.trim() || null;
}

function dateOnly(value: unknown): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(422, "VALIDATION_ERROR", "Please correct the highlighted fields.", {
      birthDate: "Use YYYY-MM-DD format.",
    });
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ApiError(422, "VALIDATION_ERROR", "Please correct the highlighted fields.", {
      birthDate: "Enter a valid date.",
    });
  }
  return date;
}

export function uuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApiError(422, "VALIDATION_ERROR", "Please correct the highlighted fields.", {
      [field]: "Enter a valid ID.",
    });
  }
  return value;
}

export function parseRegistration(value: unknown): RegistrationInput {
  const body = bodyRecord(value);
  const sexInput = typeof body.sex === "string" ? body.sex.trim().toLowerCase().replaceAll(" ", "_") : "";
  if (sexInput !== "female" && sexInput !== "male" && sexInput !== "prefer_not_to_say") {
    throw new ApiError(422, "VALIDATION_ERROR", "Please correct the highlighted fields.", {
      sex: "Choose female, male, or prefer not to say.",
    });
  }
  const contactNumber = normalizePhilippinePhone(String(body.contactNumber ?? ""));
  if (!contactNumber) {
    throw new ApiError(422, "VALIDATION_ERROR", "Please correct the highlighted fields.", {
      contactNumber: "Enter a valid Philippine mobile number.",
    });
  }
  const address = text(body, "address", 500);
  if (address.length < 5) {
    throw new ApiError(422, "VALIDATION_ERROR", "Please correct the highlighted fields.", {
      address: "Enter a complete address.",
    });
  }
  return {
    firstName: text(body, "firstName", 100),
    middleName: optionalText(body, "middleName", 100),
    lastName: text(body, "lastName", 100),
    birthDate: dateOnly(body.birthDate),
    sex: sexInput,
    address,
    barangayId: uuid(body.barangayId, "barangayId"),
    contactNumber,
  };
}

export function parseOtpRequest(value: unknown): { contactNumber: string; purpose: "register" | "login" } {
  const body = bodyRecord(value);
  const contactNumber = normalizePhilippinePhone(String(body.contactNumber ?? ""));
  if (!contactNumber) throw new ApiError(422, "INVALID_PHONE", "Enter a valid Philippine mobile number.");
  const purpose = body.purpose === undefined ? "login" : body.purpose;
  if (purpose !== "register" && purpose !== "login") {
    throw new ApiError(422, "INVALID_PURPOSE", "Purpose must be register or login.");
  }
  return { contactNumber, purpose };
}

export function parseOtpVerification(value: unknown): {
  contactNumber: string;
  purpose: "register" | "login";
  code: string;
} {
  const body = bodyRecord(value);
  const request = parseOtpRequest(body);
  if (typeof body.code !== "string" || !/^\d{6}$/.test(body.code)) {
    throw new ApiError(422, "INVALID_OTP", "Enter the six-digit verification code.");
  }
  return { ...request, code: body.code };
}
