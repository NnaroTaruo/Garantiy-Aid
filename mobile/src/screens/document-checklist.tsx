import React, { useEffect, useRef, useState } from 'react';
import { Button, Notice, Txt } from '../components';
import { ApiRequestError, getDocumentRequirements, IS_SHARED_BACKEND, type DocumentRequirement, type DocumentRequirements } from '../api';
import { useDemo } from '../state';
import { formatDocumentType } from '../format';

export function DocumentChecklist({ disabled, onChoose }: { disabled: boolean; onChoose: (requirement: DocumentRequirement) => void }) {
  const { accessToken, t } = useDemo();
  const [expanded, setExpanded] = useState(false);
  if (!IS_SHARED_BACKEND || !accessToken) return null;
  return <>
    <Button variant="outline" disabled={disabled} onPress={() => setExpanded(!expanded)}>
      {expanded ? t('Close program checklists', 'Sirad-i ang mga checklist') : t('View program document checklists', 'Tan-awa ang mga checklist sa programa')}
    </Button>
    {expanded && <ChecklistOptions key={accessToken} disabled={disabled} onChoose={requirement => { onChoose(requirement); setExpanded(false); }} />}
  </>;
}
function ChecklistOptions({ disabled, onChoose }: { disabled: boolean; onChoose: (requirement: DocumentRequirement) => void }) {
  const { accessToken, reset, t } = useDemo();
  const [data, setData] = useState<DocumentRequirements | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const active = useRef(true), request = useRef(0);
  useEffect(() => { active.current = true; void load(); return () => { active.current = false; }; }, []);
  async function load(page = 1) {
    const id = ++request.current; setLoading(true); setError(false); setSelectedId(null);
    try {
      const saved = await getDocumentRequirements(accessToken, page);
      if (active.current && id === request.current) setData(saved);
    } catch (cause) {
      if (!active.current || id !== request.current) return;
      if (cause instanceof ApiRequestError && cause.status === 401) await reset();
      else setError(true);
    } finally { if (active.current && id === request.current) setLoading(false); }
  }
  const selected = data?.programs.find(program => program.id === selectedId);
  return <>
    <Notice>{t('Choose the program your facilitator named. Its checklist shows the requested documents. Staff still decide eligibility and enrollment.', 'Pilia ang programa nga ginganlan sa facilitator. Makita sa checklist ang mga gipangayong dokumento. Ang staff gihapon ang motino sa eligibility ug enrollment.')}</Notice>
    {loading && <Notice>{t('Loading program checklists…', 'Gikuha ang mga checklist…')}</Notice>}
    {error && <Notice tone="error">{t('Program checklists could not be loaded. Refresh to try again.', 'Wala makuha ang mga checklist. I-refresh aron sulayan pag-usab.')}</Notice>}
    <Button variant="outline" loading={loading} disabled={disabled} onPress={() => void load(data?.pagination.page ?? 1)}>{t('Refresh checklists', 'I-refresh ang mga checklist')}</Button>
    {!loading && !error && data?.programs.length === 0 && <Notice>{t('No program checklists are available. Ask your facilitator for the exact document category and requested name.', 'Walay magamit nga checklist. Pangutan-a ang facilitator sa eksaktong klase ug ngalan sa gipangayong dokumento.')}</Notice>}
    {!loading && !error && selected ? <>
      <Txt variant="heading">{selected.name}</Txt>
      <Txt variant="small">{selected.code}</Txt>
      <Button variant="outline" disabled={disabled} onPress={() => setSelectedId(null)}>{t('Choose a different program', 'Pagpili og laing programa')}</Button>
      {selected.requirements.length === 0 && <Notice>{t('Staff have not listed required documents for this program. Confirm with your facilitator.', 'Wala gilista sa staff ang mga kinahanglanong dokumento niini nga programa. Kumpirmaha sa facilitator.')}</Notice>}
      {selected.requirements.map((requirement, index) => <Button key={`${requirement.docType}:${requirement.documentName}:${index}`} variant="outline" disabled={disabled}
        onPress={() => onChoose(requirement)}>{requirement.documentName ?? formatDocumentType(requirement.docType, t)}</Button>)}
    </> : !loading && !error ? <>
      {data?.programs.map(program => <Button key={program.id} variant="outline" disabled={disabled} onPress={() => setSelectedId(program.id)}>
        {program.name}{'\n'}{program.code}{program.status === 'closed' ? t(' · Closed', ' · Sirado') : ''}
      </Button>)}
      {data && data.pagination.totalPages > 1 && <>
        <Txt variant="small">{t('Page', 'Pahina')} {data.pagination.page}/{data.pagination.totalPages}</Txt>
        <Button variant="outline" disabled={disabled || data.pagination.page <= 1} onPress={() => void load(data.pagination.page - 1)}>{t('Previous', 'Miagi')}</Button>
        <Button variant="outline" disabled={disabled || data.pagination.page >= data.pagination.totalPages} onPress={() => void load(data.pagination.page + 1)}>{t('Next', 'Sunod')}</Button>
      </>}
    </> : null}
  </>;
}
