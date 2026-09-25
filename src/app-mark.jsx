export function AppMark({ studio = false }) {
  return <svg className="app-mark" viewBox="0 0 64 64" role="img" aria-label={studio ? 'Stageplot Studio' : 'Stageplot'}>
    <rect x="3" y="3" width="58" height="58" rx="14" fill="#171815" stroke="#d6ff46" strokeWidth="3" />
    <path d="M13 17 H51 V47 Q32 55 13 47 Z" fill="#d6ff46" fillOpacity=".12" stroke="#d6ff46" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M32 17 V49 M13 32 H51" fill="none" stroke="#d6ff46" strokeWidth="1.5" strokeDasharray="3 3" opacity=".55" />
    <circle cx="22" cy="27" r="5" fill="#f5f3e9" stroke="none" />
    <circle cx="42" cy="27" r="5" fill="#f5f3e9" stroke="none" />
    <rect x="26" y="37" width="12" height="8" rx="2" fill="#f5f3e9" stroke="none" />
    <path d="M29 34 H35 M32 31 V37" fill="none" stroke="#ffad46" strokeWidth="2.5" strokeLinecap="round" />
    {studio && <g><circle cx="49" cy="15" r="12" fill="#ffad46" stroke="#171815" strokeWidth="3"/><text x="49" y="20" fill="#171815" stroke="none" fontFamily="Arial, sans-serif" fontSize="15" fontWeight="800" textAnchor="middle">S</text></g>}
  </svg>
}
