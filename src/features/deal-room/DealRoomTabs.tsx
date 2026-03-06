import React from 'react';
import { FileDown } from 'lucide-react';
import { DEAL_ROOM_TABS, DEAL_ROOM_TAB_LABELS, DEAL_ROOM_TAB_ICONS } from '../../types/dealRoom';
import type { DealRoomTab } from '../../types/dealRoom';

interface DealRoomTabsProps {
  activeTab: DealRoomTab;
  onTabChange: (tab: DealRoomTab) => void;
}

const DealRoomTabs: React.FC<DealRoomTabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-[#0B1120]">
      <div className="flex items-center gap-2 flex-wrap">
        {DEAL_ROOM_TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                  : 'bg-white/[0.06] text-white/70 border border-white/10 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span>{DEAL_ROOM_TAB_ICONS[tab]}</span>
              <span>{DEAL_ROOM_TAB_LABELS[tab]}</span>
            </button>
          );
        })}
      </div>

      <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/15 text-white/80 hover:bg-white/5 transition-colors text-sm">
        <FileDown size={14} />
        Export DOCX
      </button>
    </div>
  );
};

export default DealRoomTabs;
