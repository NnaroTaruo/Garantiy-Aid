import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import QRCode from 'react-native-qrcode-svg';
import {
  Bell,
  CalendarDays,
  Check,
  CircleCheck,
  CircleHelp,
  Clock3,
  FileText,
  Info,
  MapPin,
  MessageCircle,
  QrCode,
  ScanFace,
  ShieldCheck,
  Users,
} from 'lucide-react-native';
import {
  Badge,
  BottomLinks,
  Button,
  Card,
  DetailRow,
  Field,
  flow,
  go,
  Logo,
  Notice,
  Page,
  PhoneField,
  styles,
  Txt,
} from '../components';
import { appointment as a, notices, peso, useDemo } from '../state';
import { colors as c, fonts } from '../theme';
import { ApiRequestError, getBarangays, issueClaimPass, type ClaimPass as ClaimPassData } from '../api';
import {
  formatDate,
  formatDateTime,
  formatQueueNumber,
  formatStatus,
  formatTimeSlot,
} from '../format';
import { s as mainStyles } from './main';

export function DetailScreen() {
  const { page: screen } = useLocalSearchParams<{ page: string }>();
  const { t } = useDemo();
  const definitions: Record<
    string,
    { title: string; content: React.ReactNode; active?: string }
  > = {
    schedule: {
      title: t('Claiming schedule', 'Iskedyul sa pag-claim'),
      content: <Schedule />,
    },
    'qr-pass': {
      title: t('My QR claim pass', 'Akong QR claim pass'),
      content: <ClaimPass />,
    },
    transactions: {
      title: t('Transaction history', 'Kasaysayan sa transaksyon'),
      content: <Transactions />,
      active: 'wallet',
    },
    receipt: { title: t('Receipt', 'Resibo'), content: <Receipt />, active: 'wallet' },
    notifications: {
      title: t('Notifications', 'Mga pahibalo'),
      content: <Notifications />,
    },
    'notification-details': {
      title: t('Notification details', 'Detalye sa pahibalo'),
      content: <NotificationDetails />,
    },
    'reset-password': {
      title: t('Reset password', 'Ireset ang password'),
      content: <Recovery />,
      active: 'profile',
    },
    'edit-profile': {
      title: t('My saved details', 'Akong natipig nga detalye'),
      content: <EditProfile />,
      active: 'profile',
    },
    'change-password': {
      title: t('Change password', 'Usba ang password'),
      content: <Password />,
      active: 'profile',
    },
    'notification-settings': {
      title: t('Notification settings', 'Mga setting sa pahibalo'),
      content: <NotificationSettings />,
      active: 'profile',
    },
    'enrollment-status': {
      title: t('Enrollment status', 'Kahimtang sa enrollment'),
      content: <EnrollmentStatus />,
    },
    'enrollment-documents': {
      title: t('Enrollment status', 'Kahimtang sa enrollment'),
      content: <EnrollmentDocuments />,
    },
    'security-privacy': {
      title: t('Security & Privacy', 'Seguridad ug Privacy'),
      content: <Privacy />,
      active: 'profile',
    },
    'schedule-update': {
      title: t('Schedule update', 'Nausab nga iskedyul'),
      content: <Exception kind="schedule" />,
    },
    'qr-expired': {
      title: t('QR verification', 'QR verification'),
      content: <Exception kind="expired" />,
    },
    support: {
      title: t('Talk to staff', 'Pakigsulti sa staff'),
      content: <Support />,
      active: 'help',
    },
    'face-login': {
      title: t('Login with Face', 'Log in pinaagi sa Nawong'),
      content: <FaceLogin />,
    },
  };
  const entry = definitions[screen];
  if (!entry)
    return (
      <Page title="GarantiyAid">
        <Txt variant="title">{t('Screen unavailable', 'Dili magamit nga screen')}</Txt>
        <Button onPress={() => router.replace('/(tabs)/home')}>
          {t('Return to Home', 'Balik sa Home')}
        </Button>
      </Page>
    );
  return (
    <View style={{ flex: 1 }}>
      <Page tabs title={entry.title}>
        {entry.content}
      </Page>
      <BottomLinks active={entry.active} />
    </View>
  );
}

