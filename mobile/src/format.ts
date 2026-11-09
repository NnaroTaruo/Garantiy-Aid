const manilaTimeZone = 'Asia/Manila';

export function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

export function formatTimeSlot(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: manilaTimeZone,
  });
  return `${formatter.format(new Date(start))} - ${formatter.format(new Date(end))}`;
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: manilaTimeZone,
  }).format(new Date(value));
}

export function formatQueueNumber(queueNumber: number) {
  return `#${String(queueNumber).padStart(3, '0')}`;
}

export function formatStatus(status: string) {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatClaimStatus(status: string, t: (en: string, bs: string) => string, deliveryMode?: string) {
  const labels: Record<string, string> = {
    not_claimed: t('Scheduled', 'Naka-iskedyul'),
    pending: t('Pending verification', 'Nagpaabot sa pag-verify'),
    verified: t('Verified · awaiting release', 'Napamatud-an · nagpaabot sa paghatag'),
    claimed: deliveryMode === 'physical_goods' ? t('Released', 'Nahatag') : t('Claimed', 'Na-claim'),
    rejected: t('Rejected', 'Gisalikway'), voided: t('Voided', 'Gikansela'),
  };
  return labels[status] ?? formatStatus(status);
}

export function formatTransactionType(type: string, t: (en: string, bs: string) => string) {
  if (type === 'benefit_reversal') return t('Assistance reversal', 'Pagbalik sa narekord nga ayuda');
  return t('Assistance ledger entry', 'Narekord nga ayuda');
}
