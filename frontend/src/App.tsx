import { useState } from "react";
import { Navbar } from "./components/Navbar";
import { VideoScanner } from "./components/VideoScanner";
import { ImageScanner } from "./components/ImageScanner";
import { PlateDatabase } from "./components/PlateDatabase";

function App() {
  const [activeTab, setActiveTab] = useState("image");

  const renderActiveView = () => {
    switch (activeTab) {
      case "video":
        return <VideoScanner />;
      case "image":
        return <ImageScanner />;
      case "logs":
        return <PlateDatabase />;
      default:
        return <ImageScanner />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 overflow-hidden font-sans antialiased">
      {/* Navigation Header */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Panel Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50">
        {/* Dynamic active view */}
        {renderActiveView()}
      </main>
    </div>
  );
}

export default App;
