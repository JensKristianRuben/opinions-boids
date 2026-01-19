import React, { useState } from 'react';

// Import af alle dine komponenter
import BoidSimulation from './BoidSimulation';
import GridboidSimulation from './GridboidSimulation';
import VisualBoidInspector from './VisualBoidInspector';
import DeepScanVisualizer from './Gridscanner';
import BigOGraph from './boidGraf';
import BoidSimulationWithDebuggin from './boidSimulationWithDebuggin';
import BoidSimulationWithFullChecks from './BoidSimulationWithFullChecks';

function App() {
  // State til at styre hvilken side der vises. 
  // Standard er sat til 'fullChecks'
  const [currentView, setCurrentView] = useState('fullChecks');

  // Konfiguration af dine sider (Navn i menuen -> Komponent)
  const views = {
    fullChecks: { 
      label: 'Boids (Full Check Toggle)', 
      component: <BoidSimulationWithFullChecks /> 
    },
    graph: { 
      label: 'Big O Graf (Data)', 
      component: <BigOGraph /> 
    },
    visualInspector: { 
      label: 'Visual Inspector (Grid)', 
      component: <VisualBoidInspector /> 
    },
    scanner: { 
      label: 'Deep Scan Visualizer', 
      component: <DeepScanVisualizer /> 
    },
    original: { 
      label: 'Boids (Original)', 
      component: <BoidSimulation /> 
    },
    debug: { 
      label: 'Boids (Debug Mode)', 
      component: <BoidSimulationWithDebuggin /> 
    },
    gridSim: { 
      label: 'Grid Simulation', 
      component: <GridboidSimulation /> 
    },
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-900">
      
      {/* --- NAVIGATION MENU --- */}
      {/* Placeret i MIDTEN af toppen (left-1/2 -translate-x-1/2) */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] bg-gray-800/90 backdrop-blur-sm p-2 rounded-lg shadow-2xl border border-gray-600 flex items-center gap-3 transition-all hover:bg-gray-800">
        <label className="text-gray-400 text-xs font-bold uppercase tracking-wider whitespace-nowrap hidden sm:block">
          Vælg Visning:
        </label>
        <select 
          value={currentView}
          onChange={(e) => setCurrentView(e.target.value)}
          className="bg-gray-700 text-white text-sm py-1.5 px-3 rounded cursor-pointer outline-none hover:bg-gray-600 border border-gray-500 min-w-[220px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          {Object.keys(views).map((key) => (
            <option key={key} value={key}>
              {views[key].label}
            </option>
          ))}
        </select>
      </div>

      {/* --- HER VISES DEN VALGTE SIDE --- */}
      <div className="w-full h-full">
        {views[currentView].component}
      </div>

    </div>
  );
}

export default App;