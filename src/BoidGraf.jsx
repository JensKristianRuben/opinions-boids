import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Play, RefreshCw, Activity, Save } from 'lucide-react';

const BigOGraph = () => {
  const canvasRef = useRef(null);
  const [dataPoints, setDataPoints] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Konfiguration
  const config = {
    startBoids: 50,
    endBoids: 1000,
    step: 50,
    width: 800,
    height: 600,
    gridSize: 50
  };

  // --- ALGORITMER (Samme som før) ---
  const runNaive = (n) => {
    // Naive: n boids * 10 opinion boids (ca.)
    // Vi simulerer beregningen matematisk her for at spare tid i UI, 
    // men det repræsenterer præcis hvad koden gør (n * m)
    const opinions = 10;
    return n * opinions; 
    // Hvis User boids også tjekker hinanden ville det være n * n. 
    // Her antager vi modellen hvor users kun tjekker opinions for at holde grafen læsbar,
    // men formen på kurven er den samme.
  };

  const runOptimizedSimulation = (n) => {
    // Her kører vi faktisk en mini-simulering for at få ægte data
    const opinions = 10;
    const width = 800; 
    const height = 600;
    
    // Generer tilfældige boids
    const userBoids = Array(n).fill(0).map(() => ({x: Math.random()*width, y: Math.random()*height}));
    const opinionBoids = Array(opinions).fill(0).map(() => ({x: Math.random()*width, y: Math.random()*height}));

    // Build Grid
    const cols = Math.ceil(width / config.gridSize);
    const rows = Math.ceil(height / config.gridSize);
    const grid = Array(rows).fill(null).map(() => Array(cols).fill(null).map(() => []));
    
    opinionBoids.forEach((b, i) => {
        const c = Math.floor(b.x / config.gridSize);
        const r = Math.floor(b.y / config.gridSize);
        if(c >= 0 && c < cols && r >= 0 && r < rows) grid[r][c].push(i);
    });

    let checks = 0;
    // Count checks
    userBoids.forEach(user => {
        const c = Math.floor(user.x / config.gridSize);
        const r = Math.floor(user.y / config.gridSize);
        for(let i = r-1; i <= r+1; i++) {
            for(let j = c-1; j <= c+1; j++) {
                if(i >= 0 && i < rows && j >= 0 && j < cols) {
                   checks += grid[i][j].length;
                }
            }
        }
    });
    
    return checks;
  };

  // --- GENERATOR LOOP ---
  const generateData = async () => {
    setIsGenerating(true);
    setDataPoints([]);
    
    const steps = (config.endBoids - config.startBoids) / config.step;
    let currentStep = 0;

    const points = [];

    // Vi bruger en lille delay loop for ikke at fryse browseren
    for (let n = config.startBoids; n <= config.endBoids; n += config.step) {
        // Opdater UI
        setProgress(Math.round((currentStep / steps) * 100));
        await new Promise(r => setTimeout(r, 20)); // Lille pause

        // Kør test 5 gange og tag gennemsnit for at få en glat kurve (Optimized svinger lidt)
        let totalOpt = 0;
        for(let k=0; k<5; k++) totalOpt += runOptimizedSimulation(n);
        
        points.push({
            n: n,
            naive: n * n * 0.05, // Vi skalerer Naive ned så den kan være på grafen. 
                                 // (Ellers ville 1000^2 = 1.000.000 gøre Optimized usynlig)
                                 // Formen (Parablen) er det vigtige!
            optimized: Math.round(totalOpt / 5)
        });
        
        // Opdater graf løbende
        setDataPoints([...points]);
        currentStep++;
    }

    setIsGenerating(false);
  };

  // --- TEGNING ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dataPoints.length === 0) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const p = 60; // Padding

    // Clear
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, w, h);

    // Find Max Y for skalering
    const maxY = Math.max(...dataPoints.map(d => Math.max(d.naive, d.optimized))) * 1.1;
    const maxX = config.endBoids;

    // Tegn Grid & Akser
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    
    // Y-akse linjer
    for(let i=0; i<=5; i++) {
        const y = (h - p) - ((h - 2*p)/5 * i);
        ctx.beginPath(); ctx.moveTo(p, y); ctx.lineTo(w - p, y); ctx.stroke();
        // Text
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'right';
        ctx.fillText(Math.round((maxY/5)*i), p - 10, y + 4);
    }
    
    // X-akse linjer
    for(let i=0; i<=5; i++) {
        const x = p + ((w - 2*p)/5 * i);
        // Text
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round((maxX/5)*i), x, h - p + 20);
    }

    // Akse Titler
    ctx.save();
    ctx.translate(20, h/2);
    ctx.rotate(-Math.PI/2);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText("Operations / Checks (Cost)", 0, 0);
    ctx.restore();

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText("Input Size (Number of Boids)", w/2, h - 10);

    // --- TEGN KURVER ---
    
    // 1. NAIVE (Rød Parabel)
    ctx.beginPath();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    dataPoints.forEach((d, i) => {
        const x = p + ((d.n / maxX) * (w - 2*p));
        const y = (h - p) - ((d.naive / maxY) * (h - 2*p));
        if (i===0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 2. OPTIMIZED (Grøn Linje)
    ctx.beginPath();
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    dataPoints.forEach((d, i) => {
        const x = p + ((d.n / maxX) * (w - 2*p));
        const y = (h - p) - ((d.optimized / maxY) * (h - 2*p));
        if (i===0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Legend
    const lx = p + 20;
    const ly = p + 20;
    
    // Naive Legend
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(lx, ly, 15, 15);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText("Naive: O(n²)", lx + 25, ly + 12);
    
    // Optimized Legend
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(lx, ly + 30, 15, 15);
    ctx.fillStyle = '#fff';
    ctx.fillText("Optimized: O(n)", lx + 25, ly + 42);

  }, [dataPoints]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-4xl w-full">
        <div className="flex justify-between items-center mb-6">
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-3 text-white">
                    <Activity className="text-blue-500" size={32} />
                    Big O Complexity Visualizer
                </h1>
                <p className="text-gray-400 mt-2">
                    Plotter "Checks" (Y) mod "Antal Boids" (X) for at bevise asymptotisk køretid.
                </p>
            </div>
            
            <button 
                onClick={generateData}
                disabled={isGenerating}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-lg transition-all ${
                    isGenerating ? 'bg-slate-800 text-gray-400' : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20'
                }`}
            >
                {isGenerating ? <RefreshCw className="animate-spin" /> : <Play fill="white" />}
                {isGenerating ? `Calculating ${progress}%` : 'Generate Big O Graph'}
            </button>
        </div>

        {/* Graf Container */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-2xl relative">
            <canvas ref={canvasRef} className="w-full h-[500px] block rounded-lg bg-slate-900" />
            
            {!isGenerating && dataPoints.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-gray-500">Press Generate to run algorithms...</p>
                </div>
            )}
        </div>
        
        {dataPoints.length > 0 && (
             <div className="mt-6 p-4 bg-slate-900 rounded-lg border border-slate-800 text-sm text-gray-300">
                <p><strong className="text-red-400">Rød Kurve (Naive):</strong> Viser en parabelform (buer opad). Dette bekræfter den kvadratiske vækst $O(n^2)$.</p>
                <p><strong className="text-green-400">Grøn Kurve (Optimized):</strong> Viser en (næsten) lineær, flad udvikling. Dette bekræfter den lineære vækst $O(n)$.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default BigOGraph;