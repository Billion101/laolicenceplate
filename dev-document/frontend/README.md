# Frontend Module: Architecture & Folder Structure Guide

This document describes the user interface architecture, React components, state handling, and directory structure of the **React TypeScript Frontend Client** (`laolicenceplate/frontend`).

---

## 1. Frontend Architecture

The client-side interface is built as a single-page application (SPA) using **React**, **TypeScript**, and the **Vite** build engine. Styling is managed using Vanilla CSS coupled with modern CSS variables.

```
                  ┌───────────────────────────────┐
                  │            App.tsx            │
                  │   (Coordinates Active Tab)    │
                  └──────────────┬────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  ImageScanner   │     │  VideoScanner   │     │  PlateDatabase  │
│ (Uploads & scan)│     │ (Real-time cam) │     │ (History grid)  │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                     ┌───────────────────────┐
                     │    services/api.ts    │ (Axios calls backend)
                     └───────────┬───────────┘
                                 │ HTTP requests
                                 ▼
                         [FastAPI Backend]
```

### Key Subsystems & Core Views:

1.  **Service Client (`api.ts`):**
    *   Located in [api.ts](file:///c:/Users/billi/Desktop/laolicenceplate/frontend/src/services/api.ts). It exports functions `scanImage(file)` and `getScanLogs()` to communicate with the backend.
    *   Dynamically maps the server URL and processes backend URLs (prefixes static images with the backend origin).
2.  **Image Scanner View (`ImageScanner.tsx`):**
    *   Provides drag-and-drop or select file inputs.
    *   Displays side-by-side crop cards showing both the **Vehicle Crop** (context) and the **Plate Crop** (text zoom) once the backend responds, accompanied by full confidence, background/font color badges, and character metrics.
3.  **Video Scanner View (`VideoScanner.tsx`):**
    *   Integrates with standard webcams via `navigator.mediaDevices.getUserMedia`.
    *   Runs a frame capture loop using an HTML5 Canvas, executing scans asynchronously at configured intervals.
4.  **Plate Database History View (`PlateDatabase.tsx`):**
    *   Queries history logs on mount.
    *   Includes a search bar filtering by license plate letters or plate types in real-time.
    *   Renders card components with date timestamps, mapped Lao text translation, and side-by-side vehicle/plate images.

---

## 2. Directory and File Structure

Here is the file structure of the `/frontend` workspace directory:

```
laolicenceplate/frontend/
├── dist/                      # Production compiled output folder
├── public/                    # Static assets (favicons, public images)
├── src/                       # React source scripts
│   ├── assets/                # App assets (icons, brand logos)
│   ├── components/            # Reusable UI component views
│   │   ├── ImageScanner.tsx   # File upload scanner interface
│   │   ├── Navbar.tsx         # Navigation bar tab selector
│   │   ├── PlateDatabase.tsx  # MongoDB history grid and search panel
│   │   └── VideoScanner.tsx   # Real-time webcam frame scan panel
│   ├── services/              # API Client Services
│   │   └── api.ts             # Axios HTTP client requests mapping
│   ├── App.css                # Global components layout styles
│   ├── App.tsx                # Master app routing and view manager
│   ├── index.css              # Core typography and root CSS variables
│   └── main.tsx               # DOM insertion and React root mount
├── eslint.config.js           # Lint configuration rules
├── index.html                 # Main entry template HTML
├── package.json               # Node.js app manifest and scripts
├── tsconfig.json              # Main TypeScript config
├── vite.config.ts             # Vite server and compiler configurations
└── README.md                  # Development instructions
```

---

## 3. Technology Stack

*   **Core framework:** React 18
*   **Language:** TypeScript
*   **Build Tool:** Vite
*   **HTTP Client:** Axios
*   **Icon Library:** React Icons (`react-icons/fi`, `react-icons/fa`)
*   **Styling:** Custom CSS variables for clean light/dark modes
