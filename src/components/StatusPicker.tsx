import type { RecipeStatus } from '../types'
import { RECIPE_STATUS } from '../types'

export function StatusPicker({
  value,
  onChange,
}: {
  value: RecipeStatus | null
  onChange: (value: RecipeStatus | null) => void
}) {
  return (
    <div className="rate-row" role="radiogroup" aria-label="레시피 상태">
      {RECIPE_STATUS.map((item) => (
        <button
          key={item.value}
          type="button"
          role="radio"
          data-status={item.value}
          aria-checked={value === item.value}
          aria-pressed={value === item.value}
          onClick={() => onChange(value === item.value ? null : item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
