import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  ApiRequestError,
  getBeneficiaryOverview,
  getCurrentBeneficiary,
  getWalletOverview,
  getNotifications,
  markNotificationRead,
  updateProfile,
  getDocuments,
  uploadDocument,
  type Beneficiary,
  type BeneficiaryOverview,
  type WalletOverview,
  type BeneficiaryNotification,
  type ProfileUpdate,
  type BeneficiaryDocument,
  type DocumentType,
} from './api';
import type { DocumentPickerAsset } from 'expo-document-picker';
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
  saveProfile: (input: ProfileUpdate) => Promise<Beneficiary | null>;
  documents: BeneficiaryDocument[] | null;
  documentsLoading: boolean;
  documentsError: boolean;
  refreshDocuments: () => Promise<void>;
  submitDocument: (file: DocumentPickerAsset, docType: DocumentType) => Promise<BeneficiaryDocument | null>;
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
  notifications: BeneficiaryNotification[];
  notificationsLoading: boolean;
  notificationsError: boolean;
  refreshNotifications: () => Promise<void>;
  markRead: (id: string) => Promise<boolean>;
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
  const [notifications, setNotifications] = useState<BeneficiaryNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState(false);
  const sessionVersion = useRef(0);
  const renderedSessionVersion = sessionVersion.current;
  const [documents, setDocuments] = useState<BeneficiaryDocument[] | null>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState(false);
  const documentRequest = useRef(0);
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
    setNotifications([]);
    setNotificationsLoading(false);
    setNotificationsError(false);
    setDocuments(null);
    setDocumentsLoading(false);
    setDocumentsError(false);
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
  const saveProfile = async (input: ProfileUpdate) => {
    const version = renderedSessionVersion;
    if (!accessToken || version !== sessionVersion.current) return null;
    try {
      const updated = await updateProfile(accessToken, input);
      if (version !== sessionVersion.current) return null;
      applyBeneficiary(updated);
      return updated;
    } catch (error) {
      if (version !== sessionVersion.current) return null;
      if (error instanceof ApiRequestError && error.status === 401) {
        await reset();
        return null;
      }
      throw error;
    }
  };
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
  const loadNotifications = async (token: string, version: number) => {
    if (!token || version !== sessionVersion.current) return;
    setNotificationsLoading(true);
    setNotificationsError(false);
    try {
      const nextNotifications = await getNotifications(token);
      if (version === sessionVersion.current) {
        // A refresh started before a successful read must not make it unread again.
        setNotifications((previous) => {
          const readTimes = new Map(previous.map((notice) => [notice.id, notice.readAt]));
          return nextNotifications.map((notice) => ({ ...notice, readAt: notice.readAt ?? readTimes.get(notice.id) ?? null }));
        });
      }
    } catch (error) {
      if (version !== sessionVersion.current) return;
      if (error instanceof ApiRequestError && error.status === 401) await reset();
      else setNotificationsError(true);
    } finally {
      if (version === sessionVersion.current) setNotificationsLoading(false);
    }
  };
  const markRead = async (id: string) => {
    const version = renderedSessionVersion;
    if (!accessToken || version !== sessionVersion.current) return false;
    try {
      const saved = await markNotificationRead(accessToken, id);
      if (version !== sessionVersion.current) return false;
      setNotifications((previous) => previous.map((notice) =>
        notice.id === saved.id ? { ...notice, readAt: saved.readAt } : notice,
      ));
      return true;
    } catch (error) {
      if (version === sessionVersion.current && error instanceof ApiRequestError && error.status === 401) {
        await reset();
      }
      return false;
    }
  };
  const loadDocuments = async (token: string, version: number) => {
    if (!token || version !== sessionVersion.current) return;
    const request = ++documentRequest.current;
    setDocumentsLoading(true);
    setDocumentsError(false);
    try {
      const next = await getDocuments(token);
      if (version === sessionVersion.current && request === documentRequest.current) setDocuments(next);
    } catch (error) {
      if (version !== sessionVersion.current || request !== documentRequest.current) return;
      if (error instanceof ApiRequestError && error.status === 401) await reset();
      else setDocumentsError(true);
    } finally {
      if (version === sessionVersion.current && request === documentRequest.current) setDocumentsLoading(false);
    }
  };
  const submitDocument = async (file: DocumentPickerAsset, docType: DocumentType) => {
    const version = renderedSessionVersion;
    if (!accessToken || version !== sessionVersion.current) return null;
    try {
      const saved = await uploadDocument(accessToken, file, docType);
      if (version !== sessionVersion.current) return null;
      setDocuments((previous) => [saved, ...(previous ?? []).filter((item) => item.id !== saved.id)]);
      // A newer list request prevents an older pre-upload response hiding the saved document.
      void loadDocuments(accessToken, version);
      return saved;
    } catch (error) {
      if (version !== sessionVersion.current) return null;
      if (error instanceof ApiRequestError && error.status === 401) {
        await reset();
        return null;
      }
      throw error;
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
      await Promise.all([loadOverview(token, version), loadWallet(token, version), loadNotifications(token, version)]);
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
    setNotifications([]);
    setNotificationsLoading(false);
    setNotificationsError(false);
    setDocuments(null);
    setDocumentsLoading(false);
    setDocumentsError(false);
    await storeToken(token);
    if (version !== sessionVersion.current) return;
    setAccessToken(token);
    setAuthLoading(false);
    setAuthError(false);
    applyBeneficiary(beneficiary);
    await Promise.all([loadOverview(token, version), loadWallet(token, version), loadNotifications(token, version)]);
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
        saveProfile,
        documents,
        documentsLoading,
        documentsError,
        refreshDocuments: () => loadDocuments(accessToken, renderedSessionVersion),
        submitDocument,
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
        notifications,
        notificationsLoading,
        notificationsError,
        refreshNotifications: () => loadNotifications(accessToken, renderedSessionVersion),
        markRead,
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
export const peso = (amount: number) =>
  `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
