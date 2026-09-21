import { useState } from 'react'
import { X } from '@phosphor-icons/react'
import DateRangeFields from '@/components/DateRangeFields'
import { Button } from '@/components/ui'
import { useI18n } from '@/i18n'
import { useBodyLock } from '@/lib/useBodyLock'

export default function ReportDateFilterSheet({
  from,
  to,
  onClose,
  onApply,
}: {
  from: string
  to: string
  onClose: () => void
  onApply: (from: string, to: string) => void
}) {
  const { t } = useI18n()
  const [draftFrom, setDraftFrom] = useState(from)
  const [draftTo, setDraftTo] = useState(to)
  useBodyLock(true)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="date-filter-title"
      className="fixed inset-0 z-[60] flex items-end bg-black/40 sm:items-center sm:justify-center sm:p-4"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg rounded-t-3xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl sm:pb-5">
        <div className="flex items-center justify-between">
          <h2 id="date-filter-title" className="text-lg font-bold">{t('workspace.dateFilter')}</h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded-full p-1.5 text-muted hover:bg-sunken">
            <X size={20} weight="bold" />
          </button>
        </div>
        <div className="mt-4">
          <DateRangeFields from={draftFrom} to={draftTo} onFromChange={setDraftFrom} onToChange={setDraftTo} />
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" onClick={() => { setDraftFrom(''); setDraftTo('') }} className="flex-1">
            {t('workspace.clearFilters')}
          </Button>
          <Button onClick={() => onApply(draftFrom, draftTo)} className="flex-1">
            {t('workspace.applyFilters')}
          </Button>
        </div>
      </div>
    </div>
  )
}
