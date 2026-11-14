import type { ServiceId } from '../../shared/types'
import { destinations } from '../services/registry'

interface Props {
  value: ServiceId
  exclude: ServiceId
  onChange: (id: ServiceId) => void
}

export function DestinationPicker({ value, exclude, onChange }: Props) {
  const options = Object.values(destinations).filter((d) => d.id !== exclude)

  return (
    <fieldset className="destinations">
      <legend>Convert to</legend>
      {options.map((destination) => (
        <label key={destination.id} className={destination.id === value ? 'chip selected' : 'chip'}>
          <input
            type="radio"
            name="destination"
            value={destination.id}
            checked={destination.id === value}
            onChange={() => onChange(destination.id)}
          />
          {destination.label}
        </label>
      ))}
    </fieldset>
  )
}
