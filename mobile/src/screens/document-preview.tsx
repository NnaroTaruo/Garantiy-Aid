import React, { useEffect, useRef, useState } from 'react';
import { Image, Modal, Platform, View } from 'react-native';
import { Button, Notice, Page, Txt } from '../components';
import { ApiRequestError, downloadDocument, type BeneficiaryDocument } from '../api';
import { prepareDocumentFile, type PreparedDocument } from '../document-file';
import { useDemo } from '../state';
import { colors as c } from '../theme';

export function DocumentPreview({ document, onClose }: { document: BeneficiaryDocument; onClose: () => void }) {
  const { accessToken, reset, t } = useDemo();
  const [file, setFile] = useState<PreparedDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copyError, setCopyError] = useState(false);
  const [copying, setCopying] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const active = useRef(true), busy = useRef(false);
  const current = useRef<PreparedDocument | null>(null);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    active.current = true; setLoading(true); setError(''); setCopyError(false); setFile(null);
    const release = (prepared: PreparedDocument) => { try { prepared.dispose(); } catch { /* Private cache is retried on a later native preview. */ } };
    void (async () => {
      try {
        const downloaded = await downloadDocument(accessToken, document, controller.signal);
        if (!alive) return;
        const prepared = await prepareDocumentFile(downloaded);
        if (!alive) { release(prepared); return; }
        current.current = prepared; setFile(prepared);
      } catch (cause) {
        if (!alive) return;
        if (cause instanceof ApiRequestError && cause.status === 401) { await reset(); return; }
        setError(cause instanceof ApiRequestError && cause.status === 404 ? 'missing'
          : cause instanceof ApiRequestError && cause.code === 'DOCUMENT_PREVIEW_INVALID' ? 'invalid' : 'load');
      } finally { if (alive) setLoading(false); }
    })();
    return () => {
      alive = false; active.current = false; controller.abort();
      if (current.current) { release(current.current); current.current = null; }
    };
  }, [accessToken, document.id, attempt]);
  const close = () => { if (!busy.current) onClose(); };
  return <Modal visible animationType="slide" transparent onRequestClose={close}>
    <View style={{ flex: 1, backgroundColor: 'rgba(15, 31, 51, 0.45)', alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 430, backgroundColor: c.surface }}>
        <Page header={false} footer={<Button variant="outline" disabled={copying} onPress={close}>{t('Close document', 'Sirad-i ang dokumento')}</Button>}>
          <Txt variant="title">{t('Saved document', 'Natipig nga dokumento')}</Txt>
          <Txt variant="label">{document.originalName}</Txt>
          {document.documentName && <Txt variant="small">{document.documentName}</Txt>}
          {loading && <Notice>{t('Loading your saved file…', 'Gikuha ang imong natipig nga file…')}</Notice>}
          {!!error && <>
            <Notice tone="error">{error === 'missing'
              ? t('This file is no longer available. Close this view and refresh your documents, or ask staff for help.', 'Dili na magamit kini nga file. Sirad-i kini ug i-refresh ang mga dokumento, o pangayo og tabang sa staff.')
              : error === 'invalid' ? t('This file could not be verified as a supported PDF or image. Ask staff for a valid copy.', 'Dili mapamatud-an nga hustong PDF o hulagway kini nga file. Pangayo og hustong kopya sa staff.')
              : t('The file could not be loaded. Check your connection and try again.', 'Wala makuha ang file. Susihon ang koneksyon ug sulayi pag-usab.')}</Notice>
            <Button disabled={copying} onPress={() => setAttempt(attempt + 1)}>{t('Try again', 'Sulayi pag-usab')}</Button>
          </>}
          {file && !error && <>
            {file.mimeType.startsWith('image/') ? <Image source={{ uri: file.uri }} accessibilityLabel={t('Saved document image', 'Hulagway sa natipig nga dokumento')}
              resizeMode="contain" style={{ width: '100%', height: 400, backgroundColor: c.card }}
              onError={() => { if (active.current) setError('invalid'); }} />
              : Platform.OS === 'web' ? React.createElement('iframe', { src: file.uri, title: t('Saved PDF preview', 'Preview sa natipig nga PDF'),
                referrerPolicy: 'no-referrer', style: { width: '100%', height: 460, border: 0 } })
                : <Notice>{t('Your PDF is ready. Use Open or save a copy to choose an app on your phone.', 'Andam na ang PDF. Gamita ang Ablihi o tipigi ang kopya aron makapili og app sa imong cellphone.')}</Notice>}
            {copyError && <Notice tone="error">{t('The copy chooser could not be opened. Try again or check the apps available on this device.', 'Wala maablihi ang pagpili sa kopya. Sulayi pag-usab o susiha ang mga app sa device.')}</Notice>}
            <Button loading={copying} onPress={async () => {
              if (busy.current) return;
              busy.current = true; setCopying(true); setCopyError(false);
              try { await file.save(t('Open or save a copy', 'Ablihi o tipigi ang kopya')); }
              catch { if (active.current) setCopyError(true); }
              finally { busy.current = false; if (active.current) setCopying(false); }
            }}>{Platform.OS === 'web' ? t('Download a copy', 'I-download ang kopya') : t('Open or save a copy', 'Ablihi o tipigi ang kopya')}</Button>
            <Notice>{t('Copies you download or save outside GarantiyAid remain on that device or app after you sign out.', 'Ang mga kopya nga imong i-download o tipigan gawas sa GarantiyAid magpabilin sa device o app human ka mo-sign out.')}</Notice>
          </>}
        </Page>
      </View>
    </View>
  </Modal>;
}