function Schedule() {
  const { overview, overviewLoading, overviewError, refreshOverview, t } = useDemo();
  if (overviewLoading) {
    return <Notice>{t('Loading your schedule…', 'Nag-load sa imong iskedyul…')}</Notice>;
  }
  if (overviewError) {
    return (
      <>
        <Notice tone="error">
          {t('Your schedule could not be loaded.', 'Wala ma-load ang imong iskedyul.')}
        </Notice>
        <Button onPress={() => void refreshOverview()}>{t('Try again', 'Sulayi pag-usab')}</Button>
      </>
    );
  }
  const schedule = overview?.nextSchedule;
  if (!schedule) {
    return (
      <>
        <Notice>
          {t(
            'No claiming schedule has been assigned to your account yet.',
            'Wala pay iskedyul sa claim nga gi-assign sa imong account.',
          )}
        </Notice>
        <Button variant="outline" onPress={() => void refreshOverview()}>
          {t('Refresh schedule', 'I-refresh ang iskedyul')}
        </Button>
      </>
    );
  }
  return (
    <>
      <Badge>{formatStatus(schedule.status)}</Badge>
      <Card>
        <DetailRow
          icon={ShieldCheck}
          label={t('Program', 'Programa')}
          value={schedule.program.name}
        />
        <DetailRow
          icon={CalendarDays}
          label={t('Date', 'Petsa')}
          value={formatDate(schedule.date)}
        />
        <DetailRow
          icon={Clock3}
          label={t('Time slot', 'Oras')}
          value={formatTimeSlot(schedule.slotStart, schedule.slotEnd)}
        />
        <DetailRow
          icon={Users}
          label={t('Queue number', 'Numero sa pila')}
          value={formatQueueNumber(schedule.queueNumber)}
        />
        <DetailRow icon={MapPin} label={t('Venue', 'Lugar')} value={schedule.location} />
      </Card>
      <Notice>
        {t(
          'This schedule is assigned to your saved beneficiary account. Arrive only during your time slot.',
          'Kini nga iskedyul gi-assign sa imong beneficiary account. Abot lamang sa imong oras.',
        )}
      </Notice>
      <Button icon={QrCode} onPress={() => go('qr-pass')}>
        {t('Open my QR claim pass', 'Ablihi akong QR claim pass')}
      </Button>
      <Button variant="outline" onPress={() => void refreshOverview()}>
        {t('Refresh schedule', 'I-refresh ang iskedyul')}
      </Button>
    </>
  );
}

function ClaimPass() {
  const { accessToken, reset, t } = useDemo();
  const [pass, setPass] = useState<ClaimPassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const requested = useRef(false);
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setPass(await issueClaimPass(accessToken));
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 401) {
        await reset();
        router.replace('/');
        return;
      }
      setError(
        caught instanceof ApiRequestError
          ? caught
          : new ApiRequestError('REQUEST_FAILED', 'The claim pass could not be issued.'),
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!accessToken || requested.current) return;
    requested.current = true;
    void load();
  }, [accessToken]);
  if (loading) {
    return <Notice>{t('Issuing your secure QR pass…', 'Gina-issue ang imong secure QR pass…')}</Notice>;
  }
  if (error) {
    const unavailable = error.code === 'CLAIM_PASS_UNAVAILABLE';
    return (
      <>
        <Notice tone={unavailable ? 'warning' : 'error'}>
          {unavailable
            ? t(
                'A QR pass is not available because you have no upcoming distribution schedule.',
                'Walay QR pass kay wala pay umaabot nga distribution schedule.',
              )
            : t('Your QR pass could not be issued. Try again.', 'Wala ma-issue ang QR pass. Sulayi pag-usab.')}
        </Notice>
        {!unavailable ? <Button onPress={() => void load()}>{t('Try again', 'Sulayi pag-usab')}</Button> : null}
        <Button variant="outline" onPress={() => go('schedule')}>
          {t('Back to schedule', 'Balik sa iskedyul')}
        </Button>
      </>
    );
  }
  if (!pass) return null;
  return (
    <>
      <Card style={{ alignItems: 'center' }}>
        <Txt variant="label" style={{ textAlign: 'center', color: c.primary }}>
          {pass.schedule.program.name}
        </Txt>
        <Txt variant="small">{formatDate(pass.schedule.date)}</Txt>
        <View
          style={{ padding: 12, backgroundColor: c.card }}
          accessibilityLabel={t('Active QR claim pass', 'Aktibong QR claim pass')}
        >
          <QRCode
            value={pass.claimCode}
            size={220}
            color={c.navy}
            backgroundColor={c.card}
          />
        </View>
        <Txt variant="number">{formatQueueNumber(pass.schedule.queueNumber)}</Txt>
        <Txt variant="small">
          {formatTimeSlot(pass.schedule.slotStart, pass.schedule.slotEnd)}
        </Txt>
        <Txt variant="label" style={{ textAlign: 'center' }}>
          {pass.schedule.location}
        </Txt>
        <Badge tone="success">{t('Active pass', 'Aktibong pass')}</Badge>
      </Card>
      <Notice>
        {t(
          `Show this pass only to authorized staff. It expires ${formatDateTime(pass.expiresAt)}. Staff record the result, then it appears in Wallet.`,
          `Ipakita lamang kini sa awtorisadong staff. Ma-expire kini ${formatDateTime(pass.expiresAt)}. Ang staff maoy morekord sa resulta, dayon makita kini sa Wallet.`,
        )}
      </Notice>
      <Button variant="outline" onPress={() => go('schedule')}>
        {t('Back to schedule', 'Balik sa iskedyul')}
      </Button>
    </>
  );
}

