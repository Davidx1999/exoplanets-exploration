const fs = require('fs');
const readline = require('readline');
const path = require('path');

const csvFilePath = path.join(__dirname, 'data', 'PS_2026.06.01_11.30.20.csv');
const outputFilePath = path.join(__dirname, 'js', 'parsed_planets.js');

async function processLineByLine() {
    const fileStream = fs.createReadStream(csvFilePath);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let header = [];
    const planets = [];
    let count = 0;

    for await (const line of rl) {
        if (line.startsWith('#')) {
            continue; // Skip comments
        }

        const cols = parseCSVLine(line);

        if (header.length === 0) {
            header = cols;
            continue;
        }

        if (cols.length < header.length) {
            continue;
        }

        const row = {};
        header.forEach((colName, index) => {
            row[colName] = cols[index];
        });

        // Filter default parameter sets only (default_flag = 1)
        if (row.default_flag !== '1') {
            continue;
        }

        const pl_name = row.pl_name;
        const method = row.discoverymethod;
        const year = parseInt(row.disc_year, 10);
        const orbsmax = parseFloat(row.pl_orbsmax);
        const orbper = parseFloat(row.pl_orbper);
        const mass = parseFloat(row.pl_bmasse);
        const radius = parseFloat(row.pl_rade);

        // Normalize method to Portuguese
        let normalizedMethod = 'Outros';
        if (method === 'Transit') normalizedMethod = 'Trânsito';
        else if (method === 'Radial Velocity') normalizedMethod = 'Velocidade Radial';
        else if (method === 'Direct Imaging' || method === 'Imaging') normalizedMethod = 'Imagem Direta';
        else if (method === 'Microlensing') normalizedMethod = 'Micro-lente';
        else if (method === 'Transit Timing Variations') normalizedMethod = 'Tempo de Trânsito';

        planets.push({
            name: pl_name,
            year: isNaN(year) ? null : year,
            method: normalizedMethod,
            originalMethod: method,
            orbsmax: isNaN(orbsmax) ? null : orbsmax,
            orbper: isNaN(orbper) ? null : orbper,
            mass: isNaN(mass) ? null : mass,
            radius: isNaN(radius) ? null : radius
        });

        count++;
    }

    console.log(`Parsed ${count} records with default_flag = 1.`);

    // Filter out duplicates (should not be duplicates for default_flag=1 but let's be safe)
    const uniquePlanets = [];
    const seen = new Set();
    for (const p of planets) {
        if (!seen.has(p.name)) {
            seen.add(p.name);
            uniquePlanets.push(p);
        }
    }

    console.log(`Unique planets: ${uniquePlanets.length}`);

    // Let's inspect some values of orbsmax
    const hasOrbsMax = uniquePlanets.filter(p => p.orbsmax !== null);
    console.log(`Unique planets with semi-major axis (orbsmax): ${hasOrbsMax.length}`);

    // If orbsmax is missing, we can estimate it from orbper (period in days) using Kepler's Third Law:
    // a^3 is proportional to T^2. For Earth, a = 1 AU, T = 365 days.
    // So a (in AU) = (T / 365.25)^(2/3) * (M_star)^(1/3). If we don't have M_star, assuming 1 solar mass:
    // a ~ (T / 365.25)^(2/3).
    uniquePlanets.forEach(p => {
        if (p.orbsmax === null && p.orbper !== null) {
            p.orbsmax = Math.pow(p.orbper / 365.25, 2/3);
            p.estimatedOrbsmax = true;
        }
    });

    const hasAnyOrbsmax = uniquePlanets.filter(p => p.orbsmax !== null);
    console.log(`Unique planets with any semi-major axis (incl. estimated): ${hasAnyOrbsmax.length}`);

    // Sort by discovery year and name
    uniquePlanets.sort((a, b) => {
        if (a.year !== b.year) return (a.year || 0) - (b.year || 0);
        return a.name.localeCompare(b.name);
    });

    // Compute dynamic statistics from unique planets
    const validYears = uniquePlanets.map(p => p.year).filter(y => y !== null && !isNaN(y));
    const minYear = Math.min(...validYears);
    const maxYear = Math.max(...validYears);
    
    const computedStats = {
        totalDiscoveries: uniquePlanets.length,
        yearRange: `${minYear} – ${maxYear}`,
        methods: {}
    };

    const allMethods = ['Trânsito', 'Velocidade Radial', 'Imagem Direta', 'Micro-lente', 'Tempo de Trânsito', 'Outros'];
    allMethods.forEach(m => {
        const count = uniquePlanets.filter(p => p.method === m).length;
        const percent = ((count / uniquePlanets.length) * 100).toFixed(1).replace('.', ',') + '%';
        const methodYears = uniquePlanets.filter(p => p.method === m).map(p => p.year).filter(y => y !== null && !isNaN(y));
        const firstYear = methodYears.length > 0 ? Math.min(...methodYears) : 2000;
        
        computedStats.methods[m] = {
            count,
            percent,
            year: firstYear
        };
    });

    console.log('Computed Statistics:', computedStats);

    // Group by method for sampling
    const methodsGroup = {};
    uniquePlanets.forEach(p => {
        if (!methodsGroup[p.method]) methodsGroup[p.method] = [];
        methodsGroup[p.method].push(p);
    });

    // Notable planets list to force-include
    const notableKeys = ['51 Peg b', 'TRAPPIST-1 e', 'Kepler-452 b', 'HD 209458 b', 'Beta Pic b', 'Kepler-186 f'];
    const isNotable = (p) => {
        return notableKeys.some(key => {
            const normName = p.name.toLowerCase().replace(/\s+/g, '');
            const normKey = key.toLowerCase().replace(/\s+/g, '');
            return normName === normKey || normName.includes(normKey);
        });
    };

    const notablePlanetsInData = uniquePlanets.filter(isNotable);
    console.log(`Forcing inclusion of ${notablePlanetsInData.length} notable planets:`, notablePlanetsInData.map(p => p.name));

    const notableNames = new Set(notablePlanetsInData.map(p => p.name));
    const sampledPlanets = [...notablePlanetsInData];

    Object.entries(methodsGroup).forEach(([method, list]) => {
        const candidates = list.filter(p => !notableNames.has(p.name));
        let limit = 200;
        if (method === 'Imagem Direta') limit = 100;
        if (method === 'Micro-lente') limit = 150;

        const methodNotablesCount = notablePlanetsInData.filter(p => p.method === method).length;
        const remainingLimit = Math.max(0, limit - methodNotablesCount);

        const sampled = candidates.sort(() => 0.5 - Math.random()).slice(0, remainingLimit);
        console.log(`Method: ${method} | Total candidates: ${candidates.length} | Limit: ${limit} | Notables: ${methodNotablesCount} | Sampled: ${sampled.length}`);
        sampledPlanets.push(...sampled);
    });

    // Re-sort by year and name for clean chronological storytelling
    sampledPlanets.sort((a, b) => {
        if (a.year !== b.year) return (a.year || 0) - (b.year || 0);
        return a.name.localeCompare(b.name);
    });

    console.log(`Total sampled planets for visualization: ${sampledPlanets.length}`);

    // Write to a JS file
    const fileContent = `// Real exoplanets parsed and computed from NASA archive CSV
export const computedStats = ${JSON.stringify(computedStats, null, 2)};

export const realPlanets = ${JSON.stringify(sampledPlanets, null, 2)};
`;
    fs.writeFileSync(outputFilePath, fileContent);
    console.log(`Wrote exoplanet data and stats to ${outputFilePath}`);
}

// Simple CSV line parser that handles quotes and commas
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

processLineByLine();
