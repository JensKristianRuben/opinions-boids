# Valg af algoritme

Projektet tilbyder to tilgange til at beregne påvirkning fra “opinion boids” på “user boids”:

1. Naiv algoritme (O(n²))
   Den naive metode sammenligner hver brugerboid med hver opinionsboid. Den er enkel og præcis, men bliver hurtigt tung, når antallet af boids vokser. Den egner sig mest til små datasæt eller som reference til test.

```js
const calculateInfluenceNaive = (userBoids, opinionBoids) => {
  let checks = 0;

  userBoids.forEach((user) => {
    let strongestInfluence = null;
    let strongestStrength = 0;

    opinionBoids.forEach((opinion) => {
      checks++;
      const dx = opinion.x - user.x;
      const dy = opinion.y - user.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const range = opinion.radius * 3;

      if (dist < range) {
        const strength = 1 - dist / range;
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
```

2. Optimeret algoritme med spatial grid (O(n))
   Den optimerede metode deler lærredet i et gitter og undersøger kun nabo-celler i stedet for hele mængden. Det reducerer antallet af nødvendige afstandsberegninger markant. Til en simulation med mange elementer er det et relevant valg, fordi man bevarer realtids­yde­lse uden at ændre på resultatets karakter.

```js
const calculateInfluenceOptimized = (userBoids, opinionBoids, canvas, gridSize) => {
  const { grid, cols, rows } = buildGrid(opinionBoids, canvas, gridSize);
  let checks = 0;

  userBoids.forEach((user) => {
    const col = Math.floor(user.x / gridSize);
    const row = Math.floor(user.y / gridSize);

    let strongestInfluence = null;
    let strongestStrength = 0;

    // Undersøg kun nabo-celler
    for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r++) {
      for (
        let c = Math.max(0, col - 1);
        c <= Math.min(cols - 1, col + 1);
        c++
      ) {
        grid[r][c].forEach((opinionIdx) => {
          checks++;

          const opinion = opinionBoids[opinionIdx];
          const dx = opinion.x - user.x;
          const dy = opinion.y - user.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const range = opinion.radius * 3;

          if (dist < range) {
            const strength = 1 - dist / range;
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
```

Gridet bruges også i flocking-funktionen, så projektet genbruger samme strategi to steder. Det giver en mere skalerbar løsning end ren brute force.

# Evaluering

## Styrker

Spatial grid giver en klar forbedring i ydeevne, og skiftet mellem algoritmer gør forskellen målbar for brugeren. Det er tydeligt at se hvordan checksne stiger O(n²) ved den naive tilgang og vice versa.

Visualiseringen er responsiv og giver løbende metrics, hvilket gør algoritmens effekt tydelig. Dog opstår der ikke en udfordring stor nok til at vi visuelt kan se fordelen ved den ene algoritme i kontrast til den anden - men vi kan følge med på checksne og se forskellen.

Parameterstyring gør det lettere at teste forskellige scenarier.

## Svagheder / forbedringsmuligheder

Gridet genopbygges fuldt hver frame. Det fungerer, men man kunne opnå lavere overhead ved at bruge en mere vedvarende datastruktur med opdateringer på flytning.

Flocking-reglerne er fokuseret på boids med samme påvirkning. Hvis man vil analysere polarisering dybere, kunne man også modellere frastødning eller “ekko-kamre” på flere niveauer.

## Samlet vurdering

Valget af en grid-baseret tilgang er passende til en simulation med mange agenter, og projektet demonstrerer forskellen tydeligt. Løsningen er effektiv nok til interaktiv brug og viser en klar forståelse af, hvor ydelsesflaskehalse normalt opstår i boid-lignende systemer.
