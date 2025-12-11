import React from 'react';

export interface VideoSummaryCardProps {
  thumbnailUrl?: string;
  videoUrl?: string;
  title?: string;
}

const VideoSummaryCard: React.FC<VideoSummaryCardProps> = ({ thumbnailUrl, videoUrl, title = 'Visual Site Summary' }) => {
  return (
    <div className="bg-white rounded-xl border border-[#e5e7eb] p-3">
      <div className="relative aspect-video bg-gray-200 rounded overflow-hidden">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover" />
        ) : null}
        <a
          href={videoUrl || '#'}
          aria-label="Play video"
          className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/70"
        >
          ▶
        </a>
      </div>
      <div className="mt-2 text-sm text-gray-600">{title}</div>
    </div>
  );
};

export default VideoSummaryCard;