function Transactions() {
  const { wallet, walletLoading, walletError, refreshWallet, t } = useDemo();
  const [selected, setSelected] = useState('');
  const entries = wallet?.transactions ?? [];
  const selectedId = entries.some((entry) => entry.id === selected)
    ? selected
    : (entries[0]?.id ?? '');
  return (
    <>
      <Notice>
        {t(
          'This wallet records assistance issued to you. It cannot send or transfer money.',
          'Kini nga wallet nagrekord sa ayuda nga imong nadawat. Dili kini makapadala o makabalhin og kuwarta.',
        )}
      </Notice>
      {walletLoading && !wallet ? (
        <Card>
          <Txt variant="label">{t('Loading wallet records…', 'Nag-load sa wallet records…')}</Txt>
        </Card>
      ) : walletError ? (
        <>
          <Notice tone="error">
            {t(
              'Your wallet history could not be loaded.',
              'Wala ma-load ang imong wallet history.',
            )}
          </Notice>
          <Button variant="outline" onPress={() => void refreshWallet()}>
            {t('Try again', 'Sulayi pag-usab')}
          </Button>
        </>
      ) : (
        <>
          <View style={mainStyles.balanceCard}>
            <Txt variant="small" style={mainStyles.cardCaption}>
              {t('RECORDED BALANCE', 'NAREKORD NGA BALANSE')}
            </Txt>
            <Txt variant="heading" style={{ fontSize: 26, color: c.card }}>
              {peso(wallet?.wallet?.balance ?? 0)}
            </Txt>
          </View>
          <Txt variant="small" style={{ fontFamily: fonts.semibold }}>
            {t('RECENT TRANSACTIONS', 'BAG-ONG MGA TRANSAKSYON')}
          </Txt>
          {entries.length ? (
            <Card style={{ gap: 0, paddingVertical: 4 }}>
              {entries.map((entry, index) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedId === entry.id }}
                  onPress={() => setSelected(entry.id)}
                  key={entry.id}
                  style={[
                    mainStyles.transaction,
                    index > 0 && { borderTopWidth: 1, borderTopColor: c.outline },
                  ]}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <Txt variant="label">{t('Aid received', 'Nadawat nga ayuda')}</Txt>
                    <Txt variant="small">
                      {entry.program.name} · {formatDateTime(entry.createdAt)}
                    </Txt>
                    <Txt variant="small" style={{ fontSize: 10 }}>
                      {entry.reference}
                    </Txt>
                  </View>
                  <Txt
                    variant="small"
                    style={{ color: c.green, fontFamily: fonts.semibold }}
                  >
                    +{peso(entry.amount)}
                  </Txt>
                  {selectedId === entry.id && <Check size={18} color={c.primary} />}
                </Pressable>
              ))}
            </Card>
          ) : (
            <Card>
              <Txt variant="label">{t('No wallet history yet', 'Wala pay wallet history')}</Txt>
              <Txt variant="small">
                {t(
                  'Recorded assistance will appear here after an authorized staff member completes a claim.',
                  'Makita dinhi ang narekord nga ayuda human makompleto sa awtorisadong staff ang claim.',
                )}
              </Txt>
            </Card>
          )}
        </>
      )}
      {!walletError && (
        <Button
          variant="outline"
          loading={walletLoading}
          onPress={() => void refreshWallet()}
        >
          {t('Refresh records', 'I-refresh ang records')}
        </Button>
      )}
      <Button
        variant="outline"
        disabled={!selectedId}
        onPress={() => go('receipt', { id: selectedId })}
      >
        {t('View selected receipt', 'Tan-awa ang napiling resibo')}
      </Button>
    </>
  );
}
function Receipt() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { wallet, walletLoading, walletError, refreshWallet, t } = useDemo();
  const entry = wallet?.transactions.find((item) => item.id === id);
  if (walletLoading && !wallet)
    return (
      <Card>
        <Txt variant="label">{t('Loading receipt…', 'Nag-load sa resibo…')}</Txt>
      </Card>
    );
  if (walletError)
    return (
      <>
        <Notice tone="error">
          {t('This receipt could not be loaded.', 'Wala ma-load kini nga resibo.')}
        </Notice>
        <Button variant="outline" onPress={() => void refreshWallet()}>
          {t('Try again', 'Sulayi pag-usab')}
        </Button>
      </>
    );
  if (!entry)
    return (
      <Notice tone="warning">
        {t(
          'Receipt unavailable. Select a transaction in your history.',
          'Dili magamit ang resibo. Pagpili og transaksyon sa kasaysayan.',
        )}
      </Notice>
    );
  return (
    <>
      <View style={styles.row}>
        <CircleCheck color={c.green} size={40} />
        <View>
          <Txt variant="label">{t('Aid received', 'Nadawat nga ayuda')}</Txt>
          <Txt variant="title" style={{ color: c.green }}>
            +{peso(entry.amount)}
          </Txt>
        </View>
      </View>
      <Card>
        <DetailRow label={t('Program', 'Programa')} value={entry.program.name} />
        <DetailRow label={t('Recorded', 'Girekord')} value={formatDateTime(entry.createdAt)} />
        <DetailRow
          label={t('Reference No.', 'Numero sa reperensya')}
          value={entry.reference}
        />
        <DetailRow label={t('Status', 'Kahimtang')} value={formatStatus(entry.status)} />
        <DetailRow
          label={t('Claim status', 'Kahimtang sa claim')}
          value={formatStatus(entry.claimStatus)}
        />
      </Card>
      <Notice>
        {t(
          'This receipt is a recorded assistance entry. This app does not transfer funds.',
          'Kini nga resibo usa ka rekord sa ayuda. Kini nga app dili magbalhin og kuwarta.',
        )}
      </Notice>
      <Button onPress={() => router.back()}>{t('Close', 'Sirad-i')}</Button>
    </>
  );
}

