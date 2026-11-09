import React, { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Badge, Button, Card, DetailRow, flow, Notice, Page, Txt } from '../components';
import { ApiRequestError, type BiometricOverview } from '../api';
import { useDemo } from '../state';
import { formatDateTime } from '../format';

function enrollmentLabel(data: BiometricOverview, t: (en: string, bs: string) => string) {
  if (!data.profile) return t('Awaiting staff capture', 'Nagpaabot sa pagkuha sa staff');
  const labels: Record<string, string> = {
    enrolled: data.profile.simulated ? t('Enrolled · simulation', 'Naenroll · simulation') : t('Enrolled', 'Naenroll'),
    revoked: t('Consent withdrawn', 'Nabawi ang pagtugot'),
    expired: t('Enrollment expired', 'Na-expire ang enrollment'),
    consent_required: t('Consent required', 'Kinahanglan og pagtugot'),
    pending_duplicate_review: t('Staff review pending', 'Nagpaabot sa pagsusi sa staff'),
    duplicate_blocked: t('Enrollment blocked · contact staff', 'Gibabagan ang enrollment · kontaka ang staff'),
  };
  return labels[data.profile.status] ?? t('Contact staff', 'Kontaka ang staff');
}

export function BiometricSummary() {
  const { biometrics: data, biometricsLoading, biometricsError, refreshBiometrics, t } = useDemo();
  return <Card>
    <Txt variant="heading">{t('Face verification', 'Pag-verify sa nawong')}</Txt>
    {biometricsError ? <>
      <Notice tone="error">{t('Face verification status could not be loaded.', 'Wala makuha ang kahimtang sa face verification.')}</Notice>
      <Button variant="outline" onPress={() => void refreshBiometrics()}>{t('Try again', 'Sulayi pag-usab')}</Button>
    </> : biometricsLoading ? <Txt>{t('Loading saved status…', 'Gikuha ang natipig nga kahimtang…')}</Txt>
      : data ? <Badge tone={data.profile?.status === 'enrolled' && !data.profile.simulated && data.profile.processorCompatible ? 'success' : 'warning'}>{enrollmentLabel(data, t)}</Badge> : <Txt>{t('Status unavailable', 'Dili makuha ang kahimtang')}</Txt>}
    <Txt variant="small">{t('Review consent here. Your barangay facilitator captures your face in person.', 'Basaha dinhi ang pagtugot. Ang barangay facilitator mokuha sa imong nawong sa personal.')}</Txt>
    <Button variant="outline" onPress={() => flow('capture')}>{t('View face verification', 'Tan-awa ang face verification')}</Button>
  </Card>;
}

function SavedStatus() {
  const { biometrics: data, biometricsLoading, biometricsError, biometricsSaving, refreshBiometrics, t } = useDemo();
  return <>
    {biometricsError ? <Notice tone="error">{t('Saved status is unavailable. Refresh before making changes.', 'Dili makuha ang natipig nga kahimtang. I-refresh sa dili pa mag-usab.')}</Notice>
      : biometricsLoading ? <Notice>{t('Loading saved status…', 'Gikuha ang natipig nga kahimtang…')}</Notice>
      : !data ? <Notice>{t('Connect to the shared server to view your saved consent and enrollment.', 'Konektaha sa shared server aron makita ang natipig nga pagtugot ug enrollment.')}</Notice> : <>
        <Card>
          <Txt variant="heading">{enrollmentLabel(data, t)}</Txt>
          <DetailRow label={t('Consent', 'Pagtugot')} value={data.consent?.status === 'active' ? t('Given', 'Gihatag')
            : data.consent?.status === 'revoked' ? t('Withdrawn', 'Nabawi') : data.consent?.status === 'expired' ? t('Expired', 'Na-expire') : t('Not given', 'Wala gihatag')} />
          {data.consent && <>
            <DetailRow label={t('Notice version', 'Bersyon sa pahibalo')} value={data.consent.version} />
            <DetailRow label={t('Retention until', 'Tipigan hangtod')} value={formatDateTime(data.consent.retentionUntil)} />
          </>}
          {data.profile && <>
            <DetailRow label={t('Staff enrollment recorded', 'Narekord nga enrollment sa staff')} value={formatDateTime(data.profile.enrolledAt)} />
            {data.profile.lastVerifiedAt && <DetailRow label={t('Last verified', 'Kataposang pag-verify')} value={formatDateTime(data.profile.lastVerifiedAt)} />}
          </>}
        </Card>
        {(data.processorMode === 'simulated' || data.profile?.simulated) && <Notice tone="warning">{t('Simulation only. Saved consent and enrollment records can be tested; real face matching is not active.', 'Simulation lamang. Masulayan ang natipig nga pagtugot ug enrollment; dili pa aktibo ang tinuod nga face matching.')}</Notice>}
        {data.profile && !data.profile.processorCompatible && <Notice tone="warning">{t('This enrollment uses a different face model. Ask your facilitator about enrollment with the current model.', 'Lahi ang face model niini nga enrollment. Pangutan-a ang facilitator bahin sa enrollment gamit ang kasamtangang model.')}</Notice>}
      </>}
    <Button variant="outline" loading={biometricsLoading} disabled={biometricsSaving} onPress={() => void refreshBiometrics()}>{t('Refresh status', 'I-refresh ang kahimtang')}</Button>
  </>;
}

