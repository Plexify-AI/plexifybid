import React from 'react';

interface DealRoomLayoutProps {
  leftPanel: React.ReactNode;
  centerPanel: React.ReactNode;
  rightPanel: React.ReactNode;
}

const panelCard =
  'rounded-xl overflow-y-auto overflow-x-hidden border border-[rgba(139,92,246,0.1)] shadow-[0_4px_24px_rgba(0,0,0,0.3)]';

const panelBg: React.CSSProperties = {
  background: 'rgba(19, 31, 62, 0.85)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
};

const gridStyle: React.CSSProperties = {
  gridTemplateColumns: 'minmax(220px, 260px) minmax(400px, 1fr) minmax(300px, 360px)',
};

const DealRoomLayout: React.FC<DealRoomLayoutProps> = ({ leftPanel, centerPanel, rightPanel }) => {
  return (
    <div
      className="flex-1 grid gap-2.5 overflow-hidden p-2.5"
      style={{
        ...gridStyle,
        background: '#0A1628',
        backgroundImage:
          'radial-gradient(ellipse at 65% 45%, rgba(140, 60, 220, 0.45) 0%, transparent 60%), radial-gradient(ellipse at 72% 38%, rgba(80, 120, 255, 0.30) 0%, transparent 54%)',
      }}
    >
      {/* Left Panel: Sources & Assets */}
      <div className={panelCard} style={panelBg}>
        {leftPanel}
      </div>

      {/* Center Panel: Editor */}
      <div className={panelCard} style={panelBg}>
        {centerPanel}
      </div>

      {/* Right Panel: AI Assistant */}
      <div className={panelCard} style={panelBg}>
        {rightPanel}
      </div>
    </div>
  );
};

export default DealRoomLayout;
