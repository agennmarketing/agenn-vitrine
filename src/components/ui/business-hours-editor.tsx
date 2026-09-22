'use client'

import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { WEEKDAYS, type BusinessHours } from '@/lib/vitrines/service-segments'

// Dias e horários de atendimento (assistente e aba Agenda).
export function BusinessHoursEditor({ hours, onChange }: { hours: BusinessHours; onChange: (hours: BusinessHours) => void }) {
  return (
    <ul className="flex flex-col divide-y-2 divide-line rounded-card border-2 border-line-strong bg-surface">
      {WEEKDAYS.map((dayName, day) => {
        const entry = hours.find((item) => item.day === day)
        const toggle = () =>
          onChange(
            entry
              ? hours.filter((item) => item.day !== day)
              : [...hours, { day, open: '09:00', close: '18:00' }].sort((a, b) => a.day - b.day),
          )
        const setTime = (key: 'open' | 'close', value: string) =>
          onChange(hours.map((item) => (item.day === day ? { ...item, [key]: value } : item)))
        return (
          <li key={dayName} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
            <Switch checked={!!entry} onClick={toggle} aria-label={`Atende ${dayName.toLowerCase()}`} />
            <span className="w-20 font-extrabold text-ink">{dayName}</span>
            {entry ? (
              <span className="ml-auto flex items-center gap-2">
                <Input
                  type="time"
                  aria-label={`${dayName}: abre às`}
                  value={entry.open}
                  onChange={(event) => setTime('open', event.target.value)}
                  className="h-10 w-[6.5rem] px-2"
                />
                <span className="text-sm font-bold text-ink-muted">às</span>
                <Input
                  type="time"
                  aria-label={`${dayName}: fecha às`}
                  value={entry.close}
                  onChange={(event) => setTime('close', event.target.value)}
                  className="h-10 w-[6.5rem] px-2"
                />
              </span>
            ) : (
              <span className="ml-auto text-sm font-bold text-ink-muted">Fechado</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
