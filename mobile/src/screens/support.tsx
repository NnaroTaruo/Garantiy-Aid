import React, { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Button, Card, Notice, styles, Txt } from '../components';
import { ApiRequestError, createSupportRequest, getSupportRequest, getSupportRequests, replySupportRequest,
  type SupportList, type SupportThread } from '../api';
import { useDemo } from '../state';
import { formatDateTime } from '../format';
import { colors as c } from '../theme';

// Retry identifiers only; server-side ownership checks authorize every request.
function retryId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, value => {
    const n = Math.floor(Math.random() * 16); return (value === 'x' ? n : (n & 3) | 8).toString(16);
  });
}
export function SupportContent() {
  const { accessToken, t } = useDemo();
  if (!accessToken) return <>
    <Notice>{t('Sign in to send a concern and view your saved staff replies.', 'Pag-sign in aron makapadala og kabalaka ug makita ang natipig nga tubag sa staff.')}</Notice>
    <Button onPress={() => router.replace('/flow/login')}>{t('Sign in', 'Pag-sign in')}</Button>
  </>;
  return <SupportWorkspace key={accessToken} />;
}
function SupportWorkspace() {
  const { accessToken, language, reset, t } = useDemo();
  const [list, setList] = useState<SupportList | null>(null);
  const [thread, setThread] = useState<SupportThread | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mounted = useRef(true), pending = useRef(false), listRead = useRef(0), threadRead = useRef(0);
  const attempt = useRef<{ key: string; id: string; language: string } | null>(null);
  useEffect(() => { mounted.current = true; void loadList(); return () => { mounted.current = false; }; }, []);
  async function failed(cause: unknown) {
    if (!mounted.current) return;
    if (cause instanceof ApiRequestError && cause.status === 401) { await reset(); return; }
    setError(cause instanceof ApiRequestError && cause.status === 409
      ? t('The request changed or its reply window ended. Refresh before trying again.', 'Nausab ang request o nahuman ang oras sa pagtubag. I-refresh sa dili pa mosulay pag-usab.')
      : t('Could not confirm the request. Your message is kept below; refresh your requests before retrying.', 'Wala makumpirma ang request. Gipabilin ang imong mensahe sa ubos; i-refresh ang mga request sa dili pa mosulay pag-usab.'));
  }
  async function loadList(page = 1) {
    if (pending.current) return;
    const read = ++listRead.current; setLoading(true); setError('');
    try { const next = await getSupportRequests(accessToken, page); if (mounted.current && read === listRead.current) setList(next); }
    catch (cause) { if (read === listRead.current) await failed(cause); }
    finally { if (mounted.current && read === listRead.current) setLoading(false); }
  }
  async function loadThread(id: string) {
    if (pending.current) return;
    const read = ++threadRead.current; setLoadingThread(true); setError('');
    try { const next = await getSupportRequest(accessToken, id); if (mounted.current && read === threadRead.current) setThread(next); }
    catch (cause) { if (read === threadRead.current) await failed(cause); }
    finally { if (mounted.current && read === threadRead.current) setLoadingThread(false); }
  }
  const open = (id: string) => { setSelectedId(id); setThread(null); setDraft(''); attempt.current = null; void loadThread(id); };
  async function send() {
    const messageText = draft.trim();
    if (!messageText || pending.current || (selectedId && (!thread?.request.canReply || loadingThread))) return;
    if (/<\/?[a-z][^>]*>/i.test(messageText)) { setError(t('Use plain text without HTML markup.', 'Gamita ang yano nga teksto nga walay HTML markup.')); return; }
    const key = JSON.stringify([selectedId, messageText]);
    if (attempt.current?.key !== key) attempt.current = { key, id: retryId(), language };
    const { id, language: requestLanguage } = attempt.current;
    pending.current = true; ++listRead.current; ++threadRead.current;
    setLoading(false); setLoadingThread(false); setSending(true); setError('');
    try {
      const saved = selectedId ? await replySupportRequest(accessToken, selectedId, { messageId: id, messageText })
        : await createSupportRequest(accessToken, { requestId: id, language: requestLanguage, messageText });
      if (!mounted.current) return;
      setThread(saved); setSelectedId(saved.request.id); setDraft(''); attempt.current = null;
      // The confirmed thread is enough to display success; refresh the list on returning.
    } catch (cause) { await failed(cause); }
    finally { pending.current = false; if (mounted.current) setSending(false); }
  }
  const status = (value: string) => value === 'resolved' ? t('Resolved', 'Nasulbad')
    : value === 'ended' ? t('Closed', 'Gisirad-an') : t('Open', 'Bukas');
  return <>
    <Txt variant="title">{t('Get help from staff', 'Pangayo og tabang sa staff')}</Txt>
    <Notice>{t('Send a concern to authorized staff. Replies are not instant; refresh to check for updates. Do not include passwords, codes or ID numbers.', 'Tipigan ang imong kabalaka alang sa awtorisadong staff. Dili dayon ang tubag; i-refresh aron masusi ang mga update. Ayaw iapil ang password, code o numero sa ID.')}</Notice>
    {!!error && <Notice tone="error">{error}</Notice>}
    {selectedId ? <>
      <Button variant="outline" disabled={sending} onPress={() => { ++threadRead.current; setLoadingThread(false); setSelectedId(null); setThread(null); setDraft(''); attempt.current = null; void loadList(); }}>{t('Back to requests', 'Balik sa mga request')}</Button>
      {loadingThread && <Notice>{t('Loading conversation…', 'Gikuha ang panag-istorya…')}</Notice>}
      {thread && <>
        <Card>
          <Badge tone={thread.request.status === 'resolved' ? 'success' : 'warning'}>{status(thread.request.status)}</Badge>
          <Txt variant="small">{t('Request reference', 'Reference sa request')}: {thread.request.id}</Txt>
          <Txt variant="small">{t('Updated', 'Gi-update')}: {formatDateTime(thread.request.updatedAt)}</Txt>
          <Txt variant="small">{t('Retained until', 'Tipigan hangtod')}: {formatDateTime(thread.request.retentionUntil)}</Txt>
        </Card>
        {thread.messages.map(message => <Card key={message.id}>
          <Txt variant="label">{message.role === 'staff' ? t('Staff reply', 'Tubag sa staff') : message.role === 'user' ? t('You', 'Ikaw') : t('Assistant', 'Assistant')}</Txt>
          <Txt selectable>{message.text}</Txt>
          <Txt variant="small">{formatDateTime(message.createdAt)}</Txt>
        </Card>)}
        {!thread.request.canReply && <Notice>{t('This request cannot accept more replies. You can create a new request if you still need help.', 'Dili na makadawat og dugang tubag kini nga request. Paghimo og bag-ong request kon kinahanglan pa og tabang.')}</Notice>}
      </>}
      <Button variant="outline" loading={loadingThread} disabled={sending} onPress={() => void loadThread(selectedId)}>{t('Refresh conversation', 'I-refresh ang panag-istorya')}</Button>
    </> : <>
      <Txt variant="heading">{t('New concern', 'Bag-ong kabalaka')}</Txt>
    </>}
    {(!selectedId || thread?.request.canReply) && <View style={{ gap: 8 }}>
      <Txt variant="label">{selectedId ? t('Your reply', 'Imong tubag') : t('Describe your concern', 'Ihulagway ang imong kabalaka')}</Txt>
      <TextInput accessibilityLabel={selectedId ? t('Your reply', 'Imong tubag') : t('Describe your concern', 'Ihulagway ang imong kabalaka')}
        value={draft} onChangeText={setDraft} multiline maxLength={1000} editable={!sending}
        placeholder={t('For example: I need help with my enrollment.', 'Pananglitan: Kinahanglan ko og tabang sa akong enrollment.')} placeholderTextColor={c.muted}
        style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]} />
      <Txt variant="small">{draft.length}/1000</Txt>
      <Button loading={sending} disabled={!draft.trim() || loadingThread} onPress={() => void send()}>{selectedId ? t('Send reply', 'Ipadala ang tubag') : t('Send to staff', 'Ipadala sa staff')}</Button>
    </View>}
    {!selectedId && <>
      <Txt variant="heading">{t('Your requests', 'Imong mga request')}</Txt>
      <Button variant="outline" loading={loading} disabled={sending} onPress={() => void loadList(list?.pagination.page ?? 1)}>{t('Refresh requests', 'I-refresh ang mga request')}</Button>
      {!loading && !error && list?.requests.length === 0 && <Notice>{t('No saved requests yet. Send a concern above when you need help.', 'Wala pay natipig nga request. Ipadala ang kabalaka sa ibabaw kon kinahanglan og tabang.')}</Notice>}
      {list?.requests.map(item => <Card key={item.id}>
        <Badge tone={item.status === 'resolved' ? 'success' : 'warning'}>{status(item.status)}</Badge>
        <Txt numberOfLines={3}>{item.subject}</Txt>
        <Txt variant="small">{formatDateTime(item.updatedAt)}</Txt>
        <Button variant="outline" disabled={sending} onPress={() => open(item.id)}>{t('Open request', 'Ablihi ang request')}</Button>
      </Card>)}
      {list && list.pagination.totalPages > 1 && <>
        <Txt variant="small">{t('Page', 'Pahina')} {list.pagination.page}/{list.pagination.totalPages}</Txt>
        <Button variant="outline" disabled={loading || sending || list.pagination.page <= 1} onPress={() => void loadList(list.pagination.page - 1)}>{t('Previous', 'Miagi')}</Button>
        <Button variant="outline" disabled={loading || sending || list.pagination.page >= list.pagination.totalPages} onPress={() => void loadList(list.pagination.page + 1)}>{t('Next', 'Sunod')}</Button>
      </>}
    </>}
  </>;
}
