import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  HandCoins,
  Home,
  Info,
  ShieldCheck,
  UserRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors as c, fonts } from './theme';
import { useDemo } from './state';

export function Txt({
  variant = 'body',
  style,
  ...props
}: TextProps & {
  variant?: 'body' | 'small' | 'label' | 'title' | 'heading' | 'number';
}) {
  return <RNText {...props} style={[styles.text, styles[variant], style]} />;
}
export function Logo({ size = 36, halo = false }: { size?: number; halo?: boolean }) {
  const mark = (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      accessibilityLabel="GarantiyAid shield"
    >
      <Path fill={c.navy} d="M32 3 56 12v18c0 15-11 25-24 31C19 55 8 45 8 30V12Z" />
      <Circle cx="32" cy="22" r="7" fill="#1BBD91" />
      <Path fill="#1BBD91" d="M22 37v-4c0-5 4-8 10-8s10 3 10 8v4Z" />
      <Path
        fill="#1BBD91"
        d="m17 43 8-5h13c4 0 4 5 0 5h-7v3h12l7-4c4-2 6 2 3 5l-13 7H28l-11-5Z"
      />
    </Svg>
  );
  return halo ? <View style={styles.logoHalo}>{mark}</View> : mark;
}
export function LanguageToggle({ full = false }: { full?: boolean }) {
  const { language, setLanguage } = useDemo();
  return (
    <View style={styles.language}>
      {(['en', 'bs'] as const).map((value) => (
        <Pressable
          key={value}
          accessibilityRole="button"
          accessibilityLabel={value === 'en' ? 'Switch to English' : 'Usba sa Bisaya'}
          accessibilityState={{ selected: language === value }}
          onPress={() => setLanguage(value)}
          style={[styles.languageOption, language === value && styles.languageSelected]}
        >
          <Txt
            variant="small"
            style={{
              color: language === value ? c.onPrimary : c.muted,
              fontFamily: fonts.semibold,
            }}
          >
            {full ? (value === 'en' ? 'English' : 'Bisaya') : value.toUpperCase()}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}
export function Button({
  children,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon: Icon,
  style,
}: {
  children: React.ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'green' | 'white';
  disabled?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
  style?: ViewStyle;
}) {
  const whiteInk = variant === 'primary' || variant === 'green';
  const color = whiteInk ? c.onPrimary : c.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'outline' && styles.outlineButton,
        variant === 'green' && { backgroundColor: c.green },
        variant === 'white' && { backgroundColor: c.card },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : Icon ? (
        <Icon size={18} color={color} />
      ) : null}
      <Txt variant="label" style={{ color, textAlign: 'center' }}>
        {children}
      </Txt>
    </Pressable>
  );
}
export function Header({
  title,
  back = true,
  right,
}: {
  title?: string;
  back?: boolean;
  right?: React.ReactNode;
}) {
  const { t } = useDemo();
  return (
    <View style={styles.header}>
      {back && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Go back', 'Balik')}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/(tabs)/home')
          }
          style={styles.iconButton}
        >
          <ArrowLeft size={20} color={c.text} />
        </Pressable>
      )}
      {title ? (
        <Txt variant="label" style={{ flex: 1 }}>
          {title}
        </Txt>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {right}
      <LanguageToggle />
    </View>
  );
}
export function Page({
  children,
  title,
  back,
  header = true,
  footer,
  tabs = false,
  style,
  contentStyle,
}: {
  children: React.ReactNode;
  title?: string;
  back?: boolean;
  header?: boolean;
  footer?: React.ReactNode;
  tabs?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}) {
  return (
    <SafeAreaView
      edges={tabs ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom']}
      style={[styles.page, style]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {header && <Header title={title} back={back} />}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.pageContent, contentStyle]}
          style={{ flex: 1 }}
        >
          {children}
        </ScrollView>
        {footer && <View style={styles.footer}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Notice({
  children,
  tone = 'info',
  icon: Icon = Info,
}: {
  children: React.ReactNode;
  tone?: 'info' | 'warning' | 'success' | 'error';
  icon?: LucideIcon;
}) {
  const palette = {
    info: [c.primarySoft, c.primary],
    warning: [c.amberSoft, c.amber],
    success: [c.greenSoft, c.green],
    error: [c.errorSoft, c.error],
  }[tone];
  return (
    <View style={[styles.notice, { backgroundColor: palette[0] }]}>
      <Icon size={17} color={palette[1]} />
      <Txt variant="small" style={{ flex: 1, color: palette[1] }}>
        {children}
      </Txt>
    </View>
  );
}
export function Badge({
  children,
  tone = 'warning',
}: {
  children: React.ReactNode;
  tone?: 'warning' | 'success' | 'error';
}) {
  const palette = {
    warning: [c.amberSoft, c.amber],
    success: [c.greenSoft, c.green],
    error: [c.errorSoft, c.error],
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette[0] }]}>
      <Txt variant="small" style={{ color: palette[1], fontFamily: fonts.medium }}>
        {children}
      </Txt>
    </View>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secure = false,
  keyboardType,
  autoCapitalize,
  autoComplete,
  textContentType,
  maxLength,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  error?: string;
  secure?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  maxLength?: number;
  editable?: boolean;
}) {
  const { t } = useDemo();
  return (
    <View style={{ gap: 8 }}>
      <Txt variant="label">{label}</Txt>
      <TextInput
        accessibilityLabel={error ? `${label}. ${t('Error', 'Sayop')}: ${error}` : label}
        accessibilityHint={
          error
            ? t(
                'Correct this field before continuing.',
                'Tarunga kini nga field sa dili pa mopadayon.',
              )
            : undefined
        }
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        textContentType={textContentType}
        maxLength={maxLength}
        editable={editable}
        style={[styles.input, error && { borderColor: c.error }, !editable && { opacity: 0.6 }]}
      />
      {error ? (
        <Txt
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          variant="small"
          style={{ color: c.error }}
        >
          {error}
        </Txt>
      ) : null}
    </View>
  );
}
export function PhoneField({
  value,
  onChangeText,
  error,
}: {
  value: string;
  onChangeText: (s: string) => void;
  error?: string;
}) {
  const { t } = useDemo();
  return (
    <View style={{ gap: 8 }}>
      <Txt variant="label">{t('Mobile number', 'Numero sa cellphone')}</Txt>
      <View style={styles.row}>
        <View style={styles.countryCode}>
          <Txt variant="label">+63</Txt>
        </View>
        <TextInput
          accessibilityLabel={t('Mobile number', 'Numero sa cellphone')}
          autoComplete="tel-national"
          textContentType="telephoneNumber"
          keyboardType="phone-pad"
          value={value}
          onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(0, 10))}
          maxLength={10}
          placeholder="9XX XXX XXXX"
          placeholderTextColor={c.muted}
          style={[styles.input, { flex: 1, borderColor: error ? c.error : c.primary }]}
        />
      </View>
      {error ? (
        <Txt variant="small" style={{ color: c.error }}>
          {error}
        </Txt>
      ) : null}
    </View>
  );
}
export function DetailRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
}) {
  return (
    <View style={[styles.row, { alignItems: 'flex-start' }]}>
      {Icon && <Icon size={18} color={c.primary} style={{ marginTop: 3 }} />}
      <View style={{ flex: 1, gap: 5 }}>
        <Txt variant="small">{label}</Txt>
        <Txt variant="label">{value}</Txt>
      </View>
    </View>
  );
}
export function MenuRow({
  title,
  icon: Icon,
  onPress,
  subtitle,
}: {
  title: string;
  icon: LucideIcon;
  onPress: () => void;
  subtitle?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        pressed && { backgroundColor: c.primarySoft },
      ]}
    >
      <Icon size={19} color={c.primary} />
      <View style={{ flex: 1, gap: 3 }}>
        <Txt variant="label">{title}</Txt>
        {subtitle ? <Txt variant="small">{subtitle}</Txt> : null}
      </View>
      <ChevronRight size={18} color={c.muted} />
    </Pressable>
  );
}
export function BottomLinks({ active = 'home' }: { active?: string }) {
  const inset = useSafeAreaInsets();
  const { t } = useDemo();
  const links = [
    { id: 'home', path: '/(tabs)/home', label: t('Home', 'Home'), Icon: Home },
    { id: 'wallet', path: '/(tabs)/wallet', label: t('Wallet', 'Wallet'), Icon: Wallet },
    { id: 'help', path: '/(tabs)/help', label: t('Help', 'Tabang'), Icon: CircleHelp },
    {
      id: 'profile',
      path: '/(tabs)/profile',
      label: t('Profile', 'Profile'),
      Icon: UserRound,
    },
  ];
  return (
    <View style={[styles.bottomBar, { paddingBottom: Math.max(inset.bottom, 8) }]}>
      {links.map(({ id, path, label, Icon }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: active === id }}
          accessibilityLabel={label}
          key={id}
          style={styles.bottomLink}
          onPress={() => router.replace(path as '/(tabs)/home')}
        >
          <Icon size={21} color={id === active ? c.primary : c.muted} />
          <Txt
            variant="small"
            style={{ fontSize: 11, color: id === active ? c.primary : c.muted }}
          >
            {label}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}
export const go = (screen: string, params: Record<string, string> = {}) =>
  router.push({ pathname: '/[page]', params: { page: screen, ...params } });
export const flow = (step: string, params: Record<string, string> = {}) =>
  router.push({ pathname: '/flow/[step]', params: { step, ...params } });
export const styles = StyleSheet.create({
  text: { color: c.text, fontFamily: fonts.regular },
  body: { fontSize: 14, lineHeight: 21 },
  small: { fontSize: 12, lineHeight: 18, color: c.muted },
  label: { fontSize: 14, lineHeight: 20, fontFamily: fonts.semibold },
  title: { fontSize: 24, lineHeight: 30, fontFamily: fonts.bold, letterSpacing: -0.5 },
  heading: { fontSize: 18, lineHeight: 24, fontFamily: fonts.bold },
  number: { fontSize: 36, lineHeight: 43, fontFamily: fonts.bold, letterSpacing: -1 },
  page: { flex: 1, backgroundColor: c.surface },
  pageContent: { padding: 20, gap: 16, flexGrow: 1 },
  footer: { padding: 20, paddingTop: 8, gap: 12 },
  header: {
    minHeight: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: {
    backgroundColor: c.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.outline,
    padding: 18,
    gap: 18,
  },
  button: {
    backgroundColor: c.primary,
    minHeight: 48,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: c.primary,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: c.outline,
    borderRadius: 14,
    backgroundColor: c.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: c.text,
    fontFamily: fonts.regular,
  },
  countryCode: {
    minHeight: 52,
    paddingHorizontal: 16,
    backgroundColor: c.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.outline,
    justifyContent: 'center',
  },
  language: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: c.outline,
    borderRadius: 28,
    padding: 3,
    backgroundColor: c.card,
  },
  languageOption: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 10,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageSelected: { backgroundColor: c.primary },
  logoHalo: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#EEF5FF',
    borderWidth: 1,
    borderColor: '#E4EDFA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    gap: 9,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 15,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
    minHeight: 54,
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: c.card,
    borderTopWidth: 1,
    borderColor: c.outline,
    paddingTop: 8,
  },
  bottomLink: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
});
