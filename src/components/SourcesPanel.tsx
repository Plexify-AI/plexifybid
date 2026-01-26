import { useEffect, useMemo } from 'react';
import { useRealDocs } from '../contexts/RealDocsContext';
import SourceCard from './SourceCard';
import DemoAssetsPanel from './DemoAssetsPanel';

function arrayMove<T>(arr: T[], from: number, to: number) {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function SourcesPanel() {
  const {
    state,
    loadDocuments,
    reorderDocuments,
    toggleDocumentSelection,
    selectAllDocuments,
    deselectAllDocuments,
    getOrderedDocuments,
  } = useRealDocs();

  useEffect(() => {
    void loadDocuments('golden-triangle');
  }, [loadDocuments]);

  const documents = useMemo(() => getOrderedDocuments(), [getOrderedDocuments]);
  const selectedCount = state.selectedDocuments.length;
  const totalCount = state.documentOrder.length;

  const handleMoveDocument = (dragIndex: number, hoverIndex: number) => {
    if (dragIndex === hoverIndex) return;
    if (dragIndex < 0 || hoverIndex < 0) return;
    if (dragIndex >= state.documentOrder.length) return;
    if (hoverIndex >= state.documentOrder.length) return;
    reorderDocuments(arrayMove(state.documentOrder, dragIndex, hoverIndex));
  };

  return (
    <div className="space-y-4">
      <DemoAssetsPanel />

      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Source Materials{' '}
            <span className="text-sm font-normal text-gray-500">({totalCount})</span>
          </h2>

          <button
            type="button"
            className="text-sm font-medium text-indigo-700 hover:text-indigo-800"
            onClick={selectedCount === totalCount ? deselectAllDocuments : selectAllDocuments}
          >
            {selectedCount === totalCount ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {state.index ? (
          <p className="mt-1 text-sm text-gray-600">
            <span className="font-medium text-gray-900">{state.index.district}</span>
            <span className="mx-2">•</span>
            <span>{state.index.location}</span>
          </p>
        ) : null}

        <p className="mt-1 text-xs text-gray-500">Drag documents to set processing order</p>
      </div>

      {state.isLoading ? (
        <div className="text-sm text-gray-600">Loading documents…</div>
      ) : null}

      {state.error ? (
        <div className="text-sm text-red-700">{state.error}</div>
      ) : null}

      <div className="space-y-2">
        {documents.map((doc, idx) => (
          <SourceCard
            key={doc.id}
            document={doc}
            index={idx}
            isSelected={state.selectedDocuments.includes(doc.id)}
            onToggleSelect={toggleDocumentSelection}
            onMoveDocument={handleMoveDocument}
          />
        ))}

        {!state.isLoading && !state.error && documents.length === 0 ? (
          <div className="text-sm text-gray-600">No documents found.</div>
        ) : null}
      </div>
    </div>
  );
}
