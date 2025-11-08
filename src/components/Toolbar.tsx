interface Props {
  onCheckAll: () => void
  onUncheckAll: () => void
  totalVisible: number
}

export default function Toolbar({ onCheckAll, onUncheckAll, totalVisible }: Props) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-white px-3 py-2">
      <span className="text-sm text-gray-600">{totalVisible} items</span>
      <div className="flex items-center gap-2">
        <button className="btn border-accent text-accent text-sm" onClick={onCheckAll} title="Mark all visible as complete">
          ✓ Check All
        </button>
        <button className="btn text-sm" onClick={onUncheckAll} title="Mark all visible as incomplete">
          ⟳ Uncheck All
        </button>
      </div>
    </div>
  )
}
