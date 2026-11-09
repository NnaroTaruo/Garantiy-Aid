import { Platform } from 'react-native';
import { ApiRequestError, type DownloadedDocument } from './api';

export type PreparedDocument = { uri: string; name: string; mimeType: string; dispose: () => void; save: (title: string) => Promise<void> };
let nativeCacheReady = false;
export async function prepareDocumentFile(document: DownloadedDocument): Promise<PreparedDocument> {
  const extension = ({ 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' } as Record<string, string>)[document.mimeType];
  if (!extension) throw new ApiRequestError('DOCUMENT_PREVIEW_INVALID', 'Unsupported document type.');
  const stem = document.name.replace(/\.[^.]*$/, '').replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_').replace(/^[. ]+|[. ]+$/g, '').slice(0, 100) || 'document';
  const name = `${stem}.${extension}`;
  if (Platform.OS === 'web') {
    const uri = URL.createObjectURL(new Blob([document.bytes.slice().buffer], { type: document.mimeType }));
    let closed = false;
    return { uri, name, mimeType: document.mimeType,
      dispose: () => { if (!closed) { closed = true; URL.revokeObjectURL(uri); } },
      save: async () => {
        if (closed) throw new ApiRequestError('DOCUMENT_PREVIEW_CLOSED', 'Open the document again.');
        const link = globalThis.document.createElement('a');
        link.href = uri; link.download = name; link.rel = 'noopener noreferrer';
        globalThis.document.body.appendChild(link);
        try { link.click(); } finally { link.remove(); }
      } };
  }
  const { Directory, File, Paths } = await import('expo-file-system');
  const root = new Directory(Paths.cache, 'garantiyaid-document-previews');
  if (!nativeCacheReady || !root.exists) {
    if (root.exists) root.delete(); // Clear app-owned leftovers from an interrupted earlier run.
    root.create({ intermediates: true }); nativeCacheReady = true;
  }
  const directory = new Directory(root, `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const dispose = () => { try { if (directory.exists) directory.delete(); } catch (cause) { nativeCacheReady = false; throw cause; } };
  try {
    directory.create();
    const file = new File(directory, name); file.create(); file.write(document.bytes);
    return { uri: file.uri, name, mimeType: document.mimeType, dispose,
      save: async title => {
        if (!file.exists) throw new ApiRequestError('DOCUMENT_PREVIEW_CLOSED', 'Open the document again.');
        const sharing = await import('expo-sharing');
        if (!await sharing.isAvailableAsync()) throw new ApiRequestError('DOCUMENT_EXPORT_UNAVAILABLE', 'The file chooser is unavailable on this device.');
        await sharing.shareAsync(file.uri, { mimeType: document.mimeType, dialogTitle: title,
          UTI: ({ pdf: 'com.adobe.pdf', jpg: 'public.jpeg', png: 'public.png' } as Record<string, string>)[extension] });
      } };
  } catch (cause) { try { dispose(); } catch { /* Preserve the original file-write failure. */ } throw cause; }
}
