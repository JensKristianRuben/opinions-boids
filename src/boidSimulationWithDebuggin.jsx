import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Zap, Users, TrendingUp, X, Grid, SkipForward, Eye, EyeOff } from 'lucide-react';

const GridboidSimulation = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [isRunning, setIsRunning] = useState(true);
  
  // NYT: Debugging states
  const [debugMode, setDebugMode] = useState(false);
  const [debugCellIndex, setDebugCellIndex] = useState(0);

  const [params, setParams] = useState({
    userBoidCount: 300,
    opinionBoidCount: 8,
    algorithm: 'optimized',
    speed: 1.0,
    showGrid: false 
  });

  const [metrics, setMetrics] = useState({
    fps: 60,
    computeTime: 0,
    checks: 0,
    polarization: 0
  });

  const [menuOpen, setMenuOpen] = useState(false);

  const simRef = useRef({
    userBoids: [],
    opinionBoids: [],
    lastTime: 0,
    frameCount: 0,
    fpsTime: 0,
    gridSize: 50
  });

  // Initialize simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sim = simRef.current;
    sim.userBoids = [];
    sim.opinionBoids = [];

    // Create opinion boids
    for (let i = 0; i < params.opinionBoidCount; i++) {
      sim.opinionBoids.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        opinion: Math.random() > 0.5 ? 1 : -1,
        radius: 30,
        phase: Math.random() * Math.PI * 2
      });
    }

    // Create user boids
    for (let i = 0; i < params.userBoidCount; i++) {
      sim.userBoids.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        influence: -1,
        speed: 2
      });
    }
  }, [params.userBoidCount, params.opinionBoidCount]);

  // Spatial grid optimization
  const buildGrid = (boids, canvas, gridSize) => {
    const cols = Math.ceil(canvas.width / gridSize);
    const rows = Math.ceil(canvas.height / gridSize);
    const grid = Array(rows).fill(null).map(() => Array(cols).fill(null).map(() => []));

    boids.forEach((boid, idx) => {
      const col = Math.floor(boid.x / gridSize);
      const row = Math.floor(boid.y / gridSize);
      if (row >= 0 && row < rows && col >= 0 && col < cols) {
        grid[row][col].push(idx);
      }
    });

    return { grid, cols, rows };
  };

  // Calculate influence (naive O(n²))
  const calculateInfluenceNaive = (userBoids, opinionBoids) => {
    let checks = 0;
    userBoids.forEach(user => {
      let strongestInfluence = null;
      let strongestStrength = 0;

      opinionBoids.forEach(opinion => {
        checks++;
        const dx = opinion.x - user.x;
        const dy = opinion.y - user.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const range = opinion.radius * 3;

        if (dist < range) {
          const strength = 1 - (dist / range);
          if (strength > strongestStrength) {
            strongestStrength = strength;
            strongestInfluence = opinion.opinion;
          }
        }
      });

      if (strongestInfluence !== null && strongestStrength > 0.3) {
        user.influence = strongestInfluence;
      }
    });
    return checks;
  };

  // Calculate influence (optimized)
  const calculateInfluenceOptimized = (userBoids, opinionBoids, canvas, gridSize) => {
    const { grid, cols, rows } = buildGrid(opinionBoids, canvas, gridSize);
    let checks = 0;

    userBoids.forEach(user => {
      const col = Math.floor(user.x / gridSize);
      const row = Math.floor(user.y / gridSize);
      let strongestInfluence = null;
      let strongestStrength = 0;

      for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r++) {
        for (let c = Math.max(0, col - 1); c <= Math.min(cols - 1, col + 1); c++) {
          grid[r][c].forEach(opinionIdx => {
            checks++;
            const opinion = opinionBoids[opinionIdx];
            const dx = opinion.x - user.x;
            const dy = opinion.y - user.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const range = opinion.radius * 3;

            if (dist < range) {
              const strength = 1 - (dist / range);
              if (strength > strongestStrength) {
                strongestStrength = strength;
                strongestInfluence = opinion.opinion;
              }
            }
          });
        }
      }

      if (strongestInfluence !== null && strongestStrength > 0.3) {
        user.influence = strongestInfluence;
      }
    });
    return checks;
  };

  const applyFlocking = (userBoids, canvas) => {
    const { grid, cols, rows } = buildGrid(userBoids, canvas, simRef.current.gridSize);

    userBoids.forEach((boid, idx) => {
      const col = Math.floor(boid.x / simRef.current.gridSize);
      const row = Math.floor(boid.y / simRef.current.gridSize);
      
      let nearbyBoids = [];
      for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r++) {
        for (let c = Math.max(0, col - 1); c <= Math.min(cols - 1, col + 1); c++) {
          grid[r][c].forEach(i => {
            if (i !== idx) nearbyBoids.push(userBoids[i]);
          });
        }
      }

      let separationX = 0, separationY = 0;
      let alignmentX = 0, alignmentY = 0;
      let cohesionX = 0, cohesionY = 0;
      let radicalCount = 0;

      nearbyBoids.forEach(other => {
        const dx = other.x - boid.x;
        const dy = other.y - boid.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 30 && dist > 0) {
          separationX -= dx / dist;
          separationY -= dy / dist;
        }

        if (dist < 80) {
          if (boid.influence === 1 && other.influence === 1) {
            alignmentX += other.vx;
            alignmentY += other.vy;
            cohesionX += other.x;
            cohesionY += other.y;
            radicalCount++;
          }
        }
      });

      boid.vx += (Math.random() - 0.5) * 0.3;
      boid.vy += (Math.random() - 0.5) * 0.3;

      if (boid.influence === 1) {
        boid.vx += separationX * 0.15;
        boid.vy += separationY * 0.15;

        if (radicalCount > 0) {
          boid.vx += (alignmentX / radicalCount - boid.vx) * 0.08;
          boid.vy += (alignmentY / radicalCount - boid.vy) * 0.08;
          
          const centerX = cohesionX / radicalCount;
          const centerY = cohesionY / radicalCount;
          boid.vx += (centerX - boid.x) * 0.025;
          boid.vy += (centerY - boid.y) * 0.025;
        }

        const targetSpeed = 3.5;
        const currentSpeed = Math.sqrt(boid.vx * boid.vx + boid.vy * boid.vy);
        if (currentSpeed > 0.1) {
          const speedFactor = targetSpeed / currentSpeed;
          boid.vx *= speedFactor * 0.15 + 0.85;
          boid.vy *= speedFactor * 0.15 + 0.85;
        }
      } else {
        boid.vx += separationX * 0.05;
        boid.vy += separationY * 0.05;

        const targetSpeed = 1.5;
        const currentSpeed = Math.sqrt(boid.vx * boid.vx + boid.vy * boid.vy);
        if (currentSpeed > 0.1) {
          const speedFactor = targetSpeed / currentSpeed;
          boid.vx *= speedFactor * 0.15 + 0.85;
          boid.vy *= speedFactor * 0.15 + 0.85;
        }
      }
    });
  };

  const updateSimulation = (canvas, deltaTime) => {
    // Hvis vi er i debug mode, opdater IKKE boid-fysikken
    if (debugMode) {
        // Vi beregner kun grid-strukturen her for at kunne bruge den i renderen,
        // men flytter ikke boids.
        return null;
    }

    const sim = simRef.current;
    const dt = deltaTime * params.speed;
    const startTime = performance.now();

    sim.opinionBoids.forEach(boid => {
      boid.x += boid.vx * dt;
      boid.y += boid.vy * dt;
      boid.phase += 0.02;

      if (boid.x < 0 || boid.x > canvas.width) boid.vx *= -1;
      if (boid.y < 0 || boid.y > canvas.height) boid.vy *= -1;
      boid.x = Math.max(0, Math.min(canvas.width, boid.x));
      boid.y = Math.max(0, Math.min(canvas.height, boid.y));
    });

    let checks;
    if (params.algorithm === 'naive') {
      checks = calculateInfluenceNaive(sim.userBoids, sim.opinionBoids);
    } else {
      checks = calculateInfluenceOptimized(sim.userBoids, sim.opinionBoids, canvas, sim.gridSize);
    }

    applyFlocking(sim.userBoids, canvas);

    sim.userBoids.forEach(boid => {
      boid.x += boid.vx * dt;
      boid.y += boid.vy * dt;

      if (boid.x < 0 || boid.x > canvas.width) boid.vx *= -1;
      if (boid.y < 0 || boid.y > canvas.height) boid.vy *= -1;
      boid.x = Math.max(0, Math.min(canvas.width, boid.x));
      boid.y = Math.max(0, Math.min(canvas.height, boid.y));
    });

    const avgInfluence = sim.userBoids.reduce((sum, b) => sum + b.influence, 0) / sim.userBoids.length;
    const variance = sim.userBoids.reduce((sum, b) => sum + Math.pow(b.influence - avgInfluence, 2), 0) / sim.userBoids.length;
    const polarization = Math.sqrt(variance);

    const computeTime = performance.now() - startTime;

    return { computeTime, checks, polarization };
  };

  // Render loop
  const render = (timestamp) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const sim = simRef.current;

    const deltaTime = sim.lastTime ? (timestamp - sim.lastTime) / 16.67 : 1;
    sim.lastTime = timestamp;

    const stats = updateSimulation(canvas, deltaTime);

    // 1. Clear Background
    // Hvis ikke debug mode, clear normalt. Hvis debug mode, redrawer vi ovenpå samme state
    // men vi clearer alligevel for at tegne grid-highlights rent.
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw standard grid (hvis tændt)
    if (params.showGrid || debugMode) { // Vis altid grid i debug mode
      ctx.strokeStyle = debugMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      
      for (let x = 0; x <= canvas.width; x += sim.gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y <= canvas.height; y += sim.gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }
    }

    // NYT: Debug / Inspection Visualization
    if (debugMode) {
        // Byg grid for at finde boids i den aktuelle celle
        const { grid, cols } = buildGrid(sim.userBoids, canvas, sim.gridSize);
        
        // Beregn col/row fra den lineære debugCellIndex
        const totalCells = grid.length * grid[0].length;
        const safeIndex = debugCellIndex % totalCells;
        const currentRow = Math.floor(safeIndex / cols);
        const currentCol = safeIndex % cols;

        // 1. Tegn den "Aktive" celle (Gul boks)
        ctx.strokeStyle = '#FFD700'; // Guld
        ctx.lineWidth = 3;
        ctx.strokeRect(
            currentCol * sim.gridSize, 
            currentRow * sim.gridSize, 
            sim.gridSize, 
            sim.gridSize
        );
        
        ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
        ctx.fillRect(
            currentCol * sim.gridSize, 
            currentRow * sim.gridSize, 
            sim.gridSize, 
            sim.gridSize
        );

        // 2. Tegn boids der er "Fundet" i denne celle
        // Vi gør dette FØR vi tegner alle andre boids, eller efter?
        // Lad os gemme dem og tegne en "glorie" omkring dem
        if (grid[currentRow] && grid[currentRow][currentCol]) {
            const boidsInCellIndices = grid[currentRow][currentCol];
            
            boidsInCellIndices.forEach(idx => {
                const boid = sim.userBoids[idx];
                ctx.beginPath();
                ctx.arc(boid.x, boid.y, 8, 0, Math.PI * 2);
                ctx.fillStyle = '#FFFFFF';
                ctx.fill();
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 2;
                ctx.stroke();
            });
        }
    }

    // 3. Draw opinion boids
    sim.opinionBoids.forEach(boid => {
      const pulse = Math.sin(boid.phase) * 0.3 + 0.7;
      const gradient = ctx.createRadialGradient(boid.x, boid.y, 0, boid.x, boid.y, boid.radius * 2.5 * pulse);
      
      if (boid.opinion === 1) {
        gradient.addColorStop(0, `rgba(255, 0, 150, ${0.6 * pulse})`);
        gradient.addColorStop(0.5, `rgba(255, 100, 180, ${0.3 * pulse})`);
        gradient.addColorStop(1, 'rgba(200, 0, 100, 0)');
      } else {
        gradient.addColorStop(0, `rgba(0, 200, 255, ${0.5 * pulse})`);
        gradient.addColorStop(0.5, `rgba(100, 220, 255, ${0.25 * pulse})`);
        gradient.addColorStop(1, 'rgba(0, 150, 200, 0)');
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(boid.x, boid.y, boid.radius * 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = boid.opinion === 1 ? '#ff0096' : '#00c8ff';
      ctx.beginPath();
      ctx.arc(boid.x, boid.y, boid.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    });

    // 4. Draw user boids
    sim.userBoids.forEach(boid => {
      let r, g, b, alpha;

      if (boid.influence === 1) {
        r = 255; g = 50; b = 150; alpha = 0.8;
      } else {
        r = 50; g = 200; b = 255; alpha = 0.7;
      }

      // Hvis vi er i debug mode, gør ikke-aktive boids lidt mørkere
      if (debugMode) alpha = 0.3;

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(boid.x, boid.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    sim.frameCount++;
    if (timestamp - sim.fpsTime > 1000 && stats) {
      setMetrics({
        fps: sim.frameCount,
        computeTime: stats.computeTime.toFixed(2),
        checks: stats.checks,
        polarization: stats.polarization.toFixed(3)
      });
      sim.frameCount = 0;
      sim.fpsTime = timestamp;
    }

    animationRef.current = requestAnimationFrame(render);
  };

  useEffect(() => {
    // Når vi starter/stopper, reset timer
    simRef.current.lastTime = 0;
    animationRef.current = requestAnimationFrame(render);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, debugMode, debugCellIndex, params]); // Tilføjet debug dependencies

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const handleReset = () => {
    setIsRunning(false);
    setDebugMode(false); // Reset debug mode
    setTimeout(() => {
      setParams({ ...params });
      setIsRunning(true);
    }, 100);
  };

  // NYT: Funktion til at steppe gennem grid
  const stepDebug = () => {
    setDebugCellIndex(prev => prev + 1);
  };

  const toggleDebugMode = () => {
    const newMode = !debugMode;
    setDebugMode(newMode);
    if (newMode) {
        setIsRunning(false); // Frys simulationen automatisk
        setParams(p => ({...p, showGrid: true})); // Tænd grid automatisk
    } else {
        setIsRunning(true);
        setParams(p => ({...p, showGrid: false}));
    }
  };

  const controlPanel = (
    <div className="w-80 bg-gray-800 text-white p-6 overflow-y-auto space-y-6">
      <h1 className="text-2xl font-bold mb-4">Opinion Boids</h1>

      <div className="flex gap-2">
        <button
          onClick={() => setIsRunning(!isRunning)}
          disabled={debugMode} // Deaktiver play hvis vi debugger
          className={`flex-1 px-4 py-2 rounded flex items-center justify-center gap-2 ${
            debugMode ? 'bg-gray-600 opacity-50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isRunning ? <Pause size={18} /> : <Play size={18} />}
          {isRunning ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={handleReset}
          className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded"
        >
          <RotateCcw size={18} />
        </button>
      </div>

      <div className="space-y-4">
        
        {/* ... (Eksisterende sliders) ... */}
        
        <div>
          <label className="flex items-center gap-2 mb-2">
            <Users size={16} />
            User Boids: {params.userBoidCount}
          </label>
          <input
            type="range"
            min="50"
            max="1000"
            step="50"
            value={params.userBoidCount}
            onChange={(e) => setParams({ ...params, userBoidCount: parseInt(e.target.value) })}
            className="w-full"
          />
        </div>

        <div>
          <label className="block mb-2">Opinion Boids: {params.opinionBoidCount}</label>
          <input
            type="range"
            min="3"
            max="15"
            value={params.opinionBoidCount}
            onChange={(e) => setParams({ ...params, opinionBoidCount: parseInt(e.target.value) })}
            className="w-full"
          />
        </div>

        <div>
           {/* NYT: Debugging sektion */}
           <div className="border-t border-gray-600 my-4 pt-4">
            <label className="block mb-3 font-semibold flex items-center gap-2 text-yellow-400">
                <Eye size={18} /> Inspection Mode
            </label>
            
            <button
                onClick={toggleDebugMode}
                className={`w-full mb-3 px-4 py-3 rounded flex items-center justify-center gap-2 font-bold ${
                debugMode ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-gray-700 hover:bg-gray-600'
                }`}
            >
                {debugMode ? <EyeOff size={18}/> : <Eye size={18}/>}
                {debugMode ? 'Exit Inspection' : 'Inspect Frame'}
            </button>

            {debugMode && (
                <div className="bg-gray-900 p-3 rounded space-y-2 animate-in fade-in slide-in-from-top-2">
                    <p className="text-xs text-gray-400 mb-2">
                        Simulationen er frosset. Tryk på "Next Cell" for at se hvordan algoritmen tjekker hver grid-celle.
                    </p>
                    <button
                        onClick={stepDebug}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded flex items-center justify-center gap-2"
                    >
                        <SkipForward size={18} />
                        Next Cell
                    </button>
                    <div className="text-xs font-mono text-center text-gray-500 mt-1">
                        Checking Cell Index: {debugCellIndex}
                    </div>
                </div>
            )}
           </div>
        </div>

        <div>
          <label className="block mb-2 font-semibold">Algorithm</label>
          <div className="space-y-2">
            <button
              onClick={() => setParams({ ...params, algorithm: 'optimized' })}
              className={`w-full px-4 py-2 rounded ${
                params.algorithm === 'optimized'
                  ? 'bg-green-600'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              Optimized O(n)
            </button>
            <button
              onClick={() => setParams({ ...params, algorithm: 'naive' })}
              className={`w-full px-4 py-2 rounded ${
                params.algorithm === 'naive'
                  ? 'bg-red-600'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              Naive O(n²)
            </button>
          </div>
        </div>

        <div>
          <label className="block mb-2 font-semibold flex items-center gap-2">
            <Grid size={16} /> Visualization
          </label>
          <button
            onClick={() => setParams({ ...params, showGrid: !params.showGrid })}
            disabled={debugMode} // Lås denne knap i debug mode (fordi grid er tvunget tændt)
            className={`w-full px-4 py-2 rounded flex items-center justify-between ${
              params.showGrid || debugMode ? 'bg-indigo-600' : 'bg-gray-700'
            }`}
          >
            <span>Show Grid</span>
            <span className="text-xs">{params.showGrid || debugMode ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      <div className="bg-gray-900 p-4 rounded text-sm space-y-2">
        <p className="font-semibold">Opinion Types:</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-pink-500"></div>
            <span className="text-xs"><strong>Radical:</strong> Fast, cluster together</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-cyan-400"></div>
            <span className="text-xs"><strong>Neutral:</strong> Calm, slower movement</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full h-screen bg-gray-900 flex">
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #1a0a2a 100%)' }}
        />
        
        <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white p-4 rounded-lg font-mono text-sm space-y-2">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-yellow-400" />
            <span>FPS: {metrics.fps}</span>
          </div>
          <div>Compute: {metrics.computeTime}ms</div>
          <div>Checks: {metrics.checks.toLocaleString()}</div>
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-400" />
            <span>Polarization: {metrics.polarization}</span>
          </div>
          {debugMode && (
              <div className="text-yellow-400 font-bold border-t border-gray-600 pt-2 mt-2">
                  ⚠ INSPECTION MODE
              </div>
          )}
        </div>
      </div>

      <button
        className="md:hidden fixed top-4 left-4 z-40 bg-blue-600 text-white p-3 rounded-full shadow-lg"
        onClick={() => setMenuOpen(true)}
        aria-label="Open settings"
      >
        ⚙️
      </button>

      <div className="hidden md:block">
        {controlPanel}
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex items-start justify-end p-4">
          <div className="absolute inset-0 bg-black bg-opacity-60" onClick={() => setMenuOpen(false)} />
          <div className="relative w-full max-w-lg h-4/5 overflow-hidden rounded-lg z-10">
            <div className="absolute top-3 right-3 z-20">
              <button
                onClick={() => setMenuOpen(false)}
                className="bg-gray-800/80 text-white p-2 rounded-full"
                aria-label="Close settings"
              >
                <X size={18} />
              </button>
            </div>
            <div className="h-full overflow-y-auto">
              {controlPanel}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GridboidSimulation;