export function Mark({ className = 'brand-mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="16" fill="#c4623a" />
      <path d="M9 31.5c2.2-9.2 8.4-15.5 15-15.5s12.8 6.3 15 15.5" fill="#f6efe6" />
      <path d="M24 16.5c1.8 5.2 1.8 10.6 0 16" stroke="#c4623a" strokeWidth="1.6" fill="none" />
      <path d="M17.5 23c3 1.6 5 5 6.5 9.5M30.5 23c-3 1.6-5 5-6.5 9.5" stroke="#e7b08a" strokeWidth="1.15" fill="none" />
    </svg>
  )
}
