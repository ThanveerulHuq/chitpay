import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { callCreateGroup } from '@/lib/api'
import { generateCycleSchedule, isValidIsoDate, toMinor, type CycleFrequency } from '@shared'
import { Button, DateInput, Dropdown, ErrorNote, Field, Input, Page, PageHeader, Textarea } from '@/components/ui'
import { useT } from '@/i18n'

export default function CreateGroupPage() {
  const t = useT()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [cycleCount, setCycleCount] = useState('')
  const [frequency, setFrequency] = useState<CycleFrequency>('monthly')
  const [startDate, setStartDate] = useState('')
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
        contributionAmountMinor: toMinor(Number(amount)),
        currency: 'INR',
        frequency,
        cycleCount: Number(cycleCount),
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

  const parsedCycleCount = Number(cycleCount)
  const schedule = isValidIsoDate(startDate) && Number.isInteger(parsedCycleCount) && parsedCycleCount > 0 && parsedCycleCount <= 100
    ? generateCycleSchedule(startDate, frequency, parsedCycleCount)
    : []

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
            <Field label={t('createGroup.cycleCount')}>
              <Input
                required
                type="number"
                min={1}
                inputMode="numeric"
                max={100}
                value={cycleCount}
                onChange={(e) => setCycleCount(e.target.value)}
                placeholder={t('createGroup.cycleCountPlaceholder')}
              />
            </Field>
          </div>
          <p className="-mt-2 text-xs text-muted">
            {t('createGroup.poolNote')}
          </p>
        </section>

        <section className="space-y-5 border-t border-line pt-6">
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('createGroup.frequency')}>
              <Dropdown
                value={frequency}
                onChange={setFrequency}
                options={[
                  { value: 'weekly', label: t('createGroup.frequencyWeekly') },
                  { value: 'biweekly', label: t('createGroup.frequencyBiweekly') },
                  { value: 'monthly', label: t('createGroup.frequencyMonthly') },
                ] satisfies { value: CycleFrequency; label: string }[]}
              />
            </Field>
            <Field label={t('createGroup.startDate')}>
              <DateInput
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>
          </div>
          {schedule.length > 0 && (
            <div className="rounded-2xl border border-line bg-sunken p-4">
              <h2 className="text-sm font-semibold">{t('createGroup.schedulePreview')}</h2>
              <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                {schedule.map((date, index) => (
                  <li key={date} className="flex items-center justify-between rounded-xl bg-surface px-3 py-2 text-sm">
                    <span>{t('workspace.cycleNumber', { cycle: index + 1 })}</span>
                    <span className="font-medium tabular-nums text-muted">{date}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
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
