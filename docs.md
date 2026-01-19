render()
│
├──> updateSimulation()
│    │
│    ├──> (Flyt Opinion Boids)
│    │
│    ├──> calculateInfluenceOptimized() [HVIS valgt]
│    │    └──> buildGrid() (på Opinion Boids)
│    │
│    ├──> applyFlocking() [Køres ALTID]
│    │    └──> buildGrid() (på User Boids)
│    │
│    └──> (Beregn Polariserings-data)
│
├──> (Tegn/Render grafik på Canvas)
│
└──> requestAnimationFrame() -> Starter forfra




