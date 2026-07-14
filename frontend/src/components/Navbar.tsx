import React from "react";
import { Film, Image as ImageIcon, Database, Camera } from "lucide-react";

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: "live", label: "Live Camera", icon: Camera },
    { id: "video", label: "Process Video", icon: Film },
    { id: "image", label: "Scan Image", icon: ImageIcon },
    { id: "logs", label: "Plate Database", icon: Database },
  ];

  return (
    <header className="h-16 border-b border-slate-200 bg-white px-8 flex items-center justify-between shadow-sm shrink-0">
      {/* Brand Logo & Title */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white font-bold shadow-md shadow-sky-200">
          L
        </div>
        <div className="hidden sm:block">
          <h1 className="font-bold text-slate-800 text-sm leading-tight">Lao Plate Recognition</h1>
          <span className="text-[10px] text-sky-600 font-semibold tracking-wider uppercase">Unified AI Core</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex items-center gap-1 sm:gap-2 h-full">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-4 h-full border-b-2 font-semibold text-sm transition-all duration-200 ${
                isActive
                  ? "border-sky-600 text-sky-600 bg-sky-50/40"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/60"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-sky-600" : "text-slate-400"}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* System Status & Operator Profile */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="hidden sm:inline font-medium">API Connected</span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="text-right hidden lg:block">
            <p className="text-xs font-semibold text-slate-700">Lao Plate Analyst</p>
            <p className="text-[10px] text-slate-400">Operator Dashboard</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center text-sky-700 font-bold border border-sky-200 text-xs shadow-inner">
            OP
          </div>
        </div>
      </div>
    </header>
  );
};
