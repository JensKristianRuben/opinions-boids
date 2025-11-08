import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Zap, Users, TrendingUp } from 'lucide-react';

const BoidSimulation = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [isRunning, setIsRunning] = useState(true);
  const [params, setParams] = useState({
    userBoidCount: 300,
    opinionBoidCount: 8,
    algorithm: 'optimized',
    speed: 1.0
  });
  const [metrics, setMetrics] = useState({
    fps: 60,
    computeTime: 0,
    checks: 0,
    polarization: 0
  });

  // Simulation state
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
        opinion: Math.random() > 0.5 ? 1 : -1, // Only radical (1) or neutral (-1)
        radius: 30,
        phase: Math.random() * Math.PI * 2
      });
    }

    // Create user boids - all start as neutral
    for (let i = 0; i < params.userBoidCount; i++) {
      sim.userBoids.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        influence: -1, // All start as neutral (-1)
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

      // Only adopt new opinion if influence is strong enough
      if (strongestInfluence !== null && strongestStrength > 0.3) {
        user.influence = strongestInfluence;
      }
      // Keep current opinion otherwise (don't decay)
    });

    return checks;
  };

  // Calculate influence (optimized with spatial grid)
  const calculateInfluenceOptimized = (userBoids, opinionBoids, canvas, gridSize) => {
    const { grid, cols, rows } = buildGrid(opinionBoids, canvas, gridSize);
    let checks = 0;

    userBoids.forEach(user => {
      const col = Math.floor(user.x / gridSize);
      const row = Math.floor(user.y / gridSize);
      let strongestInfluence = null;
      let strongestStrength = 0;

      // Check only nearby cells
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

      // Only adopt new opinion if influence is strong enough
      if (strongestInfluence !== null && strongestStrength > 0.3) {
        user.influence = strongestInfluence;
      }
      // Keep current opinion otherwise (don't decay)
    });

    return checks;
  };

  // Flocking behavior
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

        // Separation - avoid getting too close
        if (dist < 30 && dist > 0) {
          separationX -= dx / dist;
          separationY -= dy / dist;
        }

        // Alignment and cohesion with similar opinions
        if (dist < 80) {
          // Only flock with boids that have the same radical opinion
          if (boid.influence === 1 && other.influence === 1) {
            alignmentX += other.vx;
            alignmentY += other.vy;
            cohesionX += other.x;
            cohesionY += other.y;
            radicalCount++;
          }
        }
      });

      // Random wandering for all boids
      boid.vx += (Math.random() - 0.5) * 0.3;
      boid.vy += (Math.random() - 0.5) * 0.3;

      // RADICAL influence (1): faster, attracted to similar boids
      if (boid.influence === 1) {
        // Strong separation for personal space
        boid.vx += separationX * 0.15;
        boid.vy += separationY * 0.15;

        // Strong attraction to other radical boids
        if (radicalCount > 0) {
          boid.vx += (alignmentX / radicalCount - boid.vx) * 0.08;
          boid.vy += (alignmentY / radicalCount - boid.vy) * 0.08;
          
          const centerX = cohesionX / radicalCount;
          const centerY = cohesionY / radicalCount;
          boid.vx += (centerX - boid.x) * 0.025;
          boid.vy += (centerY - boid.y) * 0.025;
        }

        // Speed boost for radical boids
        const targetSpeed = 3.5;
        const currentSpeed = Math.sqrt(boid.vx * boid.vx + boid.vy * boid.vy);
        if (currentSpeed > 0.1) {
          const speedFactor = targetSpeed / currentSpeed;
          boid.vx *= speedFactor * 0.15 + 0.85;
          boid.vy *= speedFactor * 0.15 + 0.85;
        }
      }
      // NEUTRAL influence (-1): calm, slower, independent movement
      else {
        // Minimal separation - calm boids don't mind proximity
        boid.vx += separationX * 0.05;
        boid.vy += separationY * 0.05;

        // Calm, slow speed
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

  // Update simulation
  const updateSimulation = (canvas, deltaTime) => {
    const sim = simRef.current;
    const dt = deltaTime * params.speed;
    const startTime = performance.now();

    // Update opinion boids
    sim.opinionBoids.forEach(boid => {
      boid.x += boid.vx * dt;
      boid.y += boid.vy * dt;
      boid.phase += 0.02;

      if (boid.x < 0 || boid.x > canvas.width) boid.vx *= -1;
      if (boid.y < 0 || boid.y > canvas.height) boid.vy *= -1;
      boid.x = Math.max(0, Math.min(canvas.width, boid.x));
      boid.y = Math.max(0, Math.min(canvas.height, boid.y));
    });

    // Calculate influences
    let checks;
    if (params.algorithm === 'naive') {
      checks = calculateInfluenceNaive(sim.userBoids, sim.opinionBoids);
    } else {
      checks = calculateInfluenceOptimized(sim.userBoids, sim.opinionBoids, canvas, sim.gridSize);
    }

    // Apply flocking
    applyFlocking(sim.userBoids, canvas);

    // Update user boids
    sim.userBoids.forEach(boid => {
      boid.x += boid.vx * dt;
      boid.y += boid.vy * dt;

      if (boid.x < 0 || boid.x > canvas.width) boid.vx *= -1;
      if (boid.y < 0 || boid.y > canvas.height) boid.vy *= -1;
      boid.x = Math.max(0, Math.min(canvas.width, boid.x));
      boid.y = Math.max(0, Math.min(canvas.height, boid.y));
    });

    // Calculate polarization
    const avgInfluence = sim.userBoids.reduce((sum, b) => sum + b.influence, 0) / sim.userBoids.length;
    const variance = sim.userBoids.reduce((sum, b) => sum + Math.pow(b.influence - avgInfluence, 2), 0) / sim.userBoids.length;
    const polarization = Math.sqrt(variance);

    const computeTime = performance.now() - startTime;

    return { computeTime, checks, polarization };
  };

  // Render loop
  const render = (timestamp) => {
    if (!isRunning) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const sim = simRef.current;

    const deltaTime = sim.lastTime ? (timestamp - sim.lastTime) / 16.67 : 1;
    sim.lastTime = timestamp;

    // Update
    const stats = updateSimulation(canvas, deltaTime);

    // Clear
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw opinion boids
    sim.opinionBoids.forEach(boid => {
      const pulse = Math.sin(boid.phase) * 0.3 + 0.7;
      
      // Glow effect
      const gradient = ctx.createRadialGradient(boid.x, boid.y, 0, boid.x, boid.y, boid.radius * 2.5 * pulse);
      
      if (boid.opinion === 1) {
        // Radical opinion - bright vibrant colors
        gradient.addColorStop(0, `rgba(255, 0, 150, ${0.6 * pulse})`);
        gradient.addColorStop(0.5, `rgba(255, 100, 180, ${0.3 * pulse})`);
        gradient.addColorStop(1, 'rgba(200, 0, 100, 0)');
      } else {
        // Neutral opinion - calm blue/teal colors
        gradient.addColorStop(0, `rgba(0, 200, 255, ${0.5 * pulse})`);
        gradient.addColorStop(0.5, `rgba(100, 220, 255, ${0.25 * pulse})`);
        gradient.addColorStop(1, 'rgba(0, 150, 200, 0)');
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(boid.x, boid.y, boid.radius * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = boid.opinion === 1 ? '#ff0096' : '#00c8ff';
      ctx.beginPath();
      ctx.arc(boid.x, boid.y, boid.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw user boids
    sim.userBoids.forEach(boid => {
      let r, g, b, alpha;

      if (boid.influence === 1) {
        // Radical - bright pink/magenta
        r = 255;
        g = 50;
        b = 150;
        alpha = 0.8;
      } else {
        // Neutral - calm teal/blue
        r = 50;
        g = 200;
        b = 255;
        alpha = 0.7;
      }

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(boid.x, boid.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Update FPS
    sim.frameCount++;
    if (timestamp - sim.fpsTime > 1000) {
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

  // Start/stop animation
  useEffect(() => {
    if (isRunning) {
      simRef.current.lastTime = 0;
      animationRef.current = requestAnimationFrame(render);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, params]);

  // Canvas resize
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
    setTimeout(() => {
      setParams({ ...params });
      setIsRunning(true);
    }, 100);
  };

  return (
    <div className="w-full h-screen bg-gray-900 flex">
      {/* Canvas */}
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #1a0a2a 100%)' }}
        />
        
        {/* Metrics Overlay */}
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
        </div>
      </div>

      {/* Control Panel */}
      <div className="w-80 bg-gray-800 text-white p-6 overflow-y-auto space-y-6">
        <h1 className="text-2xl font-bold mb-4">Opinion Boids</h1>

        {/* Playback Controls */}
        <div className="flex gap-2">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded flex items-center justify-center gap-2"
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

        {/* Parameters */}
        <div className="space-y-4">
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
            <label className="block mb-2">Speed: {params.speed.toFixed(1)}x</label>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={params.speed}
              onChange={(e) => setParams({ ...params, speed: parseFloat(e.target.value) })}
              className="w-full"
            />
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
        </div>

        {/* Info */}
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
          <p className="text-xs text-gray-400 mt-2">All boids start neutral. They keep their opinion once changed!</p>
        </div>
      </div>
    </div>
  );
};

export default BoidSimulation;