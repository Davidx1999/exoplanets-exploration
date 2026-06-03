/**
 * process_csv.js — Processador de dados do NASA Exoplanet Archive
 * 
 * Lê o CSV PSCompPars (Planetary Systems Composite Parameters),
 * extrai os exoplanetas com campos completos e exporta:
 * 1. allPlanets — Dataset completo para o dashboard sandbox.
 * 2. sampledPlanets — Amostra reduzida para manter a fluidez do storytelling.
 * 3. computedStats — Estatísticas gerais do dataset.
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');

// Caminhos dos arquivos (usando o arquivo exato presente no diretório data)
const csvFilePath = path.join(__dirname, 'data', 'PSCompPars_2026.06.02_14.29.54.csv');
const outputFilePath = path.join(__dirname, 'js', 'parsed_planets.js');

// ============================================
// FUNÇÕES AUXILIARES DE LIMPEZA
// ============================================

function safeNum(val) {
    if (val === undefined || val === null || val === '') return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
}

function classifyType(radius, mass) {
    if (radius !== null) {
        if (radius <= 1.25) return { pt: 'Terrestre', en: 'Terrestrial' };
        if (radius <= 2.0) return { pt: 'Super-Terra', en: 'Super Earth' };
        if (radius <= 6.0) return { pt: 'Netuniano', en: 'Neptune-like' };
        return { pt: 'Gigante Gasoso', en: 'Gas Giant' };
    }
    if (mass !== null) {
        if (mass <= 2.0) return { pt: 'Terrestre', en: 'Terrestrial' };
        if (mass <= 10.0) return { pt: 'Super-Terra', en: 'Super Earth' };
        if (mass <= 50.0) return { pt: 'Netuniano', en: 'Neptune-like' };
        return { pt: 'Gigante Gasoso', en: 'Gas Giant' };
    }
    return { pt: 'Desconhecido', en: 'Unknown' };
}

function getDecade(year) {
    if (!year) return 'Desconhecida';
    const d = Math.floor(year / 10) * 10;
    return `${d}s`;
}

function isCalcValue(reflink) {
    if (!reflink) return false;
    // NASA sinaliza valores calculados na coluna de reflink com "CALCULATED_VALUE"
    return reflink.toUpperCase().includes('CALCULATED_VALUE');
}

function normalizeMethod(method) {
    const map = {
        'Transit': 'Trânsito',
        'Radial Velocity': 'Velocidade Radial',
        'Direct Imaging': 'Imagem Direta',
        'Imaging': 'Imagem Direta',
        'Microlensing': 'Micro-lente',
        'Transit Timing Variations': 'Tempo de Trânsito',
        'Pulsar Timing': 'Pulsar Timing',
        'Astrometry': 'Astrometria',
        'Disk Kinematics': 'Cinemática de Disco',
        'Orbital Brightness Modulation': 'Modulação de Brilho',
        'Pulsation Timing Variations': 'Variação de Pulsação',
        'Eclipse Timing Variations': 'Variação de Eclipse'
    };
    return map[method] || 'Outros';
}

// Parser simples de linha CSV que preserva aspas
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

// ============================================
// PROCESSAMENTO LINHA POR LINHA
// ============================================

async function processLineByLine() {
    const fileStream = fs.createReadStream(csvFilePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let header = [];
    const planets = [];
    let lineCount = 0;

    for await (const line of rl) {
        if (line.startsWith('#')) continue; // Pular comentários de metadados da NASA

        const cols = parseCSVLine(line);

        if (header.length === 0) {
            header = cols;
            continue;
        }

        if (cols.length < header.length) continue;

        const row = {};
        header.forEach((colName, index) => {
            row[colName] = cols[index];
        });

        // Extrair propriedades físicas e estelares
        const name = row.pl_name;
        const star = row.hostname || 'Desconhecida';
        const method = row.discoverymethod;
        const year = parseInt(row.disc_year, 10);
        const mass = safeNum(row.pl_bmasse);
        const radius = safeNum(row.pl_rade);
        const orbper = safeNum(row.pl_orbper);
        const orbsmax = safeNum(row.pl_orbsmax);
        const dist = safeNum(row.sy_dist);
        const eqt = safeNum(row.pl_eqt);
        const starTemp = safeNum(row.st_teff);
        const numPlanets = parseInt(row.sy_pnum, 10) || null;

        // Identificação de valores calculados (para o filtro dinâmico)
        const bmassprov = row.pl_bmassprov || null;
        const radeReflink = row.pl_rade_reflink || '';
        const masseReflink = row.pl_bmasse_reflink || '';
        const isRadiusCalc = isCalcValue(radeReflink);
        const isMassCalc = isCalcValue(masseReflink);

        // Campos derivados
        const methodPT = normalizeMethod(method);
        const distLY = dist !== null ? Math.round(dist * 3.26156 * 100) / 100 : null;
        const typeInfo = classifyType(radius, mass);
        const decade = getDecade(isNaN(year) ? null : year);

        // Gravidade superficial relativa: g = M / R² (em unidades terrestres)
        let gravity = null;
        if (mass !== null && radius !== null && radius > 0) {
            gravity = Math.round((mass / (radius * radius)) * 100) / 100;
            if (gravity <= 0 || gravity > 1000) gravity = null;
        }

        planets.push({
            name,
            star,
            year: isNaN(year) ? null : year,
            method: method,
            methodPT,
            mass,
            radius,
            orbper,
            orbsmax,
            dist,
            distLY,
            starTemp,
            numPlanets,
            eqTemp: eqt,
            type: typeInfo.pt,
            typeEN: typeInfo.en,
            gravity,
            bmassprov,
            isRadiusCalc,
            isMassCalc,
            decade
        });

        lineCount++;
    }

    // Remover duplicados por segurança
    const uniquePlanets = [];
    const seen = new Set();
    for (const p of planets) {
        if (!seen.has(p.name)) {
            seen.add(p.name);
            uniquePlanets.push(p);
        }
    }

    // Ordenar por ano de descoberta
    uniquePlanets.sort((a, b) => (a.year || 0) - (b.year || 0));

    // Computar estatísticas globais do dataset
    const validYears = uniquePlanets.map(p => p.year).filter(y => y !== null);
    const minYear = Math.min(...validYears);
    const maxYear = Math.max(...validYears);

    const computedStats = {
        totalDiscoveries: uniquePlanets.length,
        yearRange: `${minYear} – ${maxYear}`,
        minYear,
        maxYear,
        methods: {},
        types: {},
        calcStats: {
            radiusCalc: uniquePlanets.filter(p => p.isRadiusCalc).length,
            massCalc: uniquePlanets.filter(p => p.isMassCalc).length,
            massMR: uniquePlanets.filter(p => p.bmassprov === 'M-R relationship').length,
            massMsini: uniquePlanets.filter(p => p.bmassprov === 'Msini').length
        }
    };

    // Contagem por métodos
    const allMethodsPT = [...new Set(uniquePlanets.map(p => p.methodPT))];
    allMethodsPT.forEach(m => {
        const subset = uniquePlanets.filter(p => p.methodPT === m);
        computedStats.methods[m] = {
            count: subset.length,
            percent: ((subset.length / uniquePlanets.length) * 100).toFixed(1).replace('.', ',') + '%'
        };
    });

    // Amostragem para storytelling (limita os pontos na Fase 1 para manter o desempenho)
    const sampledPlanets = [];
    const methodsGroup = {};
    uniquePlanets.forEach(p => {
        if (!methodsGroup[p.methodPT]) methodsGroup[p.methodPT] = [];
        methodsGroup[p.methodPT].push(p);
    });

    Object.entries(methodsGroup).forEach(([method, list]) => {
        // Amostrar limites confortáveis para renderização fluida D3
        let limit = 200;
        if (method === 'Imagem Direta') limit = 100;
        if (method === 'Micro-lente') limit = 150;
        const sampled = list.sort(() => 0.5 - Math.random()).slice(0, limit);
        sampledPlanets.push(...sampled);
    });

    sampledPlanets.sort((a, b) => (a.year || 0) - (b.year || 0));

    // Escrever o arquivo JS de saída
    const fileContent = `/**
 * parsed_planets.js — Dados processados do NASA Exoplanet Archive
 * Gerado automaticamente por process_csv.js
 */
export const computedStats = ${JSON.stringify(computedStats, null, 2)};
export const allPlanets = ${JSON.stringify(uniquePlanets)};
export const sampledPlanets = ${JSON.stringify(sampledPlanets)};
`;

    // Garantir que a pasta 'js' existe
    const jsFolder = path.dirname(outputFilePath);
    if (!fs.existsSync(jsFolder)) {
        fs.mkdirSync(jsFolder, { recursive: true });
    }

    fs.writeFileSync(outputFilePath, fileContent);
    console.log(`Sucesso! Gerado arquivo em: ${outputFilePath}`);
    console.log(`Total exoplanetas únicos: ${uniquePlanets.length}`);
}

processLineByLine().catch(err => {
    console.error('Erro no processamento:', err);
});
