import React from 'react';
import { DEAL_ROOM_TABS, DEAL_ROOM_TAB_LABELS, DEAL_ROOM_TAB_ICONS } from '../../types/dealRoom';
import type { DealRoomTab } from '../../types/dealRoom';

export interface TabConfig {
  skill_key: string;
  tab_label: string;
  sort_order: number;
}

interface DealRoomTabsProps {
  activeTab: DealRoomTab;
  onTabChange: (tab: DealRoomTab) => void;
  /** Tenant-specific tab config. Falls back to default 5 BID tabs if null. */
  tabConfig?: TabConfig[] | null;
}

const DealRoomTabs: React.FC<DealRoomTabsProps> = ({ activeTab, onTabChange, tabConfig }) => {
  // Use tenant config if available, otherwise default BID tabs
  const tabs = tabConfig
    ? tabConfig.map(t => ({
        key: t.skill_key as DealRoomTab,
        label: t.tab_label,
        icon: DEAL_ROOM_TAB_ICONS[t.skill_key as DealRoomTab] || '\u{1F4C4}',
      }))
    : DEAL_ROOM_TABS.map(tab => ({
        key: tab,
        label: DEAL_ROOM_TAB_LABELS[tab],
        icon: DEAL_ROOM_TAB_ICONS[tab],
      }));

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-[#0B1120]">
      <div className="flex items-center gap-2 flex-wrap">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                  : 'bg-white/[0.06] text-white/70 border border-white/10 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Export DOCX button is in DealRoomHeader */}
    </div>
  );
};

export default DealRoomTabs;
