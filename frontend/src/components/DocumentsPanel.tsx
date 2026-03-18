'use client'

// Documents section — placeholder links for now.
// Connect to SharePoint/Blob Storage via a dedicated endpoint in the future.

interface Document {
  id: string
  name: string
  type: 'pdf' | 'dwg' | 'xlsx' | 'docx' | 'other'
  url?: string
}

interface DocumentsPanelProps {
  deviceId?: string
}

function getDocumentIcon(type: Document['type']): string {
  const icons: Record<Document['type'], string> = {
    pdf: '📄',
    dwg: '📐',
    xlsx: '📊',
    docx: '📝',
    other: '📎',
  }
  return icons[type]
}

const PLACEHOLDER_DOCS: Document[] = [
  { id: '1', name: 'Instrukcja obsługi', type: 'pdf' },
  { id: '2', name: 'Schemat elektryczny', type: 'dwg' },
  { id: '3', name: 'Karta gwarancyjna', type: 'pdf' },
]

export default function DocumentsPanel({ deviceId: _deviceId }: DocumentsPanelProps) {
  const docs = PLACEHOLDER_DOCS

  if (docs.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500">Brak dokumentów</p>
    )
  }

  return (
    <div className="space-y-1">
      {docs.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
        >
          <span className="text-base" aria-hidden>
            {getDocumentIcon(doc.type)}
          </span>
          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{doc.name}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500 uppercase ml-auto flex-shrink-0">
            {doc.type}
          </span>
        </div>
      ))}
    </div>
  )
}