function Notifications() {
  const { readNotifications, markRead, t } = useDemo();
  const icons: Record<string, typeof Bell> = {
    schedule: CalendarDays,
    claim: CircleCheck,
    reminder: Bell,
    account: Info,
  };
  return (
    <>
      <Notice>
        {t(
          'Sample notifications · No SMS or push service is connected.',
          'Sample nga pahibalo · Wala pay SMS o push service.',
        )}
      </Notice>
      {notices.map((notice) => {
        const Icon = icons[notice.kind];
        return (
          <Pressable
            accessibilityRole="button"
            key={notice.id}
            onPress={() => {
              markRead(notice.id);
              go('notification-details', { id: notice.id });
            }}
          >
            <Card style={{ padding: 16, gap: 8 }}>
              <View style={[styles.row, { alignItems: 'flex-start' }]}>
                <Icon
                  size={19}
                  color={
                    notice.kind === 'claim'
                      ? c.green
                      : notice.kind === 'reminder'
                        ? c.amber
                        : c.primary
                  }
                />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={styles.row}>
                    <Txt variant="label" style={{ flex: 1 }}>
                      {t(notice.title, notice.titleBs)}
                    </Txt>
                    {!readNotifications.includes(notice.id) && (
                      <View
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 4,
                          backgroundColor: c.primary,
                        }}
                      />
                    )}
                  </View>
                  <Txt variant="small">{t(notice.body, notice.bodyBs)}</Txt>
                  <Txt variant="small" style={{ fontSize: 10 }}>
                    {notice.date}
                  </Txt>
                </View>
              </View>
            </Card>
          </Pressable>
        );
      })}
    </>
  );
}
function NotificationDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useDemo();
  const notice = notices.find((item) => item.id === id);
  if (!notice)
    return (
      <Notice>{t('Notification unavailable.', 'Dili magamit nga pahibalo.')}</Notice>
    );
  return (
    <>
      <Badge>{t('Sample notification', 'Sample nga pahibalo')}</Badge>
      <Txt variant="title">{t(notice.title, notice.titleBs)}</Txt>
      <Txt variant="small">{notice.date}</Txt>
      <Card>
        <Txt>{t(notice.body, notice.bodyBs)}</Txt>
      </Card>
      <Button
        onPress={() =>
          notice.kind === 'claim' ? router.replace('/(tabs)/wallet') : go('schedule')
        }
      >
        {notice.kind === 'claim'
          ? t('View my wallet', 'Tan-awa akong wallet')
          : t('View claiming schedule', 'Tan-awa ang iskedyul')}
      </Button>
    </>
  );
}

