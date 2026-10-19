import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  ApiRequestError,
  getBeneficiaryOverview,
  getCurrentBeneficiary,
  getWalletOverview,
  type Beneficiary,
  type BeneficiaryOverview,
  type WalletOverview,
} from './api';
import { clearStoredToken, getStoredToken, storeToken } from './session-storage';

type Language = 'en' | 'bs';
export type RegistrationInfo = {
  firstName: string;
  middleName: string;
  lastName: string;
  birthDate: string;
  sex: string;
  address: string;
  barangay: string;
  barangayId: string;
  city: string;
};
const emptyRegistration: RegistrationInfo = {
  firstName: '',
  middleName: '',
  lastName: '',
  birthDate: '',
  sex: '',
  address: '',
  barangay: '',
  barangayId: '',
  city: 'Cebu City',
};
type DemoState = {
  language: Language;
  setLanguage: (value: Language) => void;
  phone: string;
  setPhone: (value: string) => void;
  accessToken: string;
  beneficiary: Beneficiary | null;
  overview: BeneficiaryOverview | null;
  overviewLoading: boolean;
  overviewError: boolean;
  refreshOverview: () => Promise<void>;
  wallet: WalletOverview | null;
  walletLoading: boolean;
  walletError: boolean;
  refreshWallet: () => Promise<void>;
  authLoading: boolean;
  authError: boolean;
  startSession: (token: string, beneficiary: Beneficiary) => Promise<void>;
  restoreSession: () => Promise<void>;
  name: string;
  setName: (value: string) => void;
  registration: RegistrationInfo;
  setRegistration: (value: Partial<RegistrationInfo>) => void;
  faceEnrolled: boolean;
  setFaceEnrolled: (value: boolean) => void;
  consentGiven: boolean;
  setConsentGiven: (value: boolean) => void;
  readNotifications: string[];
  markRead: (id: string) => void;
  reset: () => Promise<void>;
  t: (english: string, bisaya: string) => string;
};
const Context = createContext<DemoState | null>(null);
export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');
  const [phone, setPhone] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null);
  const [overview, setOverview] = useState<BeneficiaryOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState(false);
  const [wallet, setWallet] = useState<WalletOverview | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [name, setName] = useState('Maria Santos');
  const [registration, setRegistrationState] =
    useState<RegistrationInfo>(emptyRegistration);
  const [faceEnrolled, setFaceEnrolled] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [readNotifications, setReadNotifications] = useState<string[]>([]);
  const sessionVersion = useRef(0);
  const renderedSessionVersion = sessionVersion.current;
  const reset = async () => {
    sessionVersion.current += 1;
    setPhone('');
    setAccessToken('');
    setBeneficiary(null);
    setOverview(null);
    setOverviewLoading(false);
    setOverviewError(false);
    setWallet(null);
    setWalletLoading(false);
    setWalletError(false);
    setAuthLoading(false);
    setAuthError(false);
    setName('Maria Santos');
    setRegistrationState(emptyRegistration);
    setFaceEnrolled(false);
    setConsentGiven(false);
    setReadNotifications([]);
    await clearStoredToken();
  };
  const applyBeneficiary = (beneficiary: Beneficiary) => {
    setBeneficiary(beneficiary);
    setPhone(beneficiary.contactNumber.replace(/^\+63/, ''));
    setName(
      [beneficiary.firstName, beneficiary.middleName, beneficiary.lastName]
        .filter(Boolean)
        .join(' '),
    );
  };
  // Ignore responses from sessions that were logged out or replaced.
  const loadOverview = async (token: string, version: number) => {
    if (!token || version !== sessionVersion.current) return;
    setOverviewLoading(true);
    setOverviewError(false);
    try {
      const nextOverview = await getBeneficiaryOverview(token);
      if (version === sessionVersion.current) setOverview(nextOverview);
    } catch (error) {
      if (version !== sessionVersion.current) return;
      if (error instanceof ApiRequestError && error.status === 401) {
        await reset();
      } else {
        setOverviewError(true);
      }
    } finally {
      if (version === sessionVersion.current) setOverviewLoading(false);
    }
  };
  const loadWallet = async (token: string, version: number) => {
    if (!token || version !== sessionVersion.current) return;
    setWalletLoading(true);
    setWalletError(false);
    try {
      const nextWallet = await getWalletOverview(token);
      if (version === sessionVersion.current) setWallet(nextWallet);
    } catch (error) {
      if (version !== sessionVersion.current) return;
      if (error instanceof ApiRequestError && error.status === 401) {
        await reset();
      } else {
        setWalletError(true);
      }
    } finally {
      if (version === sessionVersion.current) setWalletLoading(false);
    }
  };
  const restoreSession = async () => {
    const version = ++sessionVersion.current;
    setAuthLoading(true);
    setAuthError(false);
    try {
      const token = await getStoredToken();
      if (version !== sessionVersion.current) return;
      if (!token) {
        await reset();
        return;
      }
      const beneficiary = await getCurrentBeneficiary(token);
      if (version !== sessionVersion.current) return;
      setAccessToken(token);
      applyBeneficiary(beneficiary);
      await Promise.all([loadOverview(token, version), loadWallet(token, version)]);
    } catch (error) {
      if (version !== sessionVersion.current) return;
      if (error instanceof ApiRequestError && error.status === 401) {
        await reset();
      } else {
        setAuthError(true);
      }
    } finally {
      if (version === sessionVersion.current) setAuthLoading(false);
    }
  };
  useEffect(() => {
    void restoreSession();
    return () => { sessionVersion.current += 1; };
  }, []);
  const startSession = async (token: string, beneficiary: Beneficiary) => {
    const version = ++sessionVersion.current;
    setOverview(null);
    setOverviewLoading(false);
    setOverviewError(false);
    setWallet(null);
    setWalletLoading(false);
    setWalletError(false);
    await storeToken(token);
    if (version !== sessionVersion.current) return;
    setAccessToken(token);
    setAuthLoading(false);
    setAuthError(false);
    applyBeneficiary(beneficiary);
    await Promise.all([loadOverview(token, version), loadWallet(token, version)]);
  };
  return (
    <Context.Provider
      value={{
        language,
        setLanguage,
        phone,
        setPhone,
        accessToken,
        beneficiary,
        overview,
        overviewLoading,
        overviewError,
        refreshOverview: () => loadOverview(accessToken, renderedSessionVersion),
        wallet,
        walletLoading,
        walletError,
        refreshWallet: () => loadWallet(accessToken, renderedSessionVersion),
        authLoading,
        authError,
        startSession,
        restoreSession,
        name,
        setName,
        registration,
        setRegistration: (value) =>
          setRegistrationState((previous) => ({ ...previous, ...value })),
        faceEnrolled,
        setFaceEnrolled,
        consentGiven,
        setConsentGiven,
        readNotifications,
        markRead: (id) =>
          setReadNotifications((previous) =>
            previous.includes(id) ? previous : [...previous, id],
          ),
        reset,
        t: (en, bs) => (language === 'en' ? en : bs),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useDemo() {
  const state = useContext(Context);
  if (!state) throw new Error('DemoProvider is required');
  return state;
}

// Synthetic display data for screens that are still explicitly labeled as previews.
export const appointment = {
  program: '4Ps — Pantawid Pamilya',
  date: 'Thursday, July 10, 2025',
  dateBisaya: 'Huwebes, Hulyo 10, 2025',
  time: '9:00 AM – 10:00 AM',
  queue: '#047',
  venue: 'Barangay Punta Princesa Hall',
  amount: 1500,
  reference: 'GAI-2025-0612-047',
};
export const notices = [
  {
    id: 'schedule',
    title: 'Claiming schedule confirmed',
    titleBs: 'Nakumpirma ang iskedyul',
    body: 'Your slot: July 10, 9:00–10:00 AM, Queue #047. Punta Princesa Hall.',
    bodyBs: 'Imong oras: Hulyo 10, 9:00–10:00 AM, Pila #047. Punta Princesa Hall.',
    date: 'July 2, 2025 · 10:00 AM',
    kind: 'schedule',
  },
  {
    id: 'reminder',
    title: 'Reminder: Claim this week',
    titleBs: 'Pahinumdom: Claim karong semanaha',
    body: 'Your claiming window is July 10, 9:00–10:00 AM. Don’t forget your QR pass.',
    bodyBs: 'Imong pag-claim kay Hulyo 10, 9:00–10:00 AM. Ayaw kalimti ang QR pass.',
    date: 'July 8, 2025 · 8:00 AM',
    kind: 'reminder',
  },
  {
    id: 'account',
    title: 'Account verified',
    titleBs: 'Naverify ang account',
    body: 'Welcome to GarantiyAid, Maria. Your registration is complete.',
    bodyBs: 'Maayong pag-abot sa GarantiyAid, Maria. Nahuman na ang pagparehistro.',
    date: 'May 20, 2025 · 2:30 PM',
    kind: 'account',
  },
];
export const peso = (amount: number) =>
  `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
