import React, { useEffect, useRef, useState } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import './DemoAssetsPanel.css';

interface DemoAsset {
  id: string;
  title: string;
  subtitle: string;
  type: 'slides' | 'video' | 'infographic' | 'graph' | 'podcast' | 'datatable';
  thumbnail: string;
  mediaUrl?: string;
}

const DEMO_ASSETS: DemoAsset[] = [
  {
    id: 'podcast',
    title: 'Deep Dive Podcast',
    subtitle: 'Cassidy & Mark',
    type: 'podcast',
    thumbnail: '/demo-assets/slides-thumbnail.png',
    mediaUrl: '/demo-assets/podcast-demo.mp3',
  },
  {
    id: 'slides',
    title: 'Presentation Deck',
    subtitle: '12 slides • Board Briefing',
    type: 'slides',
    thumbnail: '/demo-assets/slides-thumbnail.png',
    mediaUrl: '/demo-assets/presentation-deck-golden-triangle.pdf',
  },
  {
    id: 'video',
    title: 'Video Summary',
    subtitle: '4:12 • AI Generated',
    type: 'video',
    thumbnail: '/demo-assets/slides-thumbnail.png',
    mediaUrl: 'https://www.youtube.com/embed/rcdQ3MP42Iw',
  },
  {
    id: 'infographic',
    title: 'District Infographic',
    subtitle: 'Visual Impact Summary',
    type: 'infographic',
    thumbnail: '/demo-assets/infographic-golden-triangle.png',
  },
  {
    id: 'graph',
    title: 'Knowledge Graph',
    subtitle: 'Entity Relationships',
    type: 'graph',
    thumbnail: '/demo-assets/knowledge-graph.png',
  },
  {
    id: 'datatable',
    title: 'Data Table',
    subtitle: '12 slides • Board Briefing',
    type: 'datatable',
    thumbnail: '/demo-assets/data-table-DC.PNG',
  },
];

export function DemoAssetsPanel() {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeAsset, setActiveAsset] = useState<DemoAsset | null>(null);

  const handleAssetClick = (asset: DemoAsset) => {
    setActiveAsset(asset);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setActiveAsset(null);
  };

  return (
    <>
      <div className="demo-assets-panel">
        <h4 className="demo-assets-panel__title">Generated Project Artifacts</h4>
        <div className="demo-assets-grid">
          {DEMO_ASSETS.map((asset) => (
            <div
              key={asset.id}
              className={`demo-asset-card demo-asset-card--${asset.type}`}
              onClick={() => handleAssetClick(asset)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleAssetClick(asset);
              }}
            >
              <div className="demo-asset-card__thumbnail">
                <img src={asset.thumbnail} alt={asset.title} />
                {(asset.type === 'video' || asset.type === 'podcast') && (
                  <div className="demo-asset-card__play-overlay">
                    <span className="demo-asset-card__play-icon">▶</span>
                  </div>
                )}
              </div>
              <div className="demo-asset-card__info">
                <span className="demo-asset-card__title">{asset.title}</span>
                <span className="demo-asset-card__subtitle">{asset.subtitle}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {modalOpen && activeAsset && (
        <div className="demo-modal-overlay" onClick={closeModal}>
          <div className="demo-modal" onClick={(e) => e.stopPropagation()}>
            <button className="demo-modal__close" onClick={closeModal}>
              ×
            </button>
            <h3 className="demo-modal__title">{activeAsset.title}</h3>

            {activeAsset.type === 'video' && activeAsset.mediaUrl && (
              <div className="demo-modal__video-container">
                <PlyrVideoPlayer src={activeAsset.mediaUrl} />
              </div>
            )}

            {activeAsset.type === 'slides' && activeAsset.mediaUrl && (
              <div className="demo-modal__pdf-container">
                <iframe
                  className="demo-modal__pdf"
                  src={activeAsset.mediaUrl}
                  title={activeAsset.title}
                />
              </div>
            )}

            {activeAsset.type === 'podcast' && activeAsset.mediaUrl && (
              <div className="demo-modal__audio-container">
                <PlyrAudioPlayer src={activeAsset.mediaUrl} />
              </div>
            )}

            {(activeAsset.type === 'infographic' ||
              activeAsset.type === 'graph' ||
              activeAsset.type === 'datatable' ||
              (activeAsset.type === 'slides' && !activeAsset.mediaUrl)) && (
              <img
                className="demo-modal__image"
                src={activeAsset.thumbnail}
                alt={activeAsset.title}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function PlyrAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerRef = useRef<Plyr | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    playerRef.current?.destroy();
    playerRef.current = new Plyr(el, {
      controls: ['play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings'],
      settings: ['speed'],
      speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
    });

    // Autoplay when opened.
    void el.play().catch(() => {
      // Autoplay can be blocked; controls still available.
    });

    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [src]);

  return <audio ref={audioRef} src={src} />;
}

function PlyrVideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<Plyr | null>(null);

  const videoId = src.includes('youtube.com/embed/')
    ? src.split('youtube.com/embed/')[1].split('?')[0]
    : src;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    playerRef.current?.destroy();
    playerRef.current = new Plyr(el, {
      controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
    });

    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId]);

  return (
    <div
      ref={videoRef}
      data-plyr-provider="youtube"
      data-plyr-embed-id={videoId}
      className="plyr-video-wrapper"
    />
  );
}

export default DemoAssetsPanel;
