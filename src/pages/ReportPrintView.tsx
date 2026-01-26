// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

type BlockType = 'h1' | 'h2' | 'p';

type Block = {
  id: string;
  type: BlockType;
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  citationIds?: string[];
};

type Citation = {
  id: string;
  title: string;
  source: string;
  url?: string;
};

const ReportPrintView: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const storageKey = useMemo(() => `workspace:project:${projectId}:blocks`, [projectId]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setBlocks(JSON.parse(raw) as Block[]);
      const rc = localStorage.getItem(storageKey + ':citations');
      if (rc) setCitations(JSON.parse(rc) as Citation[]);
    } catch {}
  }, [storageKey]);

  const onPrint = () => window.print();
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Share link copied to clipboard');
    } catch {}
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Controls (hidden in print) */}
      <div className="no-print sticky top-0 z-10 bg-white border-b p-3 flex items-center gap-2 justify-end">
        <Link to={`/home`} className="px-3 py-1.5 border rounded">Exit</Link>
        <button onClick={onCopy} className="px-3 py-1.5 border rounded">Copy Share Link</button>
        <button onClick={onPrint} className="px-3 py-1.5 bg-[#1e3a8a] text-white rounded">Print / Save PDF</button>
      </div>

      <div className="max-w-3xl mx-auto p-8">
        {/* Cover/Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-semibold">Executive Project Report</h1>
            <div className="text-right text-sm text-gray-600">
              <div>Project: {projectId}</div>
              <div>{new Date().toLocaleDateString()}</div>
            </div>
          </div>
          <div className="mt-1 h-px bg-gray-200" />
        </div>

        {/* Content */}
        <article className="prose prose-gray max-w-none">
          {blocks.map((b) => {
            const Tag: any = b.type === 'h1' ? 'h1' : b.type === 'h2' ? 'h2' : 'p';
            const style = `${b.bold ? 'font-semibold ' : ''}${b.italic ? 'italic ' : ''}${b.strike ? 'line-through ' : ''}`;
            return (
              <Tag key={b.id} className={style}>
                {b.text}
                {b.citationIds && b.citationIds.length > 0 ? (
                  <span className="ml-1 text-xs align-super">
                    {b.citationIds.map((cid) => {
                      const idx = citations.findIndex((c) => c.id === cid);
                      return (
                        <sup key={cid} className="ml-1">[{idx + 1}]</sup>
                      );
                    })}
                  </span>
                ) : null}
              </Tag>
            );
          })}
        </article>

        {/* References */}
        {citations.length > 0 && (
          <section className="mt-10">
            <h3 className="text-xl font-semibold mb-2">References</h3>
            <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-800">
              {citations.map((c, i) => (
                <li key={c.id}>
                  <span className="font-medium">[{i + 1}]</span> {c.title} â€” {c.source}
                  {c.url ? (
                    <>
                      {' '}
                      <a className="text-blue-600 underline" href={c.url} target="_blank" rel="noreferrer">
                        source
                      </a>
                    </>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
};

export default ReportPrintView;

