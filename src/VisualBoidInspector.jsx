import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Zap, MousePointer2, Grid, X } from 'lucide-react';

const VisualBoidInspector = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  
  // Standard parametre
  const [params, setParams] = useState({
    userBoidCount: 200,
    opinionBoidCount: 5,
    speed: 1.0,
    showGrid: true // Vi tvinger grid til at være tændt for forståelsens skyld
  });

  // Visualization State
  const [vizState, setVizState] = useState({
    active: false,         // Er vi i "inspektions-mode"?
    targetIdx: null,       // Hvilken boid kigger vi på?
    neighborList: [],      // Liste over alle boids i de 9 celler
    currentCheckIdx: -1,   // Hvor langt er vi nået i animationen?
    gridCells: []          // Koordinater på de celler der lyser op
  });

  const simRef = useRef({
    userBoids: [],
    opinionBoids: [],
    lastTime: 0,
    gridSize: 50,
    cols: 0,
    rows: 0
  });

  // 1. Initialisering (Samme som før)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sim = simRef.current;
    sim.userBoids = [];
    sim.opinionBoids = []; // Vi bruger dem kun passivt i denne demo

    // Opret boids
    for (let i = 0; i < params.userBoidCount; i++) {
      sim.userBoids.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        id: i // Unikt ID til sammenligning
      });
    }
  }, [params.userBoidCount]);

  // 2. Spatial Grid Helper
  const getGridLocation = (boid, gridSize) => {
    return {
      col: Math.floor(boid.x / gridSize),
      row: Math.floor(boid.y / gridSize)
    };
  };

  // 3. Håndter klik på Canvas (Start Visualisering)
  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const sim = simRef.current;

    // Find nærmeste boid til musen
    let closestDist = Infinity;
    let closestIdx = -1;

    sim.userBoids.forEach((boid, idx) => {
      const dx = boid.x - mouseX;
      const dy = boid.y - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = idx;
      }
    });

    if (closestIdx !== -1 && closestDist < 50) {
      startVisualization(closestIdx);
    } else {
      // Klikker man i tomrummet, stopper vi visualiseringen
      setVizState(prev => ({ ...prev, active: false }));
    }
  };

  // 4. Forbered Visualisering data
  const startVisualization = (targetIdx) => {
    const sim = simRef.current;
    const targetBoid = sim.userBoids[targetIdx];
    const { col, row } = getGridLocation(targetBoid, sim.gridSize);
    const cols = Math.ceil(canvasRef.current.width / sim.gridSize);
    const rows = Math.ceil(canvasRef.current.height / sim.gridSize);

    // Find de 9 celler (Egen + 8 naboer)
    const activeCells = [];
    const neighborsToCheck = [];

    // Byg grid midlertidigt for at finde naboer hurtigt
    const grid = Array(rows).fill(null).map(() => Array(cols).fill(null).map(() => []));
    sim.userBoids.forEach((b, i) => {
        const c = Math.floor(b.x / sim.gridSize);
        const r = Math.floor(b.y / sim.gridSize);
        if(c >= 0 && c < cols && r >= 0 && r < rows) grid[r][c].push(i);
    });

    // Saml kandidater
    for (let r = row - 1; r <= row + 1; r++) {
      for (let c = col - 1; c <= col + 1; c++) {
        if (r >= 0 && r < rows && c >= 0 && c < cols) {
            // Gem celle info til tegning
            activeCells.push({ c, r, isCenter: (r === row && c === col) });
            
            // Hent alle boids i denne celle
            grid[r][c].forEach(idx => {
                if (idx !== targetIdx) { // Tjek ikke os selv
                    neighborsToCheck.push(idx);
                }
            });
        }
      }
    }

    setVizState({
        active: true,
        targetIdx: targetIdx,
        neighborList: neighborsToCheck,
        currentCheckIdx: 0,
        gridCells: activeCells
    });
  };

  // 5. Opdater Loop
  const update = (timestamp) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const sim = simRef.current;

    // A. Fysik (Kør KUN hvis vi IKKE visualiserer)
    if (!vizState.active) {
        sim.userBoids.forEach(boid => {
            boid.x += boid.vx * params.speed;
            boid.y += boid.vy * params.speed;

            // Bounce
            if (boid.x < 0 || boid.x > canvas.width) boid.vx *= -1;
            if (boid.y < 0 || boid.y > canvas.height) boid.vy *= -1;
            boid.x = Math.max(0, Math.min(canvas.width, boid.x));
            boid.y = Math.max(0, Math.min(canvas.height, boid.y));
        });
    } else {
        // B. Visualiserings Animation (Slow motion)
        // Vi opdaterer kun animationen hver 10. frame for at gøre det langsomt
        if (sim.frameCount % 10 === 0) {
            setVizState(prev => {
                if (prev.currentCheckIdx < prev.neighborList.length) {
                    return { ...prev, currentCheckIdx: prev.currentCheckIdx + 1 };
                }
                return prev; // Animation færdig, vent
            });
        }
    }

    sim.frameCount++;
    draw(ctx, canvas, sim);
    animationRef.current = requestAnimationFrame(update);
  };

  // 6. Tegne funktion
  const draw = (ctx, canvas, sim) => {
    // Clear
    ctx.fillStyle = '#0f172a'; // Mørk baggrund
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Tegn Grid
    if (params.showGrid) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= canvas.width; x += sim.gridSize) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y <= canvas.height; y += sim.gridSize) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }
    }

    // Tegn Highlights (hvis aktiv)
    if (vizState.active) {
        vizState.gridCells.forEach(cell => {
            ctx.fillStyle = cell.isCenter 
                ? 'rgba(0, 255, 100, 0.15)' // Center (Grøn)
                : 'rgba(255, 200, 0, 0.1)'; // Nabo (Gul)
            ctx.fillRect(cell.c * sim.gridSize, cell.r * sim.gridSize, sim.gridSize, sim.gridSize);
            
            ctx.strokeStyle = cell.isCenter ? '#00ff66' : '#ffcc00';
            ctx.strokeRect(cell.c * sim.gridSize, cell.r * sim.gridSize, sim.gridSize, sim.gridSize);
        });
    }

    // Tegn Boids
    sim.userBoids.forEach((boid, idx) => {
        let color = 'rgba(100, 200, 255, 0.4)'; // Default inaktiv boid
        let size = 3;

        // Hvis vi visualiserer
        if (vizState.active) {
            if (idx === vizState.targetIdx) {
                color = '#ffffff'; // Target (Hvid)
                size = 6;
            } else if (vizState.neighborList.includes(idx)) {
                // Er boiden blevet tjekket endnu?
                const listIdx = vizState.neighborList.indexOf(idx);
                if (listIdx < vizState.currentCheckIdx) {
                    // Allerede tjekket
                    color = 'rgba(255, 255, 255, 0.8)';
                } else if (listIdx === vizState.currentCheckIdx) {
                    // Tjekkes LIGE NU (Flash)
                    color = '#ff00ff'; 
                    size = 5;
                } else {
                    // Venter på at blive tjekket
                    color = 'rgba(255, 200, 0, 0.5)';
                }
            } else {
                color = 'rgba(255, 255, 255, 0.1)'; // Irrelevante boids fader ud
            }
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(boid.x, boid.y, size, 0, Math.PI * 2);
        ctx.fill();
    });

    // Tegn "Check lines" (Visualisering af algoritmen)
    if (vizState.active) {
        const target = sim.userBoids[vizState.targetIdx];
        
        // Loop igennem alle dem vi har tjekket indtil nu
        for (let i = 0; i <= Math.min(vizState.currentCheckIdx, vizState.neighborList.length - 1); i++) {
            const neighborIdx = vizState.neighborList[i];
            const neighbor = sim.userBoids[neighborIdx];
            
            const dx = neighbor.x - target.x;
            const dy = neighbor.y - target.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Tegn streg
            ctx.beginPath();
            ctx.moveTo(target.x, target.y);
            ctx.lineTo(neighbor.x, neighbor.y);
            
            if (dist < 40) { // Inden for radius (Simuleret alignment range)
                ctx.strokeStyle = '#00ff66'; // Grøn streg (Succes)
                ctx.lineWidth = 2;
            } else {
                ctx.strokeStyle = 'rgba(255, 50, 50, 0.3)'; // Rød streg (For langt væk)
                ctx.lineWidth = 1;
            }
            ctx.stroke();
        }

        // Tegn rækkevidden cirkel på target
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.arc(target.x, target.y, 40, 0, Math.PI * 2); // 40 er vores demo radius
        ctx.stroke();
    }
  };

  // Start loop
  useEffect(() => {
    simRef.current.lastTime = 0;
    animationRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationRef.current);
  }, [vizState]); // Genstart hvis state ændres

  // Resize handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-slate-900 w-full h-screen">
      <div className="relative w-full h-4/5 bg-slate-800 rounded-lg overflow-hidden border border-slate-700 shadow-xl">
        <canvas 
            ref={canvasRef} 
            className="w-full h-full cursor-crosshair"
            onClick={handleCanvasClick}
        />
        
        {/* Overlay Instruktion */}
        <div className="absolute top-4 left-4 bg-black/80 text-white p-4 rounded-lg max-w-sm pointer-events-none">
            <h2 className="text-lg font-bold text-blue-400 mb-2 flex items-center gap-2">
                <MousePointer2 size={18}/> 
                Interaktiv Grid Demo
            </h2>
            {vizState.active ? (
                <div className="space-y-2 text-sm">
                    <p><span className="text-green-400 font-bold">Grøn Boks:</span> Boidens egen celle.</p>
                    <p><span className="text-yellow-400 font-bold">Gule Bokse:</span> De 8 nabo-celler der tjekkes.</p>
                    <p className="border-t border-gray-600 pt-2">
                        Systemet ignorerer alle boids uden for disse 9 bokse.
                        Animationen viser hvordan den tjekker afstand til naboer en efter en.
                    </p>
                    <p className="text-gray-400 italic mt-2">Klik et andet sted for at stoppe.</p>
                </div>
            ) : (
                <p className="text-sm">
                    Klik på en af prikkerne (boids) for at fryse simuleringen og se
                    hvordan <strong>Spatial Partitioning</strong> fungerer i slow-motion.
                </p>
            )}
        </div>

        {/* Status */}
        <div className="absolute bottom-4 left-4 bg-black/80 text-white px-4 py-2 rounded-full text-xs font-mono">
            {vizState.active ? 
                `Checking neighbor ${vizState.currentCheckIdx} / ${vizState.neighborList.length}` : 
                "Running Simulation..."}
        </div>
      </div>
    </div>
  );
};

export default VisualBoidInspector;