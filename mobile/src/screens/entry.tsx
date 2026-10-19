import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  Check,
  CircleCheck,
  ContactRound,
  MapPin,
  ScanFace,
  ShieldCheck,
} from 'lucide-react-native';
import {
  Button,
  Card,
  Field,
  flow,
  Header,
  LanguageToggle,
  Logo,
  Notice,
  Page,
  PhoneField,
  styles,
  Txt,
} from '../components';
import { useDemo } from '../state';
import {
  ApiRequestError,
  getBarangays,
  registerBeneficiary,
  requestOtp,
  verifyOtp,
  type Barangay,
} from '../api';
import { colors as c, fonts } from '../theme';

export function Onboarding() {
  const { t } = useDemo();
  return (
    <Page
      header={false}
      footer={
        <>
          <Button onPress={() => flow('account-info')}>
            {t('Create Account', 'Paghimo og Account')}
          </Button>
          <View style={[styles.row, { justifyContent: 'center', gap: 4 }]}>
            <Txt variant="small">
              {t('Already have an account?', 'Naa na kay account?')}
            </Txt>
            <Pressable
              accessibilityRole="button"
              onPress={() => flow('login')}
              style={s.textLink}
            >
              <Txt variant="small" style={{ color: c.primary, fontFamily: fonts.bold }}>
                {t('Log in', 'Log in')}
              </Txt>
            </Pressable>
          </View>
        </>
      }
    >
      <View style={{ alignItems: 'flex-end' }}>
        <LanguageToggle full />
      </View>
      <View style={s.welcomeHero}>
        <Logo size={56} halo />
        <Txt variant="title" style={{ textAlign: 'center' }}>
          {t('Welcome to\nGarantiyAid', 'Maayong pag-abot sa\nGarantiyAid')}
        </Txt>
        <Txt style={s.centerMuted}>
          {t(
            'A safer, easier way to view your schedule and claim your government assistance.',
            'Mas luwas ug sayon nga paagi sa pagtan-aw sa iskedyul ug pag-claim sa imong ayuda.',
          )}
        </Txt>
      </View>
      <View style={s.features}>
        {[
          {
            Icon: CalendarDays,
            title: t('Know your schedule', 'Hibaloi imong iskedyul'),
            body: t(
              'Get exact dates and times to avoid long lines.',
              'Hibaloi ang petsa ug oras aron malikayan ang taas nga pila.',
            ),
            bg: c.primarySoft,
            color: c.primary,
          },
          {
            Icon: ShieldCheck,
            title: t('Claim safely', 'Luwas nga pag-claim'),
            body: t(
              'Verify your identity for a secure process.',
              'Iverify ang imong pagkatawo alang sa luwas nga proseso.',
            ),
            bg: c.greenSoft,
            color: c.green,
          },
        ].map(({ Icon, title, body, bg, color }) => (
          <View key={title} style={[styles.row, { alignItems: 'flex-start' }]}>
            <View style={[s.featureIcon, { backgroundColor: bg }]}>
              <Icon size={20} color={color} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Txt variant="label">{title}</Txt>
              <Txt variant="small">{body}</Txt>
            </View>
          </View>
        ))}
      </View>
    </Page>
  );
}

function Progress({ step, total }: { step: number; total: number }) {
  const { t } = useDemo();
  return (
    <View style={s.progressWrap}>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Txt variant="small" style={{ color: c.primary, fontFamily: fonts.semibold }}>
          {t(`Step ${step} of ${total}`, `Lakang ${step} sa ${total}`)}
        </Txt>
        <Txt variant="small">{Math.round((step / total) * 100)}%</Txt>
      </View>
      <View style={s.progressTrack}>
        <View
          style={[s.progressFill, { width: `${(step / total) * 100}%` as `${number}%` }]}
        />
      </View>
    </View>
  );
}

const formatBirthDate = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const isValidBirthDate = (value: string) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return false;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  return (
    year >= 1900 &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date <= today
  );
};

