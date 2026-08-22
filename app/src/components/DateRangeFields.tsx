import { DateInput, Field } from '@/components/ui'
import { useT } from '@/i18n'

export default function DateRangeFields({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}) {
  const t = useT()
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label={t('payments.from')}>
        <DateInput value={from} max={to || undefined} onChange={(e) => onFromChange(e.target.value)} />
      </Field>
      <Field label={t('payments.to')}>
        <DateInput value={to} min={from || undefined} onChange={(e) => onToChange(e.target.value)} />
      </Field>
    </div>
  )
}
