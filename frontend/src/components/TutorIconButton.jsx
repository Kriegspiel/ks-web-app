const pictograms = {
  save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z" /><path d="M7 21v-8h10v8M7 3v5h9" /></>,
  hint: <><path d="M9 18h6M10 21h4M8.5 14.5a6 6 0 1 1 7 0c-1 .8-1.5 1.5-1.5 3.5h-4c0-2-.5-2.7-1.5-3.5Z" /></>,
  reset: <><path d="M3 11a9 9 0 1 1 2.7 7M3 4v7h7" /></>,
  reveal: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  rename: <><path d="m16 3 5 5M3 21l5-1L21 7a2 2 0 0 0-5-5L3 15v6Z" /></>,
  cancel: <path d="m6 6 12 12M6 18 18 6" />,
}

export function TutorIcon({ name }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{pictograms[name]}</svg>
}

export default function TutorIconButton({ icon, label, ...props }) {
  return <button className="coach-icon-button" type="button" aria-label={label} title={label} {...props}><TutorIcon name={icon} /></button>
}