function Recovery() {
  const { phone, t } = useDemo();
  const [value, setValue] = useState(phone);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  return (
    <>
      <View style={{ alignItems: 'center', gap: 12, paddingVertical: 12 }}>
        <ShieldCheck size={34} color={c.primary} />
        <Txt variant="heading">
          {t('Recover your account', 'Irecover ang imong account')}
        </Txt>
        <Txt variant="small" style={{ textAlign: 'center' }}>
          {t(
            'Enter the mobile number linked to your beneficiary account.',
            'Isulod ang numero nga nalambigit sa imong beneficiary account.',
          )}
        </Txt>
      </View>
      <PhoneField
        value={value}
        onChangeText={(s) => {
          setValue(s);
          setError('');
          setSent(false);
        }}
        error={error}
      />
      <Notice>
        {sent
          ? t(
              'Preview only: your request was validated. No recovery code was sent.',
              'Preview lamang: naverify ang request. Walay recovery code gipadala.',
            )
          : t(
              'When connected, a 6-digit verification code will be sent to your registered contact.',
              'Kon konektado na, ipadala ang 6 ka numero nga code sa imong rehistradong numero.',
            )}
      </Notice>
      <Button
        onPress={() => {
          if (!/^9\d{9}$/.test(value)) {
            setError(
              t(
                'Enter a 10-digit number starting with 9.',
                'Isulod ang 10 ka numero nga nagsugod sa 9.',
              ),
            );
            return;
          }
          setSent(true);
        }}
      >
        {t('Send verification code', 'Ipadala ang verification code')}
      </Button>
      <Button variant="outline" onPress={() => router.replace('/flow/login')}>
        {t('Back to login', 'Balik sa login')}
      </Button>
      <Txt variant="small" style={{ textAlign: 'center' }}>
        {t(
          'Account recovery requires the authentication backend.',
          'Kinahanglan ang authentication backend aron marecover ang account.',
        )}
      </Txt>
    </>
  );
}
function EditProfile() {
  const { beneficiary, t } = useDemo();
  const [serviceArea, setServiceArea] = useState<string | null>(null);
  useEffect(() => {
    if (!beneficiary) return;
    let active = true;
    setServiceArea(null);
    getBarangays()
      .then((barangays) => {
        const barangay = barangays.find((item) => item.id === beneficiary.barangayId);
        if (active) {
          setServiceArea(
            barangay
              ? `${barangay.barangayName}, ${barangay.city}, ${barangay.province}`
              : '',
          );
        }
      })
      .catch(() => {
        if (active) setServiceArea('');
      });
    return () => {
      active = false;
    };
  }, [beneficiary]);
  if (!beneficiary) {
    return (
      <Notice tone="error">
        {t(
          'Your saved profile could not be loaded. Return to Profile and try again.',
          'Wala ma-load ang imong profile. Balik sa Profile ug sulayi pag-usab.',
        )}
      </Notice>
    );
  }
  const fullName = [beneficiary.firstName, beneficiary.middleName, beneficiary.lastName]
    .filter(Boolean)
    .join(' ');
  const birthDate = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${beneficiary.birthDate}T00:00:00Z`));
  const sex = {
    female: t('Female', 'Babaye'),
    male: t('Male', 'Lalaki'),
    prefer_not_to_say: t('Prefer not to say', 'Dili isulti'),
  }[beneficiary.sex] ?? beneficiary.sex;
  return (
    <>
      <Badge tone={beneficiary.isVerified ? 'success' : 'warning'}>
        {beneficiary.isVerified
          ? t('Verified account', 'Naverify nga account')
          : t('Verification pending', 'Naghulat sa verification')}
      </Badge>
      <Card>
        <DetailRow label={t('Full name', 'Kompletong ngalan')} value={fullName} />
        <DetailRow label={t('Birth date', 'Petsa sa pagkatawo')} value={birthDate} />
        <DetailRow label={t('Sex', 'Sekso')} value={sex} />
        <DetailRow label={t('Mobile number', 'Numero sa cellphone')} value={beneficiary.contactNumber} />
        <DetailRow label={t('House no. and street', 'Numero sa balay ug dalan')} value={beneficiary.address} />
        <DetailRow
          label={t('Barangay and city', 'Barangay ug siyudad')}
          value={
            serviceArea === null
              ? t('Loading service area…', 'Nag-load sa service area…')
              : serviceArea || t('Unavailable', 'Dili magamit')
          }
        />
        <DetailRow
          label={t('Account status', 'Kahimtang sa account')}
          value={beneficiary.status.charAt(0).toUpperCase() + beneficiary.status.slice(1)}
        />
      </Card>
      <Notice>
        {t(
          'These details come from your saved beneficiary record. Contact your facilitator to request an official correction.',
          'Kini nga mga detalye gikan sa natipig nga beneficiary record. Kontaka ang facilitator aron mangayo og opisyal nga koreksyon.',
        )}
      </Notice>
      <Button onPress={() => go('support')}>
        {t('Request a correction', 'Mangayo og koreksyon')}
      </Button>
    </>
  );
}
function Password() {
  const { t } = useDemo();
  return (
    <>
      <Logo size={38} />
      <Txt variant="title">{t('Secure your account', 'Siguroha ang imong account')}</Txt>
      <Notice>
        {t(
          'This design uses phone-number login codes. Password changes will be available if your team adds password authentication to the backend.',
          'Kini nga design naggamit sa phone login codes. Magamit ang pag-usab sa password kon idugang sa backend.',
        )}
      </Notice>
      <Button onPress={() => go('reset-password')}>
        {t('Recover my account', 'Irecover akong account')}
      </Button>
    </>
  );
}
function NotificationSettings() {
  const { t } = useDemo();
  const [sms, setSms] = useState(true);
  const [push, setPush] = useState(true);
  return (
    <>
      <Card>
        {[
          {
            label: t('SMS schedule reminders', 'SMS nga pahinumdom'),
            value: sms,
            set: setSms,
          },
          {
            label: t('App notifications', 'Mga pahibalo sa app'),
            value: push,
            set: setPush,
          },
        ].map(({ label, value, set }) => (
          <View key={label} style={[styles.row, { justifyContent: 'space-between' }]}>
            <Txt variant="label" style={{ flex: 1 }}>
              {label}
            </Txt>
            <Switch
              accessibilityLabel={label}
              value={value}
              onValueChange={set}
              trackColor={{ false: c.outline, true: c.primary }}
              thumbColor={c.card}
            />
          </View>
        ))}
      </Card>
      <Notice>
        {t(
          'Preview preferences only. No notifications are sent, and settings reset when this screen closes.',
          'Mga gusto sa preview lamang. Walay pahibalo ipadala; mareset kon sirad-an ang screen.',
        )}
      </Notice>
    </>
  );
}

function EnrollmentStatus() {
  const { overview, overviewLoading, overviewError, refreshOverview, t } = useDemo();
  if (overviewLoading) {
    return <Notice>{t('Loading your enrollment…', 'Nag-load sa imong enrollment…')}</Notice>;
  }
  if (overviewError) {
    return (
      <>
        <Notice tone="error">
          {t('Your enrollment could not be loaded.', 'Wala ma-load ang imong enrollment.')}
        </Notice>
        <Button onPress={() => void refreshOverview()}>{t('Try again', 'Sulayi pag-usab')}</Button>
      </>
    );
  }
  const enrollments = overview?.enrollments ?? [];
  if (enrollments.length === 0) {
    return (
      <>
        <Notice>
          {t(
            'No program enrollment is recorded for your account yet.',
            'Wala pay program enrollment nga narehistro sa imong account.',
          )}
        </Notice>
        <Button variant="outline" onPress={() => go('support')}>
          {t('Contact facilitator', 'Kontaka ang facilitator')}
        </Button>
      </>
    );
  }
  return (
    <>
      {enrollments.map((enrollment) => {
        const approved = enrollment.status === 'approved' || enrollment.status === 'active';
        const rejected = enrollment.status === 'rejected';
        return (
          <Card key={enrollment.id}>
            <View
              style={[
                styles.row,
                { justifyContent: 'space-between', alignItems: 'flex-start' },
              ]}
            >
              <Txt variant="label" style={{ flex: 1 }}>
                {enrollment.program.name}
              </Txt>
              <Badge tone={approved ? 'success' : rejected ? 'error' : 'warning'}>
                {formatStatus(enrollment.status)}
              </Badge>
            </View>
            <DetailRow
              label={t('Program code', 'Code sa programa')}
              value={enrollment.program.code}
            />
            <DetailRow
              label={t('Enrollment date', 'Petsa sa enrollment')}
              value={formatDate(enrollment.enrollmentDate)}
            />
            <DetailRow
              label={t('Grant amount', 'Kantidad sa ayuda')}
              value={peso(enrollment.program.grantAmount)}
            />
          </Card>
        );
      })}
      <Notice>
        {t(
          'These statuses come from your saved program enrollment records.',
          'Kini nga mga status gikan sa imong natipig nga program enrollment records.',
        )}
      </Notice>
      <Button variant="outline" onPress={() => go('support')}>
        {t('Contact DSWD', 'Kontaka ang DSWD')}
      </Button>
      <Button variant="outline" onPress={() => void refreshOverview()}>
        {t('Refresh status', 'I-refresh ang status')}
      </Button>
    </>
  );
}
function EnrollmentDocuments() {
  const { t } = useDemo();
  const [file, setFile] = useState('');
  const [error, setError] = useState('');
  const pick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (!result.canceled) {
        const selected = result.assets[0];
        if ((selected.size || 0) > 10 * 1024 * 1024) {
          setError(
            t('Choose a file smaller than 10 MB.', 'Pagpili og file nga ubos sa 10 MB.'),
          );
          return;
        }
        setFile(selected.name);
        setError('');
      }
    } catch {
      setError(
        t(
          'Could not select a file. Try again.',
          'Dili makapili og file. Sulayi pag-usab.',
        ),
      );
    }
  };
  return (
    <>
      <Badge>{t('Needs documents', 'Kinahanglan og dokumento')}</Badge>
      <Txt variant="heading">
        {t('Your application needs attention', 'Kinahanglan og pagtagad ang aplikasyon')}
      </Txt>
      <Txt variant="small">
        {t(
          'A facilitator must validate the missing requirement before approval.',
          'Kinahanglan ivalidate sa facilitator ang kulang sa dili pa aprubahan.',
        )}
      </Txt>
      <Card>
        <DetailRow
          icon={FileText}
          label={t('Proof of residence', 'Pamatuod sa pinuy-anan')}
          value={t('Status: Missing or unreadable', 'Kahimtang: Kulang o dili mabasa')}
        />
        <Txt variant="small">
          {t(
            'Bring the original document to your barangay or assigned DSWD facilitator.',
            'Dad-a ang orihinal nga dokumento sa barangay o sa DSWD facilitator.',
          )}
        </Txt>
      </Card>
      <Notice>
        {t(
          'Local file selection is available for this preview. Files are not uploaded or submitted to staff.',
          'Makapili og lokal nga file sa preview. Dili i-upload o isumite sa staff.',
        )}
      </Notice>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {file ? (
        <Notice tone="success">
          {t('Selected locally: ', 'Napili sa lokal: ')}
          {file}
        </Notice>
      ) : null}
      <Button icon={FileText} onPress={pick}>
        {t('Choose sample document', 'Pagpili og sample nga dokumento')}
      </Button>
      <Button variant="outline" onPress={() => go('support')}>
        {t('Contact facilitator', 'Kontaka ang facilitator')}
      </Button>
      <Button variant="outline" onPress={() => go('enrollment-status')}>
        {t('View application status', 'Tan-awa ang kahimtang')}
      </Button>
    </>
  );
}
function Privacy() {
  const { consentGiven, setConsentGiven, setFaceEnrolled, t } = useDemo();
  const [revoked, setRevoked] = useState(false);
  return (
    <>
      <Card>
        <DetailRow
          icon={ShieldCheck}
          label={t('Face verification consent', 'Pagtugot sa face verification')}
          value={
            consentGiven
              ? t('Given in this preview', 'Gihatag sa preview')
              : t('Not given', 'Wala gihatag')
          }
        />
        <Txt variant="small">
          {t(
            'Face verification is optional. You may continue with your phone number.',
            'Opsyonal ang face verification. Pwede mopadayon gamit ang numero.',
          )}
        </Txt>
      </Card>
      <Notice>
        {t(
          'This preview keeps profile changes in memory and does not upload face photos. A production privacy notice and retention policy must be supplied before connecting the biometric service.',
          'Ang preview nagtipig sa kausaban sa memory ug dili mo-upload sa nawong. Kinahanglan ang privacy notice sa dili pa ikonektar ang biometric service.',
        )}
      </Notice>
      {revoked && (
        <Notice tone="success">
          {t(
            'Your preview consent has been withdrawn.',
            'Nabawi na ang pagtugot sa preview.',
          )}
        </Notice>
      )}
      <Button
        variant="outline"
        disabled={!consentGiven}
        onPress={() => {
          setConsentGiven(false);
          setFaceEnrolled(false);
          setRevoked(true);
        }}
      >
        {t('Withdraw face consent', 'Bawion ang pagtugot')}
      </Button>
      <Button onPress={() => flow('consent')}>
        {t('Review consent notice', 'Basaha ang pagtugot')}
      </Button>
    </>
  );
}

function Exception({ kind }: { kind: 'schedule' | 'expired' }) {
  const { t } = useDemo();
  const definitions = {
    schedule: {
      badge: t('Rescheduled', 'Nausab ang iskedyul'),
      title: t('Your claiming schedule changed', 'Nausab ang iskedyul sa pag-claim'),
      body: t(
        'This sample shows how a schedule update will appear. Your assigned time is displayed below.',
        'Kini nga sample nagpakita sa nausab nga iskedyul. Tan-awa ang oras sa ubos.',
      ),
      tone: 'warning' as const,
    },
    expired: {
      badge: t('EXPIRED', 'EXPIRED'),
      title: t('This QR pass has expired', 'Na-expire na ang QR pass'),
      body: t(
        'Request a new pass or ask staff for help. This is a preview of the expired state.',
        'Paghangyo og bag-ong pass o tabang sa staff. Preview kini sa expired nga pass.',
      ),
      tone: 'error' as const,
    },
  };
  const item = definitions[kind];
  return (
    <>
      <Badge tone={item.tone}>{item.badge}</Badge>
      <Txt variant="title">{item.title}</Txt>
      <Notice tone={item.tone}>{item.body}</Notice>
      {kind === 'schedule' && (
        <Card>
          <DetailRow icon={CalendarDays} label={t('Date', 'Petsa')} value={a.date} />
          <DetailRow icon={Clock3} label={t('Time', 'Oras')} value={a.time} />
          <DetailRow icon={MapPin} label={t('Venue', 'Lugar')} value={a.venue} />
        </Card>
      )}
      <Button onPress={() => (kind === 'schedule' ? go('schedule') : go('support'))}>
        {kind === 'schedule'
          ? t('View updated schedule', 'Tan-awa ang iskedyul')
          : t('Contact staff', 'Kontaka ang staff')}
      </Button>
      <Button variant="outline" onPress={() => go('qr-pass')}>
        {t('Back to QR pass', 'Balik sa QR pass')}
      </Button>
    </>
  );
}
function Support() {
  const { t } = useDemo();
  return (
    <>
      <View style={{ alignItems: 'center', paddingVertical: 16, gap: 14 }}>
        <MessageCircle size={46} color={c.primary} />
        <Txt variant="title">
          {t('Get help from staff', 'Pangayo og tabang sa staff')}
        </Txt>
      </View>
      <Card>
        <Txt variant="label">{a.venue}</Txt>
        <Txt>
          {t(
            'Visit your barangay facilitator for schedule, enrollment, or verification concerns.',
            'Duola ang barangay facilitator bahin sa iskedyul, enrollment, o pagverify.',
          )}
        </Txt>
      </Card>
      <Notice>
        {t(
          'Support preview only. No message or request has been sent. Staff contact details and escalation need the team’s backend.',
          'Support preview lamang. Walay mensahe o request gipadala. Kinahanglan ang backend alang sa staff contact ug escalation.',
        )}
      </Notice>
      <Button onPress={() => router.replace('/(tabs)/help')}>
        {t('Back to Help', 'Balik sa Tabang')}
      </Button>
    </>
  );
}
function FaceLogin() {
  const { t } = useDemo();
  return (
    <>
      <View style={{ alignItems: 'center', gap: 20, paddingVertical: 24 }}>
        <ScanFace size={72} color={c.primary} />
        <Txt variant="title">{t('Login with Face', 'Log in pinaagi sa Nawong')}</Txt>
      </View>
      <Notice>
        {t(
          'Face login requires the biometric service and authentication API. Use the demo phone login to explore the app.',
          'Kinahanglan ang biometric service ug authentication API. Gamita ang demo phone login aron masulayan ang app.',
        )}
      </Notice>
      <Button onPress={() => router.replace('/flow/login')}>
        {t('Use phone number', 'Gamita ang numero')}
      </Button>
    </>
  );
}
