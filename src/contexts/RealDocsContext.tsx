import React, {
  createContext,
  useCallback,
  useContext,
  useReducer,
} from 'react';
import type { RealDocsIndex, RealDocsState } from '../types/realDocs';
import { loadRealDocsIndex } from '../services/realDocsService';

type RealDocsAction =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; payload: RealDocsIndex }
  | { type: 'LOAD_ERROR'; payload: string }
  | { type: 'REORDER_DOCUMENTS'; payload: string[] }
  | { type: 'TOGGLE_DOCUMENT_SELECTION'; payload: string }
  | { type: 'SELECT_ALL_DOCUMENTS' }
  | { type: 'DESELECT_ALL_DOCUMENTS' };

const initialState: RealDocsState = {
  index: null,
  documentOrder: [],
  selectedDocuments: [],
  isLoading: false,
  error: null,
};

function realDocsReducer(state: RealDocsState, action: RealDocsAction): RealDocsState {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, isLoading: true, error: null };
    case 'LOAD_SUCCESS': {
      const docIds = action.payload.documents.map((d) => d.id);
      return {
        ...state,
        isLoading: false,
        index: action.payload,
        documentOrder: docIds,
        selectedDocuments: docIds,
        error: null,
      };
    }
    case 'LOAD_ERROR':
      return { ...state, isLoading: false, error: action.payload };
    case 'REORDER_DOCUMENTS':
      return { ...state, documentOrder: action.payload };
    case 'TOGGLE_DOCUMENT_SELECTION': {
      const docId = action.payload;
      const isSelected = state.selectedDocuments.includes(docId);
      return {
        ...state,
        selectedDocuments: isSelected
          ? state.selectedDocuments.filter((id) => id !== docId)
          : [...state.selectedDocuments, docId],
      };
    }
    case 'SELECT_ALL_DOCUMENTS':
      return { ...state, selectedDocuments: state.documentOrder };
    case 'DESELECT_ALL_DOCUMENTS':
      return { ...state, selectedDocuments: [] };
    default:
      return state;
  }
}

interface RealDocsContextValue {
  state: RealDocsState;
  loadDocuments: (districtSlug: string) => Promise<void>;
  reorderDocuments: (newOrder: string[]) => void;
  toggleDocumentSelection: (docId: string) => void;
  selectAllDocuments: () => void;
  deselectAllDocuments: () => void;
  getOrderedDocuments: () => RealDocsIndex['documents'];
}

const RealDocsContext = createContext<RealDocsContextValue | null>(null);

export function RealDocsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(realDocsReducer, initialState);

  const loadDocuments = useCallback(async (districtSlug: string) => {
    dispatch({ type: 'LOAD_START' });
    try {
      const index = await loadRealDocsIndex(districtSlug);
      dispatch({ type: 'LOAD_SUCCESS', payload: index });
    } catch (err) {
      dispatch({
        type: 'LOAD_ERROR',
        payload: err instanceof Error ? err.message : 'Failed to load documents',
      });
    }
  }, []);

  const reorderDocuments = useCallback((newOrder: string[]) => {
    dispatch({ type: 'REORDER_DOCUMENTS', payload: newOrder });
  }, []);

  const toggleDocumentSelection = useCallback((docId: string) => {
    dispatch({ type: 'TOGGLE_DOCUMENT_SELECTION', payload: docId });
  }, []);

  const selectAllDocuments = useCallback(() => {
    dispatch({ type: 'SELECT_ALL_DOCUMENTS' });
  }, []);

  const deselectAllDocuments = useCallback(() => {
    dispatch({ type: 'DESELECT_ALL_DOCUMENTS' });
  }, []);

  const getOrderedDocuments = useCallback(() => {
    if (!state.index) return [];
    return state.documentOrder
      .map((id) => state.index!.documents.find((d) => d.id === id))
      .filter((d): d is NonNullable<typeof d> => d !== undefined);
  }, [state.index, state.documentOrder]);

  return (
    <RealDocsContext.Provider
      value={{
        state,
        loadDocuments,
        reorderDocuments,
        toggleDocumentSelection,
        selectAllDocuments,
        deselectAllDocuments,
        getOrderedDocuments,
      }}
    >
      {children}
    </RealDocsContext.Provider>
  );
}

export function useRealDocs() {
  const context = useContext(RealDocsContext);
  if (!context) {
    throw new Error('useRealDocs must be used within a RealDocsProvider');
  }
  return context;
}
