import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageCircle, Phone, Send } from 'lucide-react-native';
import { go, LanguageToggle, Notice, styles, Txt } from '../components';
import { peso, useDemo } from '../state';
import {
  formatDate,
  formatDateTime,
  formatQueueNumber,
  formatStatus,
  formatTimeSlot,
} from '../format';
import { colors as c } from '../theme';

type Message = { id: number; role: 'user' | 'assistant'; en: string; bs: string };
const greeting: Message = {
  id: 0,
  role: 'assistant',
  en: 'Hi! I’m GarantiyAid’s assistant. I can help you with your schedule, what to bring, and your claim status. What would you like to know?',
  bs: 'Kumusta! Ako ang assistant sa GarantiyAid. Makatabang ko sa imong iskedyul, dad-on, ug kahimtang sa claim. Unsay gusto nimong mahibal-an?',
};
export function HelpScreen() {
  const { t, overview, wallet, walletLoading, walletError } = useDemo();
  const [messages, setMessages] = useState<Message[]>([greeting]);
  const [input, setInput] = useState('');
  const scroll = useRef<ScrollView>(null);
  const questions = [
    {
      en: 'When is my next claim?',
      bs: 'Kanus-a akong sunod nga claim?',
      kind: 'schedule',
    },
    {
      en: 'What is my claim status?',
      bs: 'Unsa ang kahimtang sa akong claim?',
      kind: 'status',
    },
    { en: 'What should I bring?', bs: 'Unsay akong dad-on?', kind: 'bring' },
    { en: 'My face scan failed!', bs: 'Napakyas akong face scan!', kind: 'scan' },
    {
      en: 'How do I enroll my face?',
      bs: 'Unsaon pag-enroll sa nawong?',
      kind: 'enroll',
    },
  ];
  const ask = (en: string, bs: string, kind?: string) => {
    if (!en.trim()) return;
    const query = en.toLowerCase();
    const asksClaimStatus =
      (query.includes('claim') || query.includes('claimed')) &&
      (query.includes('status') ||
        query.includes('kahimtang') ||
        query.includes('completed') ||
        query.includes('claimed') ||
        query.includes('successful') ||
        query.includes('nahuman'));
    const detected =
      kind ||
      (asksClaimStatus
        ? 'status'
        : query.includes('bring') || query.includes('dad-on')
          ? 'bring'
          : query.includes('fail') || query.includes('napakyas')
            ? 'scan'
            : query.includes('enroll')
              ? 'enroll'
              : query.includes('claim') ||
                  query.includes('schedule') ||
                  query.includes('iskedyul')
                ? 'schedule'
                : 'unknown');
    const statusAnswer = (() => {
      if (walletError) {
        return {
          en: 'Your saved claim status is temporarily unavailable. Open Wallet and try loading it again.',
          bs: 'Temporaryong dili makita ang natipig nga kahimtang sa claim. Ablihi ang Wallet ug sulayi pag-load pag-usab.',
        };
      }
      if (walletLoading && !wallet) {
        return {
          en: 'Your saved claim status is still loading. Please ask again in a moment.',
          bs: 'Nag-load pa ang natipig nga kahimtang sa claim. Pangutana pag-usab sa makadiyot.',
        };
      }
      const current = wallet?.currentClaim;
      if (current?.status === 'not_claimed') {
        return {
          en: `Your ${current.program.name} claim scheduled for ${formatDate(current.date)} has not been claimed yet. Authorized staff will record the result after checking your QR pass.`,
          bs: `Wala pa ma-claim ang ${current.program.name} nga naka-iskedyul sa ${formatDate(current.date)}. Ang awtorisadong staff maoy morekord sa resulta human susihon ang QR pass.`,
        };
      }
      if (current) {
        const recordedEn = current.claimedAt
          ? ` It was recorded ${formatDateTime(current.claimedAt)}.`
          : '';
        const recordedBs = current.claimedAt
          ? ` Girekord kini niadtong ${formatDateTime(current.claimedAt)}.`
          : '';
        return {
          en: `Your current ${current.program.name} claim status is ${formatStatus(current.status)}.${recordedEn}`,
          bs: `Ang kahimtang sa imong kasamtangang ${current.program.name} claim kay ${formatStatus(current.status)}.${recordedBs}`,
        };
      }
      const latest = wallet?.claims[0];
      if (latest) {
        const transaction = wallet?.transactions.find((item) => item.claimId === latest.id);
        const receiptEn = transaction
          ? ` Receipt ${transaction.reference} records ${peso(transaction.amount)}.`
          : '';
        const receiptBs = transaction
          ? ` Ang resibo ${transaction.reference} nagrekord og ${peso(transaction.amount)}.`
          : '';
        const recordedEn = latest.claimedAt
          ? ` It was recorded ${formatDateTime(latest.claimedAt)}.`
          : '';
        const recordedBs = latest.claimedAt
          ? ` Girekord kini niadtong ${formatDateTime(latest.claimedAt)}.`
          : '';
        return {
          en: `Your latest ${latest.program.name} claim status is ${formatStatus(latest.status)}.${recordedEn}${receiptEn}`,
          bs: `Ang pinakabag-o nimong ${latest.program.name} claim kay ${formatStatus(latest.status)}.${recordedBs}${receiptBs}`,
        };
      }
      return {
        en: 'No claim is recorded for your account yet.',
        bs: 'Wala pay claim nga narekord sa imong account.',
      };
    })();
    const answers: Record<string, { en: string; bs: string }> = {
      status: statusAnswer,
      schedule: overview?.nextSchedule
        ? {
            en: `Your next claiming schedule is ${formatDate(overview.nextSchedule.date)} from ${formatTimeSlot(overview.nextSchedule.slotStart, overview.nextSchedule.slotEnd)} at ${overview.nextSchedule.location}. Your queue number is ${formatQueueNumber(overview.nextSchedule.queueNumber)}.`,
            bs: `Ang imong sunod nga iskedyul kay ${formatDate(overview.nextSchedule.date)}, ${formatTimeSlot(overview.nextSchedule.slotStart, overview.nextSchedule.slotEnd)} sa ${overview.nextSchedule.location}. Ang numero sa pila kay ${formatQueueNumber(overview.nextSchedule.queueNumber)}.`,
          }
        : {
            en: 'No claiming schedule is assigned to your account yet. Check Home again later or contact your facilitator.',
            bs: 'Wala pay iskedyul sa claim nga gi-assign sa imong account. Tan-awa pag-usab ang Home o kontaka ang facilitator.',
          },
      bring: {
        en: 'Bring your QR claim pass on your phone and follow the instructions from your assigned facilitator. This preview does not determine official documentary requirements.',
        bs: 'Dad-a ang QR claim pass sa imong cellphone ug sundon ang giingon sa facilitator. Kini nga preview dili motino sa opisyal nga kinahanglanon.',
      },
      scan: {
        en: 'Face scans can fail in poor lighting or if something covers your face. Stay in good lighting and try again. If it keeps failing, ask a staff member at the barangay center for help.',
        bs: 'Mahimong mapakyas ang scan kon ngitngit o natabonan ang nawong. Pabilin sa hayag ug sulayi pag-usab. Kon dili gihapon, pangayo og tabang sa staff sa barangay.',
      },
      enroll: {
        en: 'Open Profile → Enroll face. Read the consent notice and choose whether to continue. Enrollment is optional; you can use your phone number instead.',
        bs: 'Ablihi ang Profile → Ienroll ang nawong. Basaha ang pagtugot ug pilia kon mopadayon. Opsyonal ang enrollment; pwede gamiton ang numero.',
      },
      unknown: {
        en: 'This assistant can read your saved schedule and claim status. Other answers remain previews. For other concerns, use Talk to staff. No live AI or support service is connected.',
        bs: 'Mabasa sa assistant ang natipig nga iskedyul ug kahimtang sa claim. Preview pa ang ubang tubag. Alang sa uban, gamita ang Pakigsulti sa staff. Wala pay live AI o support service.',
      },
    };
    const answer = answers[detected];
    setMessages((previous) => [
      ...previous,
      { id: previous.length, role: 'user', en: en.trim(), bs: bs.trim() },
      { id: previous.length + 1, role: 'assistant', ...answer },
    ]);
    setInput('');
  };
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: c.surface }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { gap: 8 }]}>
          <MessageCircle size={21} color={c.primary} />
          <Txt variant="label" style={{ flex: 1 }}>
            {t('Help', 'Tabang')}
          </Txt>
          <Pressable
            accessibilityRole="button"
            onPress={() => go('support')}
            style={s.staff}
          >
            <Phone size={12} color={c.primary} />
            <Txt
              variant="small"
              style={{ fontSize: 10, color: c.primary, flexShrink: 1 }}
            >
              {t('Talk to staff', 'Pakigsulti sa staff')}
            </Txt>
          </Pressable>
          <LanguageToggle />
        </View>
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.messages}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        >
          <Notice>
            {t(
              'Prototype assistant · Schedule and claim-status answers use your saved account; other answers remain previews.',
              'Prototype assistant · Ang iskedyul ug kahimtang sa claim gikan sa imong account; preview pa ang ubang tubag.',
            )}
          </Notice>
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                s.messageRow,
                message.role === 'user' && { justifyContent: 'flex-end' },
              ]}
            >
              {message.role === 'assistant' && (
                <MessageCircle size={15} color={c.primary} style={{ marginTop: 13 }} />
              )}
              <View style={[s.bubble, message.role === 'user' && s.userBubble]}>
                <Txt
                  variant="small"
                  style={{
                    color: message.role === 'user' ? c.card : c.text,
                    lineHeight: 20,
                  }}
                >
                  {t(message.en, message.bs)}
                </Txt>
              </View>
            </View>
          ))}
          {messages.length === 1 && (
            <View style={s.questions}>
              {questions.map((question) => (
                <Pressable
                  accessibilityRole="button"
                  key={question.kind}
                  onPress={() => ask(question.en, question.bs, question.kind)}
                  style={s.question}
                >
                  <Txt
                    variant="small"
                    style={{ fontSize: 11, color: c.primary, textAlign: 'center' }}
                  >
                    {t(question.en, question.bs)}
                  </Txt>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
        <View style={s.composer}>
          <TextInput
            accessibilityLabel={t(
              'Message to the prototype assistant',
              'Mensahe sa prototype assistant',
            )}
            value={input}
            onChangeText={setInput}
            placeholder={t('Type a message…', 'Isulat ang mensahe…')}
            placeholderTextColor={c.muted}
            style={s.input}
            maxLength={500}
            onSubmitEditing={() => ask(input, input)}
            returnKeyType="send"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Send message', 'Ipadala ang mensahe')}
            disabled={!input.trim()}
            onPress={() => ask(input, input)}
            style={[
              styles.iconButton,
              { backgroundColor: input.trim() ? c.primary : c.outline },
            ]}
          >
            <Send size={19} color={input.trim() ? c.card : c.muted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  staff: {
    minHeight: 48,
    width: 86,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  messages: { padding: 20, gap: 16 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bubble: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.outline,
    borderRadius: 14,
    padding: 14,
    maxWidth: '88%',
  },
  userBubble: { backgroundColor: c.primary, borderWidth: 0 },
  questions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  question: {
    borderWidth: 1,
    borderColor: c.outline,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 48,
    minWidth: '45%',
    maxWidth: '48%',
    justifyContent: 'center',
    backgroundColor: c.card,
  },
  composer: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: c.outline,
    backgroundColor: c.card,
  },
  input: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: c.outline,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: c.text,
  },
});
