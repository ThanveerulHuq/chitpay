import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { callCreateGroup } from '@/lib/api'
import { toMinor } from '@shared'
import { Button, DateInput, ErrorNote, Field, Input, Page, PageHeader, Select, Textarea } from '@/components/ui'
import { useT } from '@/i18n'

export default function CreateGroupPage() {
  const t = useT()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [durationMonths, setDurationMonths] = useState('')
  const [startDate, setStartDate] = useState('')
  const [dueDay, setDueDay] = useState('21')
  const [description, setDescription] = useState('')
  const [requirePaidToWin, setRequirePaidToWin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const groupId = await callCreateGroup({
        name,
        monthlyAmountMinor: toMinor(Number(amount)),
        currency: 'INR',
        dueDay: Number(dueDay),
        durationMonths: Number(durationMonths),
        startDate,
        description: description || undefined,
        requirePaidToWin,
      })
      navigate(`/groups/${groupId}`, { replace: true })
    } catch (err) {
      setError((err as Error).message ?? t('createGroup.error'))
      setBusy(false)
    }
  }

  return (
    <Page>
      <PageHeader
        title={t('createGroup.title')}
        backTo="/groups"
      />

      {error && <ErrorNote>{error}</ErrorNote>}

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="space-y-5">
          <Field label={t('createGroup.name')}>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('createGroup.namePlaceholder')}
            />
          </Field>
          <Field label={t('createGroup.desc')} hint={t('createGroup.descHint')}>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </section>

        <section className="space-y-5 border-t border-line pt-6">
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('createGroup.contribution')}>
              <Input
                required
                type="number"
                min={1}
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t('createGroup.contributionPlaceholder')}
              />
            </Field>
            <Field label={t('createGroup.duration')}>
              <Input
                required
                type="number"
                min={1}
                inputMode="numeric"
                value={durationMonths}
                onChange={(e) => setDurationMonths(e.target.value)}
                placeholder={t('createGroup.durationPlaceholder')}
              />
            </Field>
          </div>
          <p className="-mt-2 text-xs text-muted">
            {t('createGroup.poolNote')}
          </p>
        </section>

        <section className="space-y-5 border-t border-line pt-6">
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('createGroup.startDate')}>
              <DateInput
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>
            <Field label={t('createGroup.dueDay')}>
              <Select value={dueDay} onChange={(e) => setDueDay(e.target.value)}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={requirePaidToWin}
              onChange={(e) => setRequirePaidToWin(e.target.checked)}
              className="mt-0.5 size-5 accent-accent"
            />
            <span>
              {t('createGroup.requirePaidLabel')}
              <span className="block text-xs text-muted">
                {t('createGroup.requirePaidHint')}
              </span>
            </span>
          </label>
        </section>

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? t('createGroup.creating') : t('createGroup.createBtn')}
        </Button>
      </form>
    </Page>
  )
}

