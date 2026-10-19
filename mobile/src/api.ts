import { Platform } from 'react-native';
import type { DocumentPickerAsset } from 'expo-document-picker';

const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
export const API_URL =
  configuredUrl ?? (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://127.0.0.1:3000');

export class ApiRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 10_000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      signal: controller.signal,
    });
    const body = response.status === 204 ? null : await response.json();
    if (!response.ok) {
      throw new ApiRequestError(
        body?.error?.code ?? 'REQUEST_FAILED',
        body?.error?.message ?? 'The request could not be completed.',
        response.status,
        body?.error?.fields,
      );
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError(
      'NETWORK_ERROR',
      'Cannot reach the GarantiyAid server. Check the API address and try again.',
    );
  } finally {
    clearTimeout(timeout);
  }
}

export type Barangay = {
  id: string;
  barangayCode: string;
  barangayName: string;
  city: string;
  province: string;
};

export type Beneficiary = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  birthDate: string;
  sex: string;
  address: string;
  barangayId: string;
  contactNumber: string;
  isVerified: boolean;
  status: string;
};

export type ProfileUpdate = Pick<Beneficiary, 'firstName' | 'middleName' | 'lastName' | 'address' | 'barangayId'>;

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export type DocumentType = 'proof_of_residency' | 'valid_id' | 'other';
export type BeneficiaryDocument = {
  id: string;
  docType: DocumentType;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  createdAt: string;
};

export type ProgramEnrollment = {
  id: string;
  enrollmentDate: string;
  status: string;
  program: {
    id: string;
    code: string;
    name: string;
    type: string;
    description: string | null;
    grantAmount: number;
  };
};

export type ClaimingSchedule = {
  id: string;
  distributionId: string;
  title: string;
  date: string;
  slotStart: string;
  slotEnd: string;
  queueNumber: number;
  location: string;
  status: string;
  program: {
    id: string;
    code: string;
    name: string;
    grantAmount: number;
  };
};

export type BeneficiaryOverview = {
  enrollments: ProgramEnrollment[];
  nextSchedule: ClaimingSchedule | null;
};

export type ClaimPass = {
  id: string;
  claimCode: string;
  status: string;
  issuedAt: string;
  expiresAt: string;
  schedule: {
    id: string;
    distributionId: string;
    date: string;
    slotStart: string;
    slotEnd: string;
    queueNumber: number;
    location: string;
    program: {
      id: string;
      code: string;
      name: string;
    };
  };
};

export type ClaimRecord = {
  id: string;
  distributionId: string;
  scheduleId: string;
  status: string;
  verificationMethod: string | null;
  claimedAt: string | null;
  createdAt: string;
  date: string;
  amount: number;
  program: { id: string; code: string; name: string };
};

export type CurrentClaim = {
  id: string | null;
  distributionId: string;
  scheduleId: string;
  status: string;
  verificationMethod: string | null;
  claimedAt: string | null;
  date: string;
  queueNumber: number;
  location: string;
  amount: number;
  program: { id: string; code: string; name: string };
};

export type WalletTransaction = {
  id: string;
  claimId: string;
  amount: number;
  type: string;
  reference: string;
  status: string;
  createdAt: string;
  claimStatus: string;
  claimedAt: string | null;
  date: string;
  program: { id: string; code: string; name: string };
};

export type WalletOverview = {
  wallet: {
    id: string;
    balance: number;
    currency: string;
    status: string;
    lastTransactionAt: string | null;
  } | null;
  currentClaim: CurrentClaim | null;
  claims: ClaimRecord[];
  transactions: WalletTransaction[];
};

type OtpResponse = { data: { expiresInSeconds?: number; developmentOtp?: string } };

export type BeneficiaryNotification = {
  id: string;
  scheduleId: string | null;
  title: string;
  titleBs: string | null;
  message: string;
  messageBs: string | null;
  notificationType: string;
  sentAt: string;
  readAt: string | null;
};

export async function getBarangays() {
  return (await request<{ data: Barangay[] }>('/barangays')).data;
}