const letterCount = (value: string) => value.match(/\p{L}/gu)?.length ?? 0;
const plausibleName = (value: string) => {
  const clean = value.trim();
  return (
    clean.length <= 60 &&
    letterCount(clean) >= 2 &&
    /^[\p{L}\p{M}](?:[\p{L}\p{M} .'-]*[\p{L}\p{M}.])?$/u.test(clean)
  );
};
const plausiblePlace = (value: string) => {
  const clean = value.trim();
  return (
    clean.length <= 80 &&
    letterCount(clean) >= 2 &&
    /^[\p{L}\p{M}\d](?:[\p{L}\p{M}\d .'-]*[\p{L}\p{M}\d.])?$/u.test(clean)
  );
};
const plausibleAddress = (value: string) => {
  const clean = value.trim();
  return (
    clean.length >= 5 &&
    clean.length <= 120 &&
    letterCount(clean) >= 2 &&
    /^[\p{L}\p{M}\d](?:[\p{L}\p{M}\d .,'#/-]*[\p{L}\p{M}\d.])?$/u.test(clean)
  );
};

export function AccountSetup() {
  const { registration, setRegistration, setName, t } = useDemo();
  const [firstName, setFirstName] = useState(registration.firstName);
  const [middleName, setMiddleName] = useState(registration.middleName);
  const [lastName, setLastName] = useState(registration.lastName);
  const [birthDate, setBirthDate] = useState(registration.birthDate);
  const [sex, setSex] = useState(registration.sex);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const continueToAddress = () => {
    const nextErrors: Record<string, boolean> = {};
    if (!plausibleName(firstName)) nextErrors.firstName = true;
    if (middleName.trim() && !plausibleName(middleName)) nextErrors.middleName = true;
    if (!plausibleName(lastName)) nextErrors.lastName = true;
    if (!isValidBirthDate(birthDate)) nextErrors.birthDate = true;
    if (!sex) nextErrors.sex = true;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const cleanFirst = firstName.trim();
    const cleanMiddle = middleName.trim();
    const cleanLast = lastName.trim();
    setRegistration({
      firstName: cleanFirst,
      middleName: cleanMiddle,
      lastName: cleanLast,
      birthDate,
      sex,
    });
    setName([cleanFirst, cleanMiddle, cleanLast].filter(Boolean).join(' '));
    flow('account-address');
  };
  const choices = [
    { value: 'Female', en: 'Female', bs: 'Babaye' },
    { value: 'Male', en: 'Male', bs: 'Lalaki' },
    { value: 'Prefer not to say', en: 'Prefer not to say', bs: 'Dili isulti' },
  ];
  return (
    <Page
      header={false}
      footer={
        <>
          <Button onPress={continueToAddress}>{t('Continue', 'Padayon')}</Button>
          <View style={[styles.row, { justifyContent: 'center', gap: 4 }]}>
            <Txt variant="small">
              {t('Already have an account?', 'Naa na kay account?')}
            </Txt>
            <Pressable
              accessibilityRole="button"
              onPress={() => flow('login')}
              style={s.compactTextLink}
            >
              <Txt variant="small" style={{ color: c.primary, fontFamily: fonts.bold }}>
                {t('Log in', 'Log in')}
              </Txt>
            </Pressable>
          </View>
        </>
      }
    >
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Logo size={34} />
        <LanguageToggle />
      </View>
      <Progress step={1} total={4} />
      <View style={{ gap: 7 }}>
        <Txt variant="title">{t('Create your account', 'Paghimo sa imong account')}</Txt>
        <Txt style={{ color: c.muted }}>
          {t(
            'Tell us about the beneficiary. Use the same information shown on official records.',
            'Isulti ang impormasyon sa benepisyaryo. Gamita ang parehas nga detalye sa opisyal nga rekord.',
          )}
        </Txt>
      </View>
      <Card style={{ gap: 14 }}>
        <View style={styles.row}>
          <View style={s.sectionIcon}>
            <ContactRound size={20} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="label">
              {t('Personal information', 'Personal nga impormasyon')}
            </Txt>
            <Txt variant="small">
              {t(
                'All fields are required unless marked optional.',
                'Kinahanglan ang tanan gawas sa opsyonal.',
              )}
            </Txt>
          </View>
        </View>
        <Field
          label={t('First name', 'Ngalan')}
          value={firstName}
          onChangeText={(value) => {
            setFirstName(value);
            setErrors((previous) => ({ ...previous, firstName: false }));
          }}
          placeholder={t('Enter first name', 'Isulod ang ngalan')}
          error={
            errors.firstName
              ? t(
                  'Use letters and normal name punctuation only.',
                  'Gamita lamang ang mga letra ug hustong punctuation sa ngalan.',
                )
              : undefined
          }
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
          maxLength={60}
        />
        <Field
          label={t('Middle name (optional)', 'Tunga nga ngalan (opsyonal)')}
          value={middleName}
          onChangeText={(value) => {
            setMiddleName(value);
            setErrors((previous) => ({ ...previous, middleName: false }));
          }}
          placeholder={t('Enter middle name', 'Isulod ang tunga nga ngalan')}
          error={
            errors.middleName
              ? t(
                  'Use letters and normal name punctuation only, or leave this blank.',
                  'Gamita lamang ang mga letra ug hustong punctuation, o biyai kini nga blangko.',
                )
              : undefined
          }
          autoCapitalize="words"
          autoComplete="additional-name"
          textContentType="middleName"
          maxLength={60}
        />
        <Field
          label={t('Last name', 'Apelyido')}
          value={lastName}
          onChangeText={(value) => {
            setLastName(value);
            setErrors((previous) => ({ ...previous, lastName: false }));
          }}
          placeholder={t('Enter last name', 'Isulod ang apelyido')}
          error={
            errors.lastName
              ? t(
                  'Use letters and normal name punctuation only.',
                  'Gamita lamang ang mga letra ug hustong punctuation sa ngalan.',
                )
              : undefined
          }
          autoCapitalize="words"
          autoComplete="family-name"
          textContentType="familyName"
          maxLength={60}
        />
        <Field
          label={t('Birth date', 'Petsa sa pagkatawo')}
          value={birthDate}
          onChangeText={(value) => {
            setBirthDate(formatBirthDate(value));
            setErrors((previous) => ({ ...previous, birthDate: false }));
          }}
          placeholder="MM/DD/YYYY"
          error={
            errors.birthDate
              ? t(
                  'Enter a valid birth date in MM/DD/YYYY format.',
                  'Isulod ang hustong petsa sa MM/DD/YYYY nga porma.',
                )
              : undefined
          }
          keyboardType="number-pad"
          maxLength={10}
        />
        <View style={{ gap: 8 }}>
          <Txt variant="label">{t('Sex', 'Sekso')}</Txt>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={
              errors.sex
                ? t('Sex. Error: Choose one option.', 'Sekso. Sayop: Pagpili og usa.')
                : t('Sex', 'Sekso')
            }
            accessibilityHint={
              errors.sex ? t('Choose one option.', 'Pagpili og usa.') : undefined
            }
            style={s.choiceRow}
          >
            {choices.map((choice) => {
              const selected = sex === choice.value;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  key={choice.value}
                  onPress={() => {
                    setSex(choice.value);
                    setErrors((previous) => ({ ...previous, sex: false }));
                  }}
                  style={[s.choice, selected && s.choiceSelected]}
                >
                  <View style={[s.radio, selected && s.radioSelected]}>
                    {selected && <View style={s.radioDot} />}
                  </View>
                  <Txt variant="small" style={{ color: selected ? c.primary : c.text }}>
                    {t(choice.en, choice.bs)}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
          {errors.sex && (
            <Txt
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              variant="small"
              style={{ color: c.error }}
            >
              {t('Choose one option.', 'Pagpili og usa.')}
            </Txt>
          )}
        </View>
      </Card>
      <Notice>
        {t(
          'Your registration details will be sent to GarantiyAid and saved when you create your account.',
          'Ipadala ug tipigan sa GarantiyAid ang imong detalye sa pagparehistro sa paghimo sa imong account.',
        )}
      </Notice>
    </Page>
  );
}

function AccountAddress() {
  const { registration, setRegistration, t } = useDemo();
  const [address, setAddress] = useState(registration.address);
  const [barangay, setBarangay] = useState(registration.barangay);
  const [city, setCity] = useState(registration.city);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [serviceAreaError, setServiceAreaError] = useState(false);
  useEffect(() => {
    getBarangays()
      .then((items) => {
        setBarangays(items);
        if (items.length === 1 && !barangay.trim()) {
          setBarangay(items[0].barangayName);
          setCity(items[0].city);
        }
      })
      .catch(() => setServiceAreaError(true));
  }, []);
  const continueToPhone = () => {
    const nextErrors: Record<string, boolean> = {};
    if (!plausibleAddress(address)) nextErrors.address = true;
    const selectedBarangay = barangays.find(
      (item) =>
        item.barangayName.toLocaleLowerCase() === barangay.trim().toLocaleLowerCase() &&
        item.city.toLocaleLowerCase() === city.trim().toLocaleLowerCase(),
    );
    if (!plausiblePlace(barangay) || !selectedBarangay) nextErrors.barangay = true;
    if (!plausiblePlace(city)) nextErrors.city = true;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setRegistration({
      address: address.trim(),
      barangay: barangay.trim(),
      barangayId: selectedBarangay!.id,
      city: city.trim(),
    });
    flow('mobile-number');
  };
  return (
    <Page
      title={t('Create account', 'Paghimo og account')}
      footer={<Button onPress={continueToPhone}>{t('Continue', 'Padayon')}</Button>}
    >
      <Progress step={2} total={4} />
      <View style={{ gap: 7 }}>
        <Txt variant="title">{t('Where do you live?', 'Asa ka nagpuyo?')}</Txt>
        <Txt style={{ color: c.muted }}>
          {t(
            'Your address helps identify the barangay handling your assistance.',
            'Ang imong adres makatabang pagtino sa barangay nga nagdumala sa imong ayuda.',
          )}
        </Txt>
      </View>
      <Card style={{ gap: 14 }}>
        <View style={styles.row}>
          <View style={s.sectionIcon}>
            <MapPin size={20} color={c.primary} />
          </View>
          <Txt variant="label">{t('Home address', 'Adres sa balay')}</Txt>
        </View>
        <Field
          label={t('House no. and street', 'Numero sa balay ug dalan')}
          value={address}
          onChangeText={(value) => {
            setAddress(value);
            setErrors((previous) => ({ ...previous, address: false }));
          }}
          placeholder={t('Example: 24 Mabini Street', 'Pananglitan: 24 Mabini Street')}
          error={
            errors.address
              ? t(
                  'Enter a complete address using letters, numbers, and normal address punctuation.',
                  'Isulod ang kompleto nga adres gamit ang letra, numero, ug hustong punctuation.',
                )
              : undefined
          }
          autoCapitalize="words"
          autoComplete="street-address"
          textContentType="streetAddressLine1"
          maxLength={120}
        />
        <Field
          label={t('Barangay', 'Barangay')}
          value={barangay}
          onChangeText={(value) => {
            setBarangay(value);
            setErrors((previous) => ({ ...previous, barangay: false }));
          }}
          placeholder={t('Enter barangay', 'Isulod ang barangay')}
          error={
            errors.barangay
              ? t(
                  'Choose a barangay currently served by GarantiyAid.',
                  'Pagpili og barangay nga giserbisyohan karon sa GarantiyAid.',
                )
              : undefined
          }
          autoCapitalize="words"
          maxLength={80}
        />
        <Field
          label={t('City or municipality', 'Siyudad o lungsod')}
          value={city}
          onChangeText={(value) => {
            setCity(value);
            setErrors((previous) => ({ ...previous, city: false }));
          }}
          placeholder={t('Enter city or municipality', 'Isulod ang siyudad o lungsod')}
          error={
            errors.city
              ? t(
                  'Enter a valid city or municipality.',
                  'Isulod ang hustong siyudad o lungsod.',
                )
              : undefined
          }
          autoCapitalize="words"
          autoComplete="address-line2"
          maxLength={80}
        />
      </Card>
      {serviceAreaError ? (
        <Notice tone="error">
          {t(
            'Service areas could not be loaded. Start the backend, then return to this screen.',
            'Wala ma-load ang mga service area. I-start ang backend, dayon balik dinhi.',
          )}
        </Notice>
      ) : (
        <Notice>
          {barangays.length
            ? t(
                `Available now: ${barangays.map((item) => `${item.barangayName}, ${item.city}`).join('; ')}.`,
                `Magamit karon: ${barangays.map((item) => `${item.barangayName}, ${item.city}`).join('; ')}.`,
              )
            : t('Loading available service areas…', 'Nag-load sa mga service area…')}
        </Notice>
      )}
    </Page>
  );
}

export function EntryFlow() {
  const { step } = useLocalSearchParams<{ step: string }>();
  if (step === 'mobile-number' || step === 'login')
    return <PhoneEntry login={step === 'login'} />;
  if (step === 'account-info') return <AccountSetup />;
  if (step === 'account-address') return <AccountAddress />;
  if (step === 'otp') return <OTP />;
  if (step === 'consent') return <Consent />;
  if (step === 'capture') return <Capture />;
  if (step === 'face-success') return <FaceSuccess />;
  return (
    <Page title="GarantiyAid">
      <Txt variant="title">This step is unavailable</Txt>
      <Button onPress={() => router.replace('/')}>Back to welcome</Button>
    </Page>
  );
}

function PhoneEntry({ login }: { login: boolean }) {
  const { phone, setPhone, registration, t } = useDemo();
  const [value, setValue] = useState(phone);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const send = async () => {
    if (!/^9\d{9}$/.test(value)) {
      setError(
        t(
          'Enter a valid 10-digit number starting with 9.',
          'Isulod ang 10 ka numero nga nagsugod sa 9.',
        ),
      );
      return;
    }
    setLoading(true);
    setError('');
    try {
      let developmentOtp: string | undefined;
      if (login) {
        developmentOtp = (await requestOtp(value, 'login')).developmentOtp;
      } else {
        if (!registration.barangayId) {
          setError(
            t(
              'Go back and choose an available barangay before continuing.',
              'Balik ug pagpili og available nga barangay sa dili pa mopadayon.',
            ),
          );
          return;
        }
        const [month, day, year] = registration.birthDate.split('/');
        try {
          developmentOtp = (
            await registerBeneficiary({
              firstName: registration.firstName,
              middleName: registration.middleName,
              lastName: registration.lastName,
              birthDate: `${year}-${month}-${day}`,
              sex: registration.sex,
              address: registration.address,
              barangayId: registration.barangayId,
              contactNumber: value,
            })
          ).developmentOtp;
        } catch (requestError) {
          if (requestError instanceof ApiRequestError && requestError.code === 'PHONE_ALREADY_REGISTERED') {
            developmentOtp = (await requestOtp(value, 'register')).developmentOtp;
          } else {
            throw requestError;
          }
        }
      }
      setPhone(value);
      flow('otp', {
        intent: login ? 'login' : 'register',
        ...(developmentOtp ? { developmentOtp } : {}),
      });
    } catch (requestError) {
      setError(
        requestError instanceof ApiRequestError
          ? requestError.message
          : t('Could not send a code. Try again.', 'Wala maipadala ang code. Sulayi pag-usab.'),
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <Page
      footer={
        <>
          <Button onPress={send} loading={loading}>
            {login
              ? t('Send Login Code', 'Ipadala ang Login Code')
              : t('Send Code', 'Ipadala ang Code')}
          </Button>
          {login ? (
            <Pressable
              accessibilityRole="button"
              style={s.textLink}
              onPress={() => router.push('/reset-password')}
            >
              <Txt variant="small" style={{ color: c.primary }}>
                {t(
                  'Trouble signing in? Recover account',
                  'Dili maka-log in? Irecover ang account',
                )}
              </Txt>
            </Pressable>
          ) : (
            <Txt variant="small" style={{ textAlign: 'center' }}>
              {t(
                'By continuing, you agree to receive account verification messages when this app is connected.',
                'Sa pagpadayon, mouyon ka sa pagdawat sa verification messages kon konektado na ang app.',
              )}
            </Txt>
          )}
        </>
      }
    >
      <View style={{ alignItems: 'center' }}>
        <Logo size={30} />
      </View>
      <View style={{ gap: 10, marginTop: login ? 18 : 32 }}>
        {!login && <Progress step={3} total={4} />}
        <Txt variant="title">
          {login
            ? t('Welcome back', 'Maayong pagbalik')
            : t('Enter your mobile\nnumber', 'Isulod imong numero\nsa cellphone')}
        </Txt>
        <Txt style={{ color: c.muted }}>
          {login
            ? t(
                'Log in to view your schedule or claim your assistance.',
                'Log in aron makita ang iskedyul o ma-claim ang ayuda.',
              )
            : t(
                'GarantiyAid uses your mobile number to send your schedule and claim codes.',
                'Gigamit sa GarantiyAid ang imong numero aron ipadala ang iskedyul ug claim codes.',
              )}
        </Txt>
      </View>
      {login && (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/face-login')}
            style={s.faceLogin}
          >
            <View
              style={[
                s.featureIcon,
                {
                  backgroundColor: c.primarySoft,
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                },
              ]}
            >
              <ScanFace size={28} color={c.primary} />
            </View>
            <Txt variant="label" style={{ color: c.primary }}>
              {t('Login with Face', 'Log in pinaagi sa Nawong')}
            </Txt>
            <Txt variant="small">
              {t('Faster and more secure', 'Mas paspas ug mas luwas')}
            </Txt>
          </Pressable>
          <View style={[styles.row, { gap: 12 }]}>
            <View style={s.rule} />
            <Txt variant="small">{t('OR USE PHONE', 'O GAMITA ANG CELLPHONE')}</Txt>
            <View style={s.rule} />
          </View>
        </>
      )}
      <PhoneField
        value={value}
        onChangeText={(text) => {
          setValue(text);
          setError('');
        }}
        error={error}
      />
      <Notice>
        {t(
          'Development mode shows the generated code on the next screen because SMS is not connected yet.',
          'Sa development mode, makita ang generated code sa sunod nga screen kay wala pa konektado ang SMS.',
        )}
      </Notice>
    </Page>
  );
}

function OTP() {
  const { phone, startSession, t } = useDemo();
  const { intent, developmentOtp: initialDevelopmentOtp } = useLocalSearchParams<{
    intent: string;
    developmentOtp?: string;
  }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(60);
  const [loading, setLoading] = useState(false);
  const [developmentOtp, setDevelopmentOtp] = useState(initialDevelopmentOtp);
  const purpose = intent === 'login' ? 'login' : 'register';
  useEffect(() => {
    const interval = setInterval(
      () => setSeconds((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearInterval(interval);
  }, []);
  return (
    <Page
      footer={
        <Button
          disabled={code.length !== 6}
          loading={loading}
          onPress={async () => {
            setLoading(true);
            setError('');
            try {
              const result = await verifyOtp(phone, purpose, code);
              await startSession(result.accessToken, result.beneficiary);
              intent === 'login' ? router.replace('/(tabs)/home') : flow('consent');
            } catch (requestError) {
              setError(
                requestError instanceof ApiRequestError
                  ? requestError.message
                  : t('Could not verify the code. Try again.', 'Wala ma-verify ang code. Sulayi pag-usab.'),
              );
            } finally {
              setLoading(false);
            }
          }}
        >
          {t('Verify code', 'Iverify ang code')}
        </Button>
      }
    >
      {intent === 'login' ? (
        <Txt variant="small" style={{ color: c.primary, fontFamily: fonts.semibold }}>
          {t('Login verification', 'Verification sa login')}
        </Txt>
      ) : (
        <Progress step={4} total={4} />
      )}
      <Txt variant="title">{t('Enter your code', 'Isulod imong code')}</Txt>
      <Txt style={{ color: c.muted }}>
        {t(
          'Enter the 6-digit verification code for',
          'Isulod ang 6 ka numero nga verification code alang sa',
        )}{' '}
        <Txt variant="label">+63 {phone || '9175550147'}</Txt>
      </Txt>
      <View style={s.otpWrap}>
        <View style={s.otpBoxes} accessibilityElementsHidden>
          {Array.from({ length: 6 }, (_, index) => (
            <View
              key={index}
              style={[
                s.otpBox,
                error && { borderColor: c.error },
                code.length === index && { borderColor: c.primary },
              ]}
            >
              <Txt variant="heading">{code[index] || ''}</Txt>
            </View>
          ))}
        </View>
        <TextInput
          accessibilityLabel={t(
            'Six-digit verification code',
            'Unom ka numero nga verification code',
          )}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChangeText={(value) => {
            setCode(value.replace(/\D/g, '').slice(0, 6));
            setError('');
          }}
          caretHidden
          style={s.otpInput}
        />
      </View>
      {error ? (
        <Txt variant="small" style={{ color: c.error }}>
          {error}
        </Txt>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={seconds > 0}
        style={s.textLink}
        onPress={async () => {
          setLoading(true);
          setError('');
          try {
            const result = await requestOtp(phone, purpose);
            setDevelopmentOtp(result.developmentOtp);
            setSeconds(60);
            setCode('');
          } catch (requestError) {
            setError(
              requestError instanceof ApiRequestError
                ? requestError.message
                : t('Could not resend the code. Try again.', 'Wala maipadala pag-usab ang code.'),
            );
          } finally {
            setLoading(false);
          }
        }}
      >
        <Txt
          variant="small"
          style={{ textAlign: 'center', color: seconds ? c.muted : c.primary }}
        >
          {seconds
            ? t(
                `Resend in 0:${String(seconds).padStart(2, '0')}`,
                `Ipadala pag-usab sa 0:${String(seconds).padStart(2, '0')}`,
              )
            : t('Resend code', 'Ipadala pag-usab ang code')}
        </Txt>
      </Pressable>
      <Notice tone={developmentOtp ? 'warning' : 'info'}>
        {developmentOtp
          ? t(
              `Development code: ${developmentOtp}. No SMS was sent.`,
              `Development code: ${developmentOtp}. Walay SMS nga gipadala.`,
            )
          : t(
              'Check your messages for the verification code.',
              'Tan-awa ang imong messages alang sa verification code.',
            )}
      </Notice>
    </Page>
  );
}

function Consent() {
  const { setConsentGiven, t } = useDemo();
  return (
    <Page
      footer={
        <>
          <Button
            onPress={() => {
              setConsentGiven(true);
              flow('capture');
            }}
          >
            {t('I agree — Enroll my face', 'Mouyon ko — Ienroll akong nawong')}
          </Button>
          <Button
            variant="outline"
            onPress={() => {
              setConsentGiven(false);
              router.replace('/(tabs)/home');
            }}
          >
            {t('Skip for now', 'Laktawi sa pagkakaron')}
          </Button>
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: 16 }}>
        <Logo size={48} halo />
        <Txt variant="title" style={{ textAlign: 'center' }}>
          {t('Set up face verification', 'Iset up ang face verification')}
        </Txt>
        <Txt style={s.centerMuted}>
          {t(
            'This is optional. You can skip and use your phone number instead.',
            'Opsyonal kini. Pwede nimo laktawan ug gamiton ang imong numero.',
          )}
        </Txt>
      </View>
      <Card>
        <View style={styles.row}>
          <ShieldCheck size={19} color={c.primary} />
          <Txt variant="small" style={{ flex: 1, color: c.primary }}>
            {t(
              'Before you allow camera access, please review:',
              'Sa dili pa tugotan ang camera, palihog basaha:',
            )}
          </Txt>
        </View>
        {[
          t(
            'Face capture is used only for identity verification.',
            'Ang hulagway sa nawong alang lamang sa pagverify.',
          ),
          t(
            'This preview does not upload or save your photo to a server.',
            'Kini nga preview dili mo-upload o mosave sa hulagway sa server.',
          ),
          t(
            'You can withdraw consent in Security & Privacy.',
            'Pwede bawion ang pagtugot sa Security & Privacy.',
          ),
          t(
            'Server-side matching and liveness are not connected yet.',
            'Wala pa makonektar ang face matching ug liveness sa server.',
          ),
        ].map((text) => (
          <View key={text} style={[styles.row, { alignItems: 'flex-start' }]}>
            <CircleCheck size={17} color={c.green} />
            <Txt variant="small" style={{ flex: 1 }}>
              {text}
            </Txt>
          </View>
        ))}
      </Card>
    </Page>
  );
}

function Capture() {
  const { consentGiven, setFaceEnrolled, t } = useDemo();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const complete = () => {
    setFaceEnrolled(true);
    router.replace('/flow/face-success');
  };
  const take = async () => {
    if (!camera.current || busy || !cameraReady) return;
    setBusy(true);
    try {
      const result = await camera.current.takePictureAsync({ quality: 0.5 });
      if (result) setPhoto(result.uri);
    } catch {
      setError(
        t(
          'Could not capture a photo. Check the camera and try again.',
          'Dili makakuha og hulagway. Susihon ang camera ug sulayi pag-usab.',
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  if (!consentGiven)
    return (
      <Page title={t('Face enrollment', 'Face enrollment')}>
        <Notice tone="warning">
          {t(
            'Please review the consent notice before using the camera.',
            'Basaha una ang pagtugot sa dili pa gamiton ang camera.',
          )}
        </Notice>
        <Button onPress={() => router.replace('/flow/consent')}>
          {t('Review consent', 'Basaha ang pagtugot')}
        </Button>
      </Page>
    );
  return (
    <Page
      style={{ backgroundColor: c.navy }}
      header={false}
      footer={
        <View style={{ gap: 12 }}>
          {error ? <Notice tone="error">{error}</Notice> : null}
          {photo ? (
            <>
              <Button variant="green" onPress={complete}>
                {t('Use photo in preview', 'Gamita ang hulagway sa preview')}
              </Button>
              <Button
                variant="white"
                onPress={() => {
                  setPhoto(null);
                  setCameraReady(false);
                }}
              >
                {t('Retake photo', 'Kuhaa pag-usab')}
              </Button>
            </>
          ) : permission?.granted ? (
            <Button icon={Camera} disabled={!cameraReady} loading={busy} onPress={take}>
              {t('Capture photo', 'Kuhaa ang hulagway')}
            </Button>
          ) : (
            <Button
              icon={Camera}
              onPress={() => {
                if (permission && !permission.canAskAgain && Platform.OS !== 'web') {
                  Linking.openSettings();
                  return;
                }
                requestPermission().catch(() =>
                  setError(
                    t(
                      'Camera access is unavailable. You can continue with the preview.',
                      'Dili maablihan ang camera. Pwede mopadayon sa preview.',
                    ),
                  ),
                );
              }}
            >
              {t('Enable camera', 'Tugoti ang camera')}
            </Button>
          )}
          {!photo && (
            <Button variant="white" onPress={complete}>
              {t('Continue with demo capture', 'Padayon sa demo capture')}
            </Button>
          )}
          <Txt variant="small" style={{ textAlign: 'center', color: '#CED9E6' }}>
            {t(
              'Preview only. No face matching, liveness check, or upload occurs.',
              'Preview lamang. Walay face matching, liveness, o upload.',
            )}
          </Txt>
        </View>
      }
    >
      <StatusBar style="light" />
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Go back', 'Balik')}
          onPress={() => router.back()}
          style={[styles.iconButton, { backgroundColor: c.card }]}
        >
          <ArrowLeft size={20} color={c.text} />
        </Pressable>
        <LanguageToggle />
      </View>
      <Txt variant="heading" style={{ color: c.card, textAlign: 'center' }}>
        {t('Position your face', 'Iposisyon imong nawong')}
      </Txt>
      <View style={s.cameraBox}>
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={StyleSheet.absoluteFill}
            accessibilityLabel="Local face photo preview"
          />
        ) : permission?.granted ? (
          <CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing="front"
            onCameraReady={() => setCameraReady(true)}
            onMountError={() => {
              setError(
                t(
                  'Camera could not start. Try another device or use demo capture.',
                  'Dili mosugod ang camera. Sulayi laing device o demo capture.',
                ),
              );
              setCameraReady(false);
            }}
          />
        ) : (
          <ScanFace size={110} strokeWidth={1} color="#6282A8" />
        )}
        {!photo && <View pointerEvents="none" style={s.faceGuide} />}
      </View>
      {[
        t('Look straight at the camera', 'Tan-aw diretso sa camera'),
        t('Stay in good lighting', 'Pabilin sa hayag nga lugar'),
        t('Hold still for a moment', 'Ayaw lihok kadiyot'),
      ].map((text, index) => (
        <View key={text} style={styles.row}>
          <View style={s.tipNumber}>
            <Txt variant="small" style={{ color: c.card }}>
              {index + 1}
            </Txt>
          </View>
          <Txt variant="small" style={{ color: '#CED9E6', flex: 1 }}>
            {text}
          </Txt>
        </View>
      ))}
    </Page>
  );
}
function FaceSuccess() {
  const { t } = useDemo();
  return (
    <Page
      back={false}
      footer={
        <Button variant="green" onPress={() => router.replace('/(tabs)/home')}>
          {t('Continue to Home', 'Padayon sa Home')}
        </Button>
      }
    >
      <View style={[s.welcomeHero, { flex: 1, justifyContent: 'center' }]}>
        <View style={s.successIcon}>
          <CircleCheck size={64} color={c.green} strokeWidth={1.8} />
        </View>
        <Txt variant="title">{t('Face enrolled!', 'Naenroll na ang nawong!')}</Txt>
        <Txt style={s.centerMuted}>
          {t(
            'Your demo enrollment is complete. Actual identity verification will be available when the biometric service is connected.',
            'Nahuman ang demo enrollment. Ang tinuod nga pagverify magamit kon konektado na ang biometric service.',
          )}
        </Txt>
        <Notice>
          {t(
            'Prototype preview — no biometric record was created on a server.',
            'Prototype preview — walay biometric record gihimo sa server.',
          )}
        </Notice>
      </View>
    </Page>
  );
}
const s = StyleSheet.create({
  progressWrap: { gap: 8 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: c.outline,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: c.primary },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primarySoft,
  },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.outline,
    backgroundColor: c.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  choiceSelected: { borderColor: c.primary, backgroundColor: c.primarySoft },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: c.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: c.primary },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: c.primary },
  compactTextLink: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  welcomeHero: { alignItems: 'center', gap: 18, paddingTop: 12 },
  centerMuted: { textAlign: 'center', color: c.muted, maxWidth: 290 },
  features: { gap: 20, paddingTop: 8, paddingHorizontal: 4 },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textLink: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  faceLogin: {
    borderWidth: 1,
    borderColor: c.outline,
    borderRadius: 20,
    backgroundColor: c.card,
    padding: 22,
    alignItems: 'center',
    gap: 8,
  },
  rule: { height: 1, backgroundColor: c.outline, flex: 1 },
  otpWrap: { height: 56, position: 'relative' },
  otpBoxes: { flexDirection: 'row', gap: 6, height: 56 },
  otpBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.outline,
    borderRadius: 11,
    backgroundColor: c.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpInput: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    color: 'transparent',
    backgroundColor: 'transparent',
    fontSize: 24,
  },
  cameraBox: {
    height: 290,
    width: '100%',
    maxWidth: 290,
    alignSelf: 'center',
    borderRadius: 20,
    backgroundColor: '#182A44',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceGuide: {
    position: 'absolute',
    width: 190,
    height: 240,
    borderWidth: 2,
    borderColor: '#5D9ADA',
    borderRadius: 100,
  },
  tipNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: c.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
