// Always use local dates, never UTC, to avoid timezone mismatch
// e.g., Saturday 9pm CT = Sunday in UTC — toISOString() would give wrong date

export function toLocalDateString(date) {
  const d = date || new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
