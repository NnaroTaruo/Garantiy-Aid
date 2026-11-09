import React, { useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import { Button, Card, Notice, Txt } from '../components';
import { ApiRequestError, getPushDevice, type PushDeviceState } from '../api';
import { disablePhoneAlerts, enablePhoneAlerts, pushAvailability, pushPermission, PushSetupError, type PushPermission } from '../push';
import { useDemo } from '../state';
import { colors as c } from '../theme';

type Problem = '' | 'load' | 'denied' | 'blocked' | 'token' | 'server' | 'connection';

export function PhoneAlerts() {
  const { accessToken, beneficiary, language, reset, t } = useDemo();
  const availability = pushAvailability();
  const [device, setDevice] = useState<PushDeviceState | null>(null);
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [loading, setLoading] = useState(availability === 'ready');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>('');
  const mounted = useRef(true), working = useRef(false), request = useRef(0);
  useEffect(() => {
    mounted.current = true;
    if (availability === 'ready') void load();
    return () => { mounted.current = false; ++request.current; };
  }, []);

  async function failed(cause: unknown, fallback: Problem) {
    if (!mounted.current) return;
    if (cause instanceof ApiRequestError && cause.status === 401) { await reset(); return; }
    if (cause instanceof PushSetupError) setProblem(cause.reason === 'unavailable' ? 'server' : cause.reason);
    else if (cause instanceof ApiRequestError && cause.code === 'PUSH_UNAVAILABLE') {
      setDevice({ configured: false, status: 'unavailable', enabled: false, language: null, updatedAt: null });
      setProblem('');
    } else setProblem(fallback);
  }
  async function load() {
    if (working.current) return;
    const id = ++request.current;
    setLoading(true); setProblem('');
    try {
      const [state, allowed] = await Promise.all([getPushDevice(accessToken), pushPermission().catch(() => null)]);
      if (mounted.current && id === request.current) { setDevice(state); setPermission(allowed); }
    } catch (cause) { if (id === request.current) await failed(cause, 'load'); }
    finally { if (mounted.current && id === request.current) setLoading(false); }
  }
  async function change(on: boolean) {
    if (working.current || loading || !beneficiary) return;
    working.current = true; ++request.current;
    setBusy(true); setProblem('');
    try {
      const state = on ? await enablePhoneAlerts(accessToken, beneficiary.id, language) : await disablePhoneAlerts(accessToken);
      if (mounted.current) { setDevice(state); setPermission(on ? 'granted' : permission); }
    } catch (cause) { await failed(cause, 'connection'); }
    finally { working.current = false; if (mounted.current) setBusy(false); }
  }

  const heading = <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <Bell size={20} color={c.primary} />
    <Txt variant="label" style={{ flex: 1 }}>{t('Phone alerts', 'Mga alerto sa cellphone')}</Txt>
  </View>;
  const about = <Txt variant="small">{t(
    'Get a short alert on this phone when your account has a new update. Alerts never show your name, programs or amounts. Open the app to read the details.',
    'Makadawat og mubo nga alerto niining cellphone kon adunay bag-ong update ang imong account. Dili makita sa alerto ang imong ngalan, programa o kantidad. Ablihi ang app aron mabasa ang detalye.')}</Txt>;
  const status = (tone: 'info' | 'warning' | 'error' | 'success', text: string) =>
    <View accessibilityRole="alert" accessibilityLiveRegion="polite"><Notice tone={tone}>{text}</Notice></View>;

  if (availability !== 'ready') {
    const reasons: Record<Exclude<typeof availability, 'ready'>, string> = {
      web: t('Phone alerts work in the GarantiyAid Android app. In this browser preview, check Notifications for new updates.',
        'Ang mga alerto sa cellphone molihok sa GarantiyAid Android app. Niining browser preview, tan-awa ang Mga pahibalo alang sa bag-ong update.'),
      unsupported: t('Phone alerts are available on Android only for now. Check Notifications for new updates.',
        'Sa Android lamang magamit karon ang mga alerto sa cellphone. Tan-awa ang Mga pahibalo alang sa bag-ong update.'),
      'expo-go': t('Phone alerts need the GarantiyAid development or release app. Expo Go cannot receive them. Check Notifications for new updates.',
        'Kinahanglan ang GarantiyAid development o release app alang sa mga alerto. Dili kini madawat sa Expo Go. Tan-awa ang Mga pahibalo alang sa bag-ong update.'),
      unconfigured: t('This copy of the app is not set up for phone alerts yet. Ask the GarantiyAid team for an updated app. Notifications still work.',
        'Kining kopya sa app wala pa ma-set up alang sa mga alerto. Pangayo og bag-ong app sa GarantiyAid team. Molihok gihapon ang Mga pahibalo.'),
    };
    return <Card>{heading}<Notice>{reasons[availability]}</Notice></Card>;
  }

  const on = device?.status === 'on';
  const problems: Record<Exclude<Problem, ''>, string> = {
    load: t('Phone alert status could not be loaded. Check your connection and try again.', 'Wala makuha ang kahimtang sa alerto. Susihon ang koneksyon ug sulayi pag-usab.'),
    denied: t('Notifications were not allowed, so phone alerts are still off. You can try again.', 'Wala gitugotan ang mga notification, busa naka-off gihapon ang alerto. Mahimo nimo kining sulayan pag-usab.'),
    blocked: t('Android is blocking notifications for GarantiyAid. Allow them in Android settings, then try again.', 'Gibabagan sa Android ang mga notification sa GarantiyAid. Tugoti kini sa Android settings, dayon sulayi pag-usab.'),
    token: t('This phone could not be set up for alerts. Check your internet connection and try again.', 'Wala ma-set up kining cellphone alang sa alerto. Susihon ang internet ug sulayi pag-usab.'),
    server: t('Phone alerts are not set up on this server yet. Your in-app updates still work.', 'Wala pa ma-set up ang alerto niining server. Molihok gihapon ang imong mga update sa app.'),
    connection: t('We could not confirm the change. Check your connection and try again.', 'Wala makumpirma ang kausaban. Susihon ang koneksyon ug sulayi pag-usab.'),
  };
  const settings = <Button variant="outline" disabled={busy} onPress={() => void Linking.openSettings()}>{t('Open Android settings', 'Ablihi ang Android settings')}</Button>;
  return <Card>
    {heading}
    {about}
    {loading && status('info', t('Checking phone alerts…', 'Gisusi ang mga alerto sa cellphone…'))}
    {!loading && device?.status === 'unavailable' && status('info', problems.server)}
    {!loading && on && permission !== 'granted' && permission !== null && <>
      {status('warning', t('Phone alerts are on, but Android is blocking notifications for GarantiyAid. Allow them in Android settings.', 'Naka-on ang alerto, apan gibabagan sa Android ang mga notification sa GarantiyAid. Tugoti kini sa Android settings.'))}
      {settings}
    </>}
    {!loading && on && permission === 'granted' && status('success', t('Phone alerts are on for this phone.', 'Naka-on ang mga alerto niining cellphone.'))}
    {!loading && device?.status === 'invalid' && status('warning', t('Phone alerts stopped working on this phone. Turn them on again.', 'Wala na molihok ang alerto niining cellphone. I-on kini pag-usab.'))}
    {!!problem && status(problem === 'denied' ? 'warning' : 'error', problems[problem])}
    {problem === 'blocked' && settings}
    {problem === 'load' && <Button onPress={() => void load()}>{t('Try again', 'Sulayi pag-usab')}</Button>}
    {!loading && device && device.status !== 'unavailable' && (on
      ? <Button variant="outline" loading={busy} onPress={() => void change(false)}>{t('Turn off phone alerts', 'I-off ang mga alerto sa cellphone')}</Button>
      : <Button loading={busy} disabled={!beneficiary} onPress={() => void change(true)}>
        {device.status === 'invalid' ? t('Turn on phone alerts again', 'I-on pag-usab ang mga alerto') : t('Turn on phone alerts', 'I-on ang mga alerto sa cellphone')}
      </Button>)}
  </Card>;
}