export function BiometricConsentScreen() {
  const { biometrics: data, biometricsLoading, biometricsError, biometricsSaving, refreshBiometrics, giveConsent, t } = useDemo();
  const [error, setError] = useState('');
  const pending = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; void refreshBiometrics(); return () => { mounted.current = false; }; }, []);
  const active = data?.consent?.status === 'active';
  return <Page title={t('Face verification consent', 'Pagtugot sa face verification')}>
    <Txt variant="title">{t('Your choice, saved securely', 'Imong pagpili, luwas nga gitipigan')}</Txt>
    <Txt>{t('Face enrollment is optional. You can still sign in with your phone number. Staff will explain the identity checks allowed at your claiming event.', 'Opsyonal ang face enrollment. Makasulod gihapon ka gamit ang imong numero. Ipasabot sa staff ang mga identity check nga gitugotan sa imong claiming event.')}</Txt>
    <Card>
      <Txt variant="label">{t('What you agree to', 'Ang imong gitugotan')}</Txt>
      <Txt>{t('Your barangay facilitator captures your face and checks that you are present. The service creates an encrypted face template for identity checks and duplicate enrollment review. This app does not capture your face.', 'Ang barangay facilitator mokuha sa imong nawong ug mosusi nga anaa ka. Ang serbisyo mohimo og encrypted face template alang sa identity check ug pagsusi sa dobleng enrollment. Kini nga app dili mokuha sa imong nawong.')}</Txt>
      <Txt>{t('You can withdraw consent in Security & Privacy. This stops use of the linked face enrollment. Contact authorized staff about permanent deletion and any retained audit records.', 'Mabawi nimo ang pagtugot sa Seguridad ug Privacy. Mohunong ang paggamit sa nalambigit nga face enrollment. Kontaka ang awtorisadong staff bahin sa permanenteng pagtangtang ug mga audit record.')}</Txt>
      {data && <>
        <DetailRow label={t('Notice version', 'Bersyon sa pahibalo')} value={data.policy.version} />
        <DetailRow label={t('Retention until', 'Tipigan hangtod')} value={formatDateTime(active ? data.consent!.retentionUntil : data.policy.retentionUntil)} />
        <Txt variant="small">{t('A new consent lasts up to one year. Staff must renew enrollment after consent expires.', 'Ang bag-ong pagtugot molungtad hangtod usa ka tuig. Kinahanglan i-renew sa staff ang enrollment human ma-expire ang pagtugot.')}</Txt>
      </>}
    </Card>
    {biometricsError || !data ? <Notice tone="error">{t('The consent notice could not be loaded. Refresh to try again.', 'Wala makuha ang pahibalo sa pagtugot. I-refresh aron sulayan pag-usab.')}</Notice> : null}
    {data?.processorMode === 'simulated' && <Notice tone="warning">{t('The current service is a simulation. Real face matching is not active.', 'Simulation ang kasamtangang serbisyo. Dili pa aktibo ang tinuod nga face matching.')}</Notice>}
    {active && <Notice tone="success">{t('Your consent is already saved. Continue to see your staff enrollment status.', 'Natipig na ang imong pagtugot. Padayon aron makita ang kahimtang sa enrollment sa staff.')}</Notice>}
    {!!error && <Notice tone="error">{error}</Notice>}
    <Button loading={biometricsSaving || biometricsLoading} disabled={!data || biometricsError} onPress={async () => {
      if (!data || pending.current) return;
      if (active) { flow('capture'); return; }
      pending.current = true; setError('');
      try {
        const saved = await giveConsent({ consentVersion: data.policy.version, retentionUntil: data.policy.retentionUntil, expectedConsentId: data.consent?.id ?? null });
        if (saved && mounted.current) flow('capture');
      } catch (cause) {
        if (mounted.current) setError(cause instanceof ApiRequestError && cause.status === 409
          ? t('Consent changed. Refresh and review the notice again.', 'Nausab ang pagtugot. I-refresh ug basaha pag-usab ang pahibalo.')
          : t('Consent could not be saved. Try again.', 'Wala matipig ang pagtugot. Sulayi pag-usab.'));
      } finally { pending.current = false; }
    }}>{active ? t('View enrollment status', 'Tan-awa ang enrollment') : t('Agree and save consent', 'Motugot ug tipigi ang pagtugot')}</Button>
    <Button variant="outline" loading={biometricsLoading} disabled={biometricsSaving} onPress={() => void refreshBiometrics()}>{t('Refresh notice', 'I-refresh ang pahibalo')}</Button>
    <Button variant="outline" disabled={biometricsSaving} onPress={() => router.replace('/(tabs)/home')}>{t('Not now', 'Dili karon')}</Button>
  </Page>;
}

