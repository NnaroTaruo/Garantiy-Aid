import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { ActivityIndicator, View, Platform, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DemoProvider, useDemo } from '../src/state';
import { colors } from '../src/theme';
import { Button, Logo, Notice, Page, Txt } from '../src/components';
import { PushBridge } from '../src/push-bridge';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  return (
    <SafeAreaProvider>
      <DemoProvider>
        <RootNavigator fontsReady={loaded || !!error} />
      </DemoProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { authError, authLoading } = useDemo();
  // Mounted above the loading screen so an alert that launched the app waits for navigation.
  return (
    <>
      <PushBridge navigationReady={fontsReady && !authLoading && !authError} />
      <RootContent fontsReady={fontsReady} />
    </>
  );
}

function RootContent({ fontsReady }: { fontsReady: boolean }) {
  const { accessToken, authError, authLoading, restoreSession, t } = useDemo();
  if (!fontsReady || authLoading)
    return (
      <View style={s.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  return (
    <View style={s.outer}>
      <View style={s.app}>
        <StatusBar style="dark" />
        {authError ? (
          <Page header={false} contentStyle={s.sessionError}>
            <Logo size={50} halo />
            <Txt variant="title" style={{ textAlign: 'center' }}>
              {t('We could not restore your session', 'Wala namo ma-restore ang imong session')}
            </Txt>
            <Notice tone="error">
              {t(
                'Check that the backend is running, then try again. Your saved login has not been removed.',
                'Siguroa nga nagdagan ang backend, dayon sulayi pag-usab. Wala tangtanga ang imong login.',
              )}
            </Notice>
            <Button onPress={() => void restoreSession()}>
              {t('Try again', 'Sulayi pag-usab')}
            </Button>
          </Page>
        ) : (
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.surface },
                animation: 'default',
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="flow/[step]" />
              <Stack.Protected guard={!!accessToken}>
                <Stack.Screen name="(tabs)" />
              </Stack.Protected>
              <Stack.Screen name="[page]" />
            </Stack>
        )}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  outer: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Platform.OS === 'web' ? '#E9EEF4' : colors.surface,
  },
  app: { flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? 430 : undefined },
  sessionError: { justifyContent: 'center', alignItems: 'stretch' },
});
