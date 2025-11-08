import { SortValue } from '../contexts/SortContext'

interface Props {
  value: SortValue
  onChange: (v: SortValue) => void
}

export default function SortControl({ value, onChange }: Props) {
  const isAlpha = value === 'alpha' || value === 'alpha-desc'
  const isCreated = value === 'created' || value === 'created-desc'
  const isLabel = value === 'label' || value === 'label-desc'

  const nextAlpha: SortValue = isAlpha && value === 'alpha' ? 'alpha-desc' : 'alpha'
  const nextCreated: SortValue = isCreated && value === 'created' ? 'created-desc' : 'created'
  const nextLabel: SortValue = isLabel && value === 'label' ? 'label-desc' : 'label'

  return (
    <div className="inline-flex items-center rounded-md border bg-white p-0.5 text-xs">
      <button
        className={`px-2 py-1 rounded ${isAlpha ? 'bg-accent/10 text-accent' : 'hover:bg-gray-50'}`}
        onClick={() => onChange(nextAlpha)}
        title={value === 'alpha' ? 'Title Z → A' : 'Title A → Z'}
      >
        <svg className="icon-standard" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={value === 'alpha-desc' ? 'M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4' : 'M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12'} />
        </svg>
      </button>
      <button
        className={`px-2 py-1 rounded ${isCreated ? 'bg-accent/10 text-accent' : 'hover:bg-gray-50'}`}
        onClick={() => onChange(nextCreated)}
        title={value === 'created' ? 'Oldest first' : 'Newest first'}
      >
        <svg className="icon-standard" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={value === 'created-desc' ? 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' : 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'} />
        </svg>
      </button>
      {/* Removed due-date sorting per request */}
      <button
        className={`px-2 py-1 rounded ${isLabel ? 'bg-accent/10 text-accent' : 'hover:bg-gray-50'}`}
        onClick={() => onChange(nextLabel)}
        title={value === 'label' ? 'Label Z → A' : 'Label A → Z'}
      >
        <svg className="icon-standard" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      </button>
    </div>
  )
}
