import { Platform } from 'react-native';

const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
export const API_URL =
  configuredUrl ?? (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://127.0.0.1:3000');

export class ApiRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
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
