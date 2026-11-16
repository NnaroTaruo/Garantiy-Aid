import React, { useState } from 'react';
import { Keyboard, Modal, Pressable, View } from 'react-native';
import { CalendarDays } from 'lucide-react-native';
import { Button, Page, styles, Txt } from './components';
import { useDemo } from './state';
import { colors as c } from './theme';

const monthsEn = 'January February March April May June July August September October November December'.split(' ');
const monthsBs = 'Enero Pebrero Marso Abril Mayo Hunyo Hulyo Agosto Septiyembre Oktubre Nobiyembre Disyembre'.split(' ');
const twoDigits = (value: number) => String(value).padStart(2, '0');

export function BirthDatePicker({ value, onChange, error }: {
  value: string;
  onChange: (date: string) => void;
  error?: string;
}) {
  const { t } = useDemo();
  const [step, setStep] = useState<'year' | 'month' | 'day' | null>(null);
  const [year, setYear] = useState(0);
  const [month, setMonth] = useState(0);
  const label = t('Birth date', 'Petsa sa pagkatawo');
  const placeholder = t('Choose birth date', 'Pagpili og petsa sa pagkatawo');
  const [savedYear, savedMonth, savedDay] = value.split('-').map(Number);
  const monthName = (number: number) => t(monthsEn[number - 1], monthsBs[number - 1]);
  const dateLabel = value
    ? t(`${monthName(savedMonth)} ${savedDay}, ${savedYear}`, `${savedDay} ${monthName(savedMonth)} ${savedYear}`)
    : placeholder;
  const today = new Date();
  const maxYear = today.getFullYear();
  const maxMonth = today.getMonth() + 1;
  const title = step === 'year' ? t('Choose birth year', 'Pilia ang tuig sa pagkatawo')
    : step === 'month' ? t('Choose month', 'Pilia ang bulan') : t('Choose day', 'Pilia ang adlaw');
  const close = () => setStep(null);
  const back = () => setStep(step === 'day' ? 'month' : step === 'month' ? 'year' : null);
  const count = step === 'year' ? maxYear - 1900 + 1
    : step === 'month' ? (year === maxYear ? maxMonth : 12)
    : year === maxYear && month === maxMonth ? today.getDate() : new Date(year, month, 0).getDate();

  return (
    <View style={{ gap: 8 }}>
      <Txt variant="label">{label}</Txt>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: dateLabel }}
        accessibilityState={{ expanded: step !== null }}
        onPress={() => { Keyboard.dismiss(); setStep('year'); }}
        style={[styles.input, styles.row, error && { borderColor: c.error }]}
      >
        <Txt style={{ flex: 1, fontSize: 16, color: value ? c.text : c.muted }}>{dateLabel}</Txt>
        <CalendarDays size={20} color={c.primary} />
      </Pressable>
      {error && <Txt variant="small" accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: c.error }}>{error}</Txt>}
      {step && (
        <Modal transparent onRequestClose={back}>
          <View style={{ flex: 1, alignItems: 'center', backgroundColor: 'rgba(15, 31, 51, 0.45)' }}>
            <View accessibilityViewIsModal style={{ flex: 1, width: '100%', maxWidth: 430, backgroundColor: c.surface }}>
              <Page key={step} header={false} footer={
                <Button variant="outline" onPress={close}>{t('Cancel', 'Kanselahon')}</Button>
              }>
                <Txt variant="title" accessibilityRole="header">{title}</Txt>
                {step !== 'year' && (
                  <View style={[styles.row, { justifyContent: 'space-between' }]}>
                    <Txt variant="label">{step === 'month' ? year : `${monthName(month)} ${year}`}</Txt>
                    <Pressable accessibilityRole="button" onPress={back} style={{ minHeight: 44, justifyContent: 'center' }}>
                      <Txt variant="label" style={{ color: c.primary }}>{t('Back', 'Balik')}</Txt>
                    </Pressable>
                  </View>
                )}
                <View accessibilityRole="radiogroup" accessibilityLabel={title} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {Array.from({ length: count }, (_, index) => {
                    const option = step === 'year' ? maxYear - index : index + 1;
                    const selected = step === 'year' ? option === savedYear
                      : step === 'month' ? year === savedYear && option === savedMonth
                      : year === savedYear && month === savedMonth && option === savedDay;
                    return (
                      <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: selected }}
                        onPress={() => {
                          if (step === 'year') { setYear(option); setStep('month'); }
                          else if (step === 'month') { setMonth(option); setStep('day'); }
                          else { onChange(`${year}-${twoDigits(month)}-${twoDigits(option)}`); close(); }
                        }}
                        style={({ pressed }) => [styles.input, {
                          width: step === 'month' ? '48%' : '22%', minHeight: 48, paddingHorizontal: 4,
                          alignItems: 'center', justifyContent: 'center',
                        }, (pressed || selected) && { backgroundColor: c.primarySoft, borderColor: c.primary }]}
                      >
                        <Txt variant="label">{step === 'month' ? monthName(option) : option}</Txt>
                      </Pressable>
                    );
                  })}
                </View>
              </Page>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
