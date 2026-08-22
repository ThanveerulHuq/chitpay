import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { callCreateGroup } from '@/lib/api'
import { toMinor } from '@shared'
import { Button, DateInput, ErrorNote, Field, Input, Page, PageHeader, Select, Textarea } from '@/components/ui'

export default function CreateGroupPage() {
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
      setError((err as Error).message ?? 'Could not create group.')
      setBusy(false)
    }
  }

  return (
    <Page>
      <PageHeader title="Create Group" backTo="/groups" />

      {error && <ErrorNote>{error}</ErrorNote>}

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="space-y-5">
          <Field label="Group name">
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ahmed Friends Group"
            />
          </Field>
          <Field label="Description" hint="Optional. Who is this group for?">
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </section>

        <section className="space-y-5 border-t border-line pt-6">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Monthly contribution (₹)">
              <Input
                required
                type="number"
                min={1}
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10000"
              />
            </Field>
            <Field label="Duration (months)">
              <Input
                required
                type="number"
                min={1}
                inputMode="numeric"
                value={durationMonths}
                onChange={(e) => setDurationMonths(e.target.value)}
                placeholder="20"
              />
            </Field>
          </div>
          <p className="-mt-2 text-xs text-muted">
            Total pool per month: members × contribution.
          </p>
        </section>

        <section className="space-y-5 border-t border-line pt-6">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start date">
              <DateInput
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>
            <Field label="Payment due day">
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
              Only paid members are eligible for selection
              <span className="block text-xs text-muted">
                Unpaid members can still pay later but cannot be picked this month.
              </span>
            </span>
          </label>
        </section>

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Creating…' : 'Create group'}
        </Button>
      </form>
    </Page>
  )
}
