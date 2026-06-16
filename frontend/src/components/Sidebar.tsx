import React from "react";
import { Camera, Film, Image, Database, Eye } from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: "camera", label: "Live Camera", icon: Camera },
    { id: "video", label: "Process Video", icon: Film },
    { id: "image", label: "Scan Image", icon: Image },
    { id: "logs", label: "Plate Database", icon: Database },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-full shadow-sm">
      {/* Brand Header */}
      <div className="h-16 px-6 border-b border-slate-200 flex items-center gap-3 bg-gradient-to-r from-sky-50 to-white">
        <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white font-bold shadow-md shadow-sky-200">
          L
        </div>
        <div>
          <h1 className="font-bold text-slate-800 text-sm leading-tight">Lao Plate Recognition</h1>
          <span className="text-[10px] text-sky-600 font-semibold tracking-wider uppercase">Unified AI Core</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-sky-50 text-sky-600 shadow-sm border-l-4 border-sky-600 pl-3"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-sky-600" : "text-slate-400 group-hover:text-slate-600"}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer / System Status */}
      <div className="p-4 border-t border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span>API: Connected</span>
        </div>
        <p className="text-[10px] text-slate-400 mt-1">Version 1.0.0 (YOLOv8)</p>
      </div>
    </aside>
  );
};