export async function registerBeneficiary(input: {
  firstName: string;
  middleName: string;
  lastName: string;
  birthDate: string;
  sex: string;
  address: string;
  barangayId: string;
  contactNumber: string;
}) {
  return (
    await request<{
      data: { beneficiary: Beneficiary; verificationRequired: boolean; developmentOtp?: string };
    }>('/auth/register', { method: 'POST', body: JSON.stringify(input) })
  ).data;
}

export async function requestOtp(contactNumber: string, purpose: 'register' | 'login') {
  return (
    await request<OtpResponse>('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ contactNumber, purpose }),
    })
  ).data;
}

export async function verifyOtp(
  contactNumber: string,
  purpose: 'register' | 'login',
  code: string,
) {
  return (
    await request<{
      data: {
        accessToken: string;
        tokenType: 'Bearer';
        expiresAt: string;
        beneficiary: Beneficiary;
      };
    }>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ contactNumber, purpose, code }),
    })
  ).data;
}

export async function logout(accessToken: string) {
  await request<null>('/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function getCurrentBeneficiary(accessToken: string) {
  return (
    await request<{ data: Beneficiary }>('/beneficiaries/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  ).data;
}

export async function updateProfile(accessToken: string, input: ProfileUpdate) {
  return (
    await request<{ data: Beneficiary }>('/beneficiaries/me', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(input),
    })
  ).data;
}

export async function getBeneficiaryOverview(accessToken: string) {
  return (
    await request<{ data: BeneficiaryOverview }>('/beneficiaries/me/overview', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  ).data;
}

export async function issueClaimPass(accessToken: string) {
  return (
    await request<{ data: ClaimPass }>('/beneficiaries/me/claim-pass', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  ).data;
}

export async function getWalletOverview(accessToken: string) {
  return (
    await request<{ data: WalletOverview }>('/beneficiaries/me/wallet', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  ).data;
}

export async function getNotifications(accessToken: string) {
  return (
    await request<{ data: BeneficiaryNotification[] }>('/beneficiaries/me/notifications', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  ).data;
}

export async function markNotificationRead(accessToken: string, id: string) {
  return (
    await request<{ data: { id: string; readAt: string } }>(
      `/beneficiaries/me/notifications/${encodeURIComponent(id)}/read`,
      { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}` } },
    )
  ).data;
}

export async function getDocuments(accessToken: string) {
  return (await request<{ data: BeneficiaryDocument[] }>('/beneficiaries/me/documents', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })).data;
}

export async function uploadDocument(accessToken: string, asset: DocumentPickerAsset, docType: DocumentType) {
  const extension = /\.([a-z0-9]+)$/i.exec(asset.name)?.[1].toLowerCase();
  const mimeType = ({ pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' } as Record<string, string>)[extension ?? ''];
  if (!mimeType) throw new ApiRequestError('UNSUPPORTED_FILE_TYPE', 'Choose a PDF, JPEG, or PNG file.');
  if ((asset.size ?? 0) > MAX_DOCUMENT_BYTES) throw new ApiRequestError('DOCUMENT_TOO_LARGE', 'Choose a file up to 5 MB.');
  let contents: ArrayBuffer;
  try {
    const file = Platform.OS === 'web'
      ? asset.file ?? await (await fetch(asset.uri)).blob()
      : new (await import('expo-file-system')).File(asset.uri);
    if (file.size > MAX_DOCUMENT_BYTES) throw new ApiRequestError('DOCUMENT_TOO_LARGE', 'Choose a file up to 5 MB.');
    if (file.size === 0) throw new ApiRequestError('EMPTY_DOCUMENT', 'Choose a non-empty file.');
    // Send bytes so native Blob handling cannot override the validated MIME header.
    contents = await file.arrayBuffer();
    if (contents.byteLength > MAX_DOCUMENT_BYTES) throw new ApiRequestError('DOCUMENT_TOO_LARGE', 'Choose a file up to 5 MB.');
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError('FILE_UNREADABLE', 'Choose the file again; it could not be read.');
  }
  return (await request<{ data: BeneficiaryDocument }>('/beneficiaries/me/documents', {
    method: 'POST', body: contents,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': mimeType,
      'X-File-Name': encodeURIComponent(asset.name), 'X-Document-Type': docType },
  }, 60_000)).data;
}
