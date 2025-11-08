import AttributesManager from '../components/AttributesManager'

export default function AttributesPage() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Attributes</h2>
      </div>
      <div className="card">
        <AttributesManager />
      </div>
    </div>
  )
}