export function BiometricEnrollmentScreen() {
  const { refreshBiometrics, t } = useDemo();
  useEffect(() => { void refreshBiometrics(); }, []);
  return <Page title={t('Face verification', 'Pag-verify sa nawong')}>
    <Txt variant="title">{t('Enrollment with your facilitator', 'Enrollment uban sa facilitator')}</Txt>
    <Txt>{t('After saving consent, visit your barangay facilitator for face capture. This page shows the record saved by staff.', 'Human matipig ang pagtugot, bisitaha ang barangay facilitator aron kuhaan sa nawong. Kini nga pahina nagpakita sa rekord nga gitipigan sa staff.')}</Txt>
    <SavedStatus />
    <Button onPress={() => flow('consent')}>{t('Review consent', 'Basaha ang pagtugot')}</Button>
    <Button variant="outline" onPress={() => router.replace('/(tabs)/home')}>{t('Back to home', 'Balik sa home')}</Button>
  </Page>;
}

export function BiometricPrivacy() {
  const { biometrics: data, biometricsLoading, biometricsError, biometricsSaving, refreshBiometrics, withdrawConsent, t } = useDemo();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const pending = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; void refreshBiometrics(); return () => { mounted.current = false; }; }, []);
  return <>
    <SavedStatus />
    <Notice>{t('Withdrawing consent stops use of the linked face enrollment. Your phone sign-in remains available. Contact authorized staff about permanent deletion.', 'Ang pagbawi sa pagtugot mopahunong sa paggamit sa nalambigit nga face enrollment. Magamit gihapon ang pagsulod pinaagi sa numero. Kontaka ang awtorisadong staff bahin sa permanenteng pagtangtang.')}</Notice>
    {!!error && <Notice tone="error">{error}</Notice>}
    {confirmId ? <Card>
      <Txt variant="label">{t('Withdraw face consent?', 'Bawion ang pagtugot sa nawong?')}</Txt>
      <Txt>{t('Staff will need new consent and enrollment before using face verification again.', 'Kinahanglan sa staff ang bag-ong pagtugot ug enrollment sa dili pa magamit pag-usab ang face verification.')}</Txt>
      <Button loading={biometricsSaving} disabled={biometricsLoading || biometricsError || data?.consent?.id !== confirmId} onPress={async () => {
        if (pending.current) return;
        pending.current = true; setError('');
        try { if (await withdrawConsent(confirmId) && mounted.current) setConfirmId(null); }
        catch { if (mounted.current) setError(t('Withdrawal could not be confirmed. Refresh status before trying again.', 'Wala makumpirma ang pagbawi. I-refresh ang kahimtang sa dili pa sulayan pag-usab.')); }
        finally { pending.current = false; }
      }}>{t('Confirm withdrawal', 'Kumpirmaha ang pagbawi')}</Button>
      <Button variant="outline" disabled={biometricsSaving} onPress={() => setConfirmId(null)}>{t('Keep consent', 'Ipadayon ang pagtugot')}</Button>
    </Card> : <Button variant="outline" disabled={data?.consent?.status !== 'active' || biometricsLoading || biometricsError || biometricsSaving} onPress={() => { setError(''); setConfirmId(data!.consent!.id); }}>{t('Withdraw face consent', 'Bawion ang pagtugot')}</Button>}
    <Button onPress={() => flow('consent')}>{t('Review consent notice', 'Basaha ang pahibalo sa pagtugot')}</Button>
  </>;
}
