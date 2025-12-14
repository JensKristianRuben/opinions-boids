import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Microscope, Layers, FastForward } from 'lucide-react';

const DeepScanVisualizer = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  
  // State: 'simulating' (boids flyver) eller 'scanning' (vi analyserer)
  const [mode, setMode] = useState('simulating'); 
  
  // NYT: State til at pause selve scanningen
  const [isPaused, setIsPaused] = useState(false);
  
  const [params, setParams] = useState({
    boidCount: 150,
    gridSize: 60,
    stepDelay: 150 // Hvor mange ms vi venter mellem hvert "tjek" (hastighed)
  });

  // State til at vise info på skærmen
  const [info, setInfo] = useState({
    status: "Simulation running",
    activeBoidId: null,
    neighborCount: 0,
    acceptedCount: 0
  });

  const simRef = useRef({
    boids: [],
    cols: 0,
    rows: 0,
    
    // Scanner Variabler
    timer: 0,
    currentGridX: 0,
    currentGridY: 0,
    boidsInCurrentCell: [], // Liste over boids i den celle vi kigger på
    currentBoidIndex: 0,    // Hvilken boid i cellen er vi nået til?
    
    neighborsToCheck: [],   // Køen af naboer vi skal tjekke
    currentNeighborIndex: 0,// Hvor langt er vi i køen?
    
    checkedResults: [],     // Gemmer resultaterne (grøn/rød) for at tegne dem
    state: 'find_cell'      // Tilstandsmaskine
  });

  // 1. Initialisering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const sim = simRef.current;
    sim.cols = Math.ceil(canvas.width / params.gridSize);
    sim.rows = Math.ceil(canvas.height / params.gridSize);
    sim.boids = [];

    for (let i = 0; i < params.boidCount; i++) {
      sim.boids.push({
        id: i,
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
      });
    }
  }, [params.boidCount]);

  // Nulstil pause når vi skifter mode
  useEffect(() => {
    setIsPaused(false);
  }, [mode]);

  // 2. Main Loop
  const update = (timestamp) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const sim = simRef.current;

    // A. Tegn Baggrund
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGridLines(ctx, canvas, sim.cols, sim.rows, params.gridSize);

    if (mode === 'simulating') {
      updatePhysics(canvas, sim);
      setInfo({ status: "Simulation running", activeBoidId: null, neighborCount: 0, acceptedCount: 0 });
    } else {
      // B. Kør Scanner Logik (Step-by-step) - KUN HVIS IKKE PAUSED
      if (!isPaused) {
          processScannerStep(timestamp, sim, canvas);
      }
      drawScannerOverlay(ctx, sim);
    }

    // C. Tegn Boids
    drawBoids(ctx, sim);

    animationRef.current = requestAnimationFrame(update);
  };

  // Fysik motor (Kun i sim mode)
  const updatePhysics = (canvas, sim) => {
    sim.boids.forEach(boid => {
      boid.x += boid.vx;
      boid.y += boid.vy;
      if (boid.x < 0 || boid.x > canvas.width) boid.vx *= -1;
      if (boid.y < 0 || boid.y > canvas.height) boid.vy *= -1;
      boid.x = Math.max(0, Math.min(canvas.width, boid.x));
      boid.y = Math.max(0, Math.min(canvas.height, boid.y));
    });
  };

  // --- DEN STORE LOGIK-MASKINE ---
  const processScannerStep = (timestamp, sim, canvas) => {
    // Vent på timer (Slow motion effekt)
    if (timestamp - sim.timer < params.stepDelay) return;
    sim.timer = timestamp;

    // Tilstandsmaskine
    switch (sim.state) {
      case 'find_cell':
        // Find næste celle med boids i
        let found = false;
        let loops = 0;
        // Vi looper indtil vi finder en celle med boids eller har tjekket alle
        while (!found && loops < (sim.cols * sim.rows)) {
            sim.boidsInCurrentCell = sim.boids.filter(b => {
                const c = Math.floor(b.x / params.gridSize);
                const r = Math.floor(b.y / params.gridSize);
                return c === sim.currentGridX && r === sim.currentGridY;
            });

            if (sim.boidsInCurrentCell.length > 0) {
                found = true;
                sim.currentBoidIndex = 0;
                sim.state = 'load_boid';
            } else {
                advanceGrid(sim);
                loops++;
            }
        }
        break;

      case 'load_boid':
        // Gør klar til at scanne naboer for den nuværende boid
        if (sim.currentBoidIndex >= sim.boidsInCurrentCell.length) {
            // Færdig med denne celle, gå videre
            advanceGrid(sim);
            sim.state = 'find_cell';
            return;
        }

        const activeBoid = sim.boidsInCurrentCell[sim.currentBoidIndex];
        
        // Find alle boids i de 9 omkringliggende celler
        sim.neighborsToCheck = sim.boids.filter(b => {
            if (b.id === activeBoid.id) return false; // Ikke sig selv
            const c = Math.floor(b.x / params.gridSize);
            const r = Math.floor(b.y / params.gridSize);
            return Math.abs(c - sim.currentGridX) <= 1 && Math.abs(r - sim.currentGridY) <= 1;
        });

        sim.currentNeighborIndex = 0;
        sim.checkedResults = []; // Nulstil farver
        sim.state = 'scan_neighbors';
        
        // Opdater UI Info
        setInfo({
            status: "Checking Neighbors",
            activeBoidId: activeBoid.id,
            neighborCount: sim.neighborsToCheck.length,
            acceptedCount: 0
        });
        break;

      case 'scan_neighbors':
        // Tjek én nabo ad gangen
        if (sim.currentNeighborIndex >= sim.neighborsToCheck.length) {
            // Alle naboer tjekket -> Næste boid
            sim.state = 'next_boid';
            return;
        }

        const active = sim.boidsInCurrentCell[sim.currentBoidIndex];
        const neighbor = sim.neighborsToCheck[sim.currentNeighborIndex];
        
        // Afstands beregning (Den tunge del!)
        const dx = neighbor.x - active.x;
        const dy = neighbor.y - active.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const accepted = dist < 40; // Hardcoded radius for demo

        // Gem resultat så vi kan tegne det (Grøn/Rød)
        sim.checkedResults.push({ boid: neighbor, accepted });
        
        // Opdater UI tæller
        setInfo(prev => ({
            ...prev,
            acceptedCount: accepted ? prev.acceptedCount + 1 : prev.acceptedCount
        }));

        sim.currentNeighborIndex++;
        break;

      case 'next_boid':
        // Lille pause før vi skifter boid, så man kan se resultatet
        sim.currentBoidIndex++;
        sim.state = 'load_boid';
        break;
    }
  };

  // Hjælpefunktion til at flytte grid cursor
  const advanceGrid = (sim) => {
    sim.currentGridX++;
    if (sim.currentGridX >= sim.cols) {
        sim.currentGridX = 0;
        sim.currentGridY++;
    }
    if (sim.currentGridY >= sim.rows) {
        sim.currentGridY = 0;
        sim.currentGridX = 0;
    }
  };

  // --- TEGNE FUNKTIONER ---

  const drawScannerOverlay = (ctx, sim) => {
    const size = params.gridSize;
    ctx.strokeStyle = 'rgba(255, 200, 0, 0.5)';
    ctx.lineWidth = 1;
    
    for (let r = sim.currentGridY - 1; r <= sim.currentGridY + 1; r++) {
        for (let c = sim.currentGridX - 1; c <= sim.currentGridX + 1; c++) {
            if (r >= 0 && r < sim.rows && c >= 0 && c < sim.cols) {
                ctx.strokeRect(c * size, r * size, size, size);
                ctx.fillStyle = 'rgba(255, 200, 0, 0.05)';
                ctx.fillRect(c * size, r * size, size, size);
            }
        }
    }

    // Tegn aktiv celle (Cyan)
    const cx = sim.currentGridX * size;
    const cy = sim.currentGridY * size;
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx, cy, size, size);
  };

  const drawBoids = (ctx, sim) => {
    const activeBoid = (mode === 'scanning' && sim.state !== 'find_cell') 
        ? sim.boidsInCurrentCell[sim.currentBoidIndex] 
        : null;

    sim.boids.forEach(boid => {
        let color = '#3b82f6';
        let size = 2;
        let opacity = 0.3;

        if (mode === 'simulating') {
            opacity = 1;
        } else if (activeBoid) {
            if (boid.id === activeBoid.id) {
                color = '#ffffff';
                size = 5;
                opacity = 1;
            } else {
                const result = sim.checkedResults.find(r => r.boid.id === boid.id);
                if (result) {
                    color = result.accepted ? '#22c55e' : '#ef4444';
                    size = 3;
                    opacity = 1;
                } else if (sim.neighborsToCheck.find(n => n.id === boid.id)) {
                    color = '#eab308';
                    opacity = 0.5;
                }
            }
        }

        ctx.globalAlpha = opacity;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(boid.x, boid.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    });

    if (mode === 'scanning' && sim.state === 'scan_neighbors' && activeBoid) {
        const currentNeighbor = sim.neighborsToCheck[sim.currentNeighborIndex];
        if (currentNeighbor) {
            ctx.beginPath();
            ctx.moveTo(activeBoid.x, activeBoid.y);
            ctx.lineTo(currentNeighbor.x, currentNeighbor.y);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
  };

  const drawGridLines = (ctx, canvas, cols, rows, size) => {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath(); ctx.moveTo(x * size, 0); ctx.lineTo(x * size, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * size); ctx.lineTo(canvas.width, y * size); ctx.stroke();
    }
  };

  useEffect(() => {
    animationRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationRef.current);
  }, [mode, params.stepDelay, isPaused]); // Tilføjet isPaused her

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white font-sans">
      {/* Top Bar */}
      <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center shadow-md z-10">
        <h1 className="text-xl font-bold flex items-center gap-2 text-blue-400">
            <Microscope size={24} />
            Deep Scan Visualizer
        </h1>
        
        <div className="flex items-center gap-6">
            {/* Controls til Scanning */}
            {mode === 'scanning' && (
                <div className="flex items-center gap-4">
                    {/* Pause/Resume Knap */}
                    <button 
                        onClick={() => setIsPaused(!isPaused)}
                        className={`flex items-center gap-2 px-4 py-1 rounded-full text-xs font-bold transition-colors ${
                            isPaused ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'bg-slate-600 hover:bg-slate-500'
                        }`}
                    >
                        {isPaused ? <Play size={14} fill="black" /> : <Pause size={14} />}
                        {isPaused ? "RESUME" : "PAUSE"}
                    </button>

                    {/* Speed Control */}
                    <div className="flex items-center gap-2 bg-slate-700 px-3 py-1 rounded-full text-xs">
                        <span>Slow</span>
                        <input 
                            type="range" min="10" max="500" step="10"
                            value={510 - params.stepDelay}
                            onChange={(e) => setParams({...params, stepDelay: 510 - parseInt(e.target.value)})}
                            className="w-24 accent-blue-500"
                        />
                        <span>Fast</span>
                    </div>
                </div>
            )}

            <div className="flex gap-2">
                <button 
                    onClick={() => setMode('simulating')}
                    className={`flex items-center gap-2 px-4 py-2 rounded font-semibold transition-all ${mode === 'simulating' ? 'bg-blue-600 shadow-lg shadow-blue-500/20' : 'bg-slate-700 hover:bg-slate-600'}`}
                >
                    <Play size={16} /> Run Sim
                </button>
                <button 
                    onClick={() => setMode('scanning')}
                    className={`flex items-center gap-2 px-4 py-2 rounded font-semibold transition-all ${mode === 'scanning' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-700 hover:bg-slate-600'}`}
                >
                    <Layers size={16} /> Start Deep Scan
                </button>
            </div>
        </div>
      </div>

      {/* Main View */}
      <div className="flex-1 relative bg-slate-900 overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full block" />
        
        {/* Info Box */}
        {mode === 'scanning' && (
            <div className="absolute top-4 left-4 w-64 bg-slate-800/90 border border-slate-600 backdrop-blur rounded-xl p-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-600 pb-2 mb-3">
                    <span className="text-xs font-mono text-gray-400">DEBUGGER</span>
                    {isPaused ? (
                        <span className="text-xs font-mono text-yellow-400 font-bold">❚❚ PAUSED</span>
                    ) : (
                        <span className="text-xs font-mono text-emerald-400 animate-pulse">● LIVE</span>
                    )}
                </div>

                <div className="space-y-3 text-sm">
                    {simRef.current.state === 'find_cell' ? (
                        <div className="flex items-center gap-2 text-gray-400">
                            <FastForward size={16} className="animate-spin"/>
                            Finding cell with boids...
                        </div>
                    ) : (
                        <>
                           <div className="flex justify-between items-center">
                                <span>Active Boid:</span>
                                <span className="font-mono text-white bg-slate-700 px-1 rounded">ID: {info.activeBoidId}</span>
                           </div>
                           
                           <div className="h-px bg-slate-700 my-2"></div>

                           <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-white rounded-full"></div>
                                <span className="text-gray-300">Subject (Active)</span>
                           </div>
                           <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                <span className="text-gray-300">Neighbor (Checked)</span>
                           </div>
                           <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                <span className="text-gray-300">Too Far (Checked)</span>
                           </div>

                           <div className="mt-4 pt-2 border-t border-slate-600">
                                <p className="text-xs text-center text-gray-400">
                                    Found <strong className="text-emerald-400">{info.acceptedCount}</strong> neighbors out of <strong className="text-yellow-400">{info.neighborCount}</strong> candidates in the 3x3 grid.
                                </p>
                           </div>
                        </>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default DeepScanVisualizer;