/**
 * data.js — Camada de dados e configurações da visualização
 * 
 * Importa os dados processados de parsed_planets.js e exporta:
 * - Configurações visuais dos métodos de detecção
 * - Dataset completo para o dashboard (allPlanets)
 * - Dataset amostrado para o storytelling canvas (sampledPlanets → planetsDataset)
 * - Estatísticas computadas
 * 
 * Performance: suporte a lazy loading do dataset completo via JSON
 */

import { allPlanets as rawAll, sampledPlanets as rawSampled, computedStats } from './parsed_planets.js';
import { getMethodColor, hasCalculatedValues } from './utils.js';

// ============================================
// CONFIGURAÇÃO DOS MÉTODOS (para a intro canvas)
// ============================================

// Métodos principais usados no storytelling canvas (4 slides)
const STORYTELLING_METHODS = ['Velocidade Radial', 'Trânsito', 'Imagem Direta', 'Micro-lente'];

export const METHODS_CONFIG = {};

// Gerar configs dinamicamente a partir das estatísticas
Object.entries(computedStats.methods).forEach(([method, stats]) => {
    const color = getMethodColor(method);
    METHODS_CONFIG[method] = {
        color,
        label: method,
        percent: stats.percent,
        desc: getMethodDescription(method),
        year: stats.year ? stats.year.toString() : '—',
        count: stats.count,
        pill: hexToRGBA(color, 0.08),
        pillBorder: hexToRGBA(color, 0.3),
        zone: getMethodZone(method)
    };
});

function getMethodDescription(method) {
    const descs = {
        'Trânsito': 'Mede a sutil quebra de luminosidade quando o exoplaneta cruza a frente de sua estrela. O telescópio Kepler liderou esta técnica.',
        'Velocidade Radial': 'Detecta o sutil desvio gravitacional que um planeta provoca na sua estrela-mãe. Método pioneiro — mas limitado a gigantes gasosos próximos.',
        'Imagem Direta': 'Isola e capta o brilho infravermelho do exoplaneta diretamente. Eficaz para gigantes jovens, muito massivos e distantes da sua estrela.',
        'Micro-lente': 'Aproveita a distorção gravitacional de uma estrela de fundo para amplificar a luz, revelando a presença de planetas.',
        'Tempo de Trânsito': 'Mede variações periódicas no tempo de trânsito que indicam a presença de outros planetas no sistema.',
        'Pulsar Timing': 'Detecta planetas ao redor de pulsares medindo variações ultrapresas nos pulsos de rádio emitidos.',
        'Astrometria': 'Mede o deslocamento posicional da estrela causado pela atração gravitacional do planeta.',
    };
    return descs[method] || 'Método de detecção de exoplanetas.';
}

function getMethodZone(method) {
    const zones = {
        'Velocidade Radial': { minR: 72, maxR: 156 },
        'Trânsito':          { minR: 192, maxR: 312 },
        'Imagem Direta':     { minR: 240, maxR: 336 },
        'Micro-lente':       { minR: 156, maxR: 240 },
        'Tempo de Trânsito': { minR: 120, maxR: 216 },
        'Pulsar Timing':     { minR: 48, maxR: 120 },
    };
    return zones[method] || { minR: 48, maxR: 120 };
}

