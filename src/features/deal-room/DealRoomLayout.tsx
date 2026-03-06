import React from 'react';

interface DealRoomLayoutProps {
  leftPanel: React.ReactNode;
  centerPanel: React.ReactNode;
  rightPanel: React.ReactNode;
}

const DealRoomLayout: React.FC<DealRoomLayoutProps> = ({ leftPanel, centerPanel, rightPanel }) => {
  return (
    <div className="flex-1 grid grid-cols-[280px_1fr_320px] gap-0 overflow-hidden bg-[#0B1120]">
      {/* Left Panel: Sources & Assets */}
      <div className="border-r border-white/10 overflow-y-auto bg-[#0D1526]">
        {leftPanel}
      </div>

      {/* Center Panel: Editor */}
      <div className="overflow-y-auto border-r border-white/10 bg-[#0F1729]">
        {centerPanel}
      </div>

      {/* Right Panel: AI Assistant */}
      <div className="overflow-y-auto bg-[#0D1526]">
        {rightPanel}
      </div>
    </div>
  );
};

export default DealRoomLayout;
