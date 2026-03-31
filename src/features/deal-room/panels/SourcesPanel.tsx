import React, { useRef, useState, useCallback } from 'react';
import { Upload, ChevronDown, ChevronRight, Volume2 } from 'lucide-react';
import SourceFileCard from '../components/SourceFileCard';
import ArtifactThumbnail from '../components/ArtifactThumbnail';
import type { DealRoomSource, DealRoomArtifact } from '../../../types/dealRoom';

interface SourcesPanelProps {
  sources: DealRoomSource[];
  artifacts: DealRoomArtifact[];
  uploading: boolean;
  uploadProgress: string;
  onUploadFile: (file: File) => Promise<any>;
  onDeleteSource: (sourceId: string) => Promise<boolean>;
  onArtifactClick?: (artifactType: string) => void;
}

const SourcesPanel: React.FC<SourcesPanelProps> = ({
  sources,
  artifacts,
  uploading,
  uploadProgress,
  onUploadFile,
  onDeleteSource,
  onArtifactClick,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [artifactsExpanded, setArtifactsExpanded] = useState(true);
  const [audioExpanded, setAudioExpanded] = useState(false);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await onUploadFile(file);
    }
  }, [onUploadFile]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      await onUploadFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [onUploadFile]);

  const audioArtifacts = artifacts.filter(a => ['podcast'].includes(a.artifact_type));
  const visualArtifacts = artifacts.filter(a => !['podcast'].includes(a.artifact_type));

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
        Sources & Assets
      </h3>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-emerald-400 bg-emerald-500/10'
            : 'border-white/20 hover:border-white/30 hover:bg-white/5'
        }`}
      >
        <Upload size={20} className="mx-auto text-white/40 mb-1" />
        <p className="text-sm text-white/60">
          {uploading ? uploadProgress : 'Drop files here or browse'}
        </p>
        <p className="text-xs text-white/30 mt-0.5">PDF, DOCX, TXT, CSV (max 10MB)</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,.csv"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Source file list */}
      {sources.length > 0 && (
        <div className="space-y-1">
          {sources.map((source) => (
            <SourceFileCard
              key={source.id}
              source={source}
              onDelete={onDeleteSource}
            />
          ))}
        </div>
      )}

      {/* Generated Artifacts */}
      {visualArtifacts.length > 0 && (
        <div>
          <button
            onClick={() => setArtifactsExpanded(!artifactsExpanded)}
            className="flex items-center gap-1 text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 hover:text-white/70"
          >
            {artifactsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Generated Artifacts ({visualArtifacts.length})
          </button>
          {artifactsExpanded && (
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))' }}>
              {visualArtifacts.map((artifact) => (
                <ArtifactThumbnail
                  key={artifact.id}
                  artifact={artifact}
                  onClick={() => onArtifactClick?.(artifact.artifact_type)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Audio */}
      {audioArtifacts.length > 0 && (
        <div>
          <button
            onClick={() => setAudioExpanded(!audioExpanded)}
            className="flex items-center gap-1 text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 hover:text-white/70"
          >
            {audioExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Volume2 size={12} />
            Audio ({audioArtifacts.length})
          </button>
          {audioExpanded && (
            <div className="space-y-2">
              {audioArtifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  className="p-2 rounded-lg bg-white/5 text-sm text-white/70"
                >
                  {artifact.title}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SourcesPanel;