function hexToRGBA(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

// ============================================
// DATASET PARA STORYTELLING CANVAS (amostrado)
// ============================================

export const planetsDataset = rawSampled.map((p, i) => {
    const mc = METHODS_CONFIG[p.methodPT] || METHODS_CONFIG['Outros'] || { color: '#94A3B8' };
    
    // Classificação visual orbital
    const orbsmax = p.orbsmax || 1.0;
    const minVal = 0.005, maxVal = 100, minR = 35, maxR = 260;
    let visualRadius = minR;
    if (orbsmax > 0) {
        const logMin = Math.log10(minVal);
        const logMax = Math.log10(maxVal);
        const logVal = Math.log10(Math.max(minVal, Math.min(maxVal, orbsmax)));
        visualRadius = minR + ((logVal - logMin) / (logMax - logMin)) * (maxR - minR);
    }

    const radiusVal = p.radius || 1.0;
    const visualSize = Math.max(1.5, Math.min(7.0, 1.5 + Math.sqrt(radiusVal) * 1.5));
    const baseSpeed = 0.05 / Math.sqrt(orbsmax);
    const speed = Math.max(0.012, Math.min(0.13, baseSpeed));

    const distLY = p.dist ? `${Math.round(p.dist * 3.26)} a.l.` : '—';
    const tempK = p.eqTemp ? `${Math.round(p.eqTemp)} K` : '—';

    let gravity = p.gravity || 9.81;
    if (!p.gravity) {
        const typeDefaults = { 'Gigante Gasoso': 24.79, 'Netuniano': 11.0, 'Super-Terra': 15.0 };
        gravity = typeDefaults[p.type] || 9.81;
    }
    if (isNaN(gravity) || gravity <= 0) gravity = 9.81;
    if (gravity > 1000) gravity = 1000;

    // Notas notáveis
    const notableNotes = {
        '51 Peg b': 'Primeiro exoplaneta confirmado a orbitar uma estrela de tipo solar. Inaugurou uma nova era na astrofísica.',
        'HD 209458 b': 'O primeiro planeta extrasolar cujo trânsito foi observado e a atmosfera analisada de forma direta.',
        'TRAPPIST-1 e': 'Um dos exoplanetas terrestres mais promissores localizados na zona habitável do seu sistema de anã vermelha.',
        'Kepler-452 b': 'Frequentemente designado por "primo da Terra". Completa uma órbita ao redor de uma estrela solar em 385 dias.',
        'Beta Pic b': 'Registado diretamente através de ótica adaptativa de última geração no interior de um anel jovem de detritos cósmicos.',
        'OGLE-2005-BLG-390L b': 'Um dos mundos mais remotos conhecidos, localizado profundamente na nossa Via Láctea.',
    };
    
    let note = notableNotes[p.name];
    if (!note) {
        note = `Exoplaneta do tipo ${p.type}, descoberto em ${p.year} através do método de ${p.methodPT}. Orbita a estrela ${p.star}.`;
    }

    return {
        id: `planet-${i}`,
        name: p.name,
        star: p.star,
        year: p.year,
        method: p.methodPT,
        type: p.type,
        mass: p.mass ? `${p.mass.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}× Terra` : '—',
        dist: distLY,
        temp: tempK,
        note,
        gravity,
        radius: visualRadius,
        angle: Math.random() * Math.PI * 2,
        color: mc.color,
        size: visualSize,
        speed
    };
});

// ============================================
// DATASET COMPLETO PARA O DASHBOARD (6.291)
// ============================================

export { rawAll as allPlanetsRaw };
export { computedStats };

export const TOTAL_DISCOVERIES = computedStats.totalDiscoveries;
export const YEAR_RANGE = computedStats.yearRange;

// ============================================
// LAZY LOADING: Carregar dataset otimizado via JSON
// ============================================

let _cachedJSONPlanets = null;

/**
 * Performance: Carrega o dataset completo via JSON otimizado (lazy).
 * Retorna o dataset do JSON se disponível, senão faz fallback para rawAll.
 * Chamada típica: no enterDash() antes de inicializar o StarMap.
 */
export async function loadAllPlanetsJSON() {
    if (_cachedJSONPlanets) return _cachedJSONPlanets;
    
    try {
        const resp = await fetch('data/all_planets.json');
        if (resp.ok) {
            _cachedJSONPlanets = await resp.json();
            console.log(`[Performance] Dataset JSON carregado: ${_cachedJSONPlanets.length} planetas`);
            return _cachedJSONPlanets;
        }
    } catch (e) {
        console.warn('[Performance] Falha ao carregar JSON, usando fallback:', e.message);
    }
    
    // Fallback para o import síncrono
    return rawAll;
}

