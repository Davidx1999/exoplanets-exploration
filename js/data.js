/**
 * data.js — Dados e configurações da visualização de exoplanetas
 * 
 * Centraliza todos os datasets, configurações de cores,
 * métodos de detecção e mapeia dados reais do CSV.
 */

import { realPlanets, computedStats } from './parsed_planets.js';

// ============================================
// CONFIGURAÇÃO DOS MÉTODOS DE DETECÇÃO (Dinâmico)
// ============================================
export const METHODS_CONFIG = {
    'Trânsito': {
        color: '#60A5FA',
        label: 'Trânsito',
        percent: computedStats.methods['Trânsito'] ? computedStats.methods['Trânsito'].percent : '73,9%',
        desc: 'Mede a diminuição de brilho quando o planeta passa na frente da estrela. O Kepler massificou essa técnica.',
        year: computedStats.methods['Trânsito'] ? computedStats.methods['Trânsito'].year.toString() : '2002',
        count: computedStats.methods['Trânsito'] ? computedStats.methods['Trânsito'].count : 4651
    },
    'Velocidade Radial': {
        color: '#F97316',
        label: 'Velocidade Radial',
        percent: computedStats.methods['Velocidade Radial'] ? computedStats.methods['Velocidade Radial'].percent : '18,8%',
        desc: 'Detecta o "bamboleo" gravitacional que um planeta provoca na estrela-mãe. Pioneiro — mas limitado a gigantes próximos.',
        year: computedStats.methods['Velocidade Radial'] ? computedStats.methods['Velocidade Radial'].year.toString() : '1995',
        count: computedStats.methods['Velocidade Radial'] ? computedStats.methods['Velocidade Radial'].count : 1181
    },
    'Imagem Direta': {
        color: '#A78BFA',
        label: 'Imagem Direta',
        percent: computedStats.methods['Imagem Direta'] ? computedStats.methods['Imagem Direta'].percent : '1,5%',
        desc: 'Fotografa o planeta diretamente. Funciona apenas para gigantes jovens, distantes e muito luminosos.',
        year: computedStats.methods['Imagem Direta'] ? computedStats.methods['Imagem Direta'].year.toString() : '2004',
        count: computedStats.methods['Imagem Direta'] ? computedStats.methods['Imagem Direta'].count : 97
    },
    'Micro-lente': {
        color: '#FACC15',
        label: 'Micro-lente',
        percent: computedStats.methods['Micro-lente'] ? computedStats.methods['Micro-lente'].percent : '4,4%',
        desc: 'Usa a curvatura gravitacional de estrelas para amplificar luz de fundo e revelar planetas em trânsito.',
        year: computedStats.methods['Micro-lente'] ? computedStats.methods['Micro-lente'].year.toString() : '2004',
        count: computedStats.methods['Micro-lente'] ? computedStats.methods['Micro-lente'].count : 278
    },
    'Tempo de Trânsito': {
        color: '#F472B6',
        label: 'Tempo de Trânsito',
        percent: computedStats.methods['Tempo de Trânsito'] ? computedStats.methods['Tempo de Trânsito'].percent : '0,7%',
        desc: 'Mede variações periódicas no tempo de trânsito que indicam a presença de outros planetas no sistema.',
        year: computedStats.methods['Tempo de Trânsito'] ? computedStats.methods['Tempo de Trânsito'].year.toString() : '2011',
        count: computedStats.methods['Tempo de Trânsito'] ? computedStats.methods['Tempo de Trânsito'].count : 41
    },
    'Outros': {
        color: '#94A3B8',
        label: 'Outros',
        percent: computedStats.methods['Outros'] ? computedStats.methods['Outros'].percent : '0,7%',
        desc: 'Inclui astrometria, pulsar timing e outras técnicas menos comuns de detecção.',
        year: computedStats.methods['Outros'] ? computedStats.methods['Outros'].year.toString() : '1992',
        count: computedStats.methods['Outros'] ? computedStats.methods['Outros'].count : 43
    }
};

// Métodos usados no storytelling (slides 2) — ordem de apresentação
export const STORY_METHODS = [
    {
        name: 'Velocidade Radial',
        color: '#F97316',
        desc: 'Detecta o "bamboleo" gravitacional que um planeta provoca na estrela-mãe. Pioneiro — mas limitado a gigantes próximos.'
    },
    {
        name: 'Trânsito',
        color: '#60A5FA',
        desc: 'Mede a diminuição de brilho quando o planeta passa na frente da estrela. O Kepler massificou essa técnica.'
    },
    {
        name: 'Imagem Direta',
        color: '#A78BFA',
        desc: 'Fotografa o planeta diretamente. Funciona apenas para gigantes jovens, distantes e muito luminosos.'
    },
    {
        name: 'Micro-lente',
        color: '#FACC15',
        desc: 'Usa a curvatura gravitacional de estrelas para amplificar luz de fundo e revelar planetas em trânsito.'
    }
];

// ============================================
// TIPOS DE PLANETAS
// ============================================
export const PLANET_TYPES = [
    'Júpiter Quente',
    'Super-Terra',
    'Gigante de Gelo',
    'Rochoso',
    'Netuniano',
    'Terrestre'
];

// ============================================
// PLANETAS REAIS NOTÁVEIS (para dashboard)
// ============================================
export const NOTABLE_PLANETS = [
    {
        name: '51 Pegasi b',
        star: '51 Pegasi',
        year: 1995,
        method: 'Velocidade Radial',
        type: 'Júpiter Quente',
        mass: '~150× Terra',
        dist: '50 anos-luz',
        temp: '1200 K',
        note: 'O primeiro exoplaneta confirmado em torno de uma estrela similar ao Sol.'
    },
    {
        name: 'HD 209458 b',
        star: 'HD 209458',
        year: 1999,
        method: 'Trânsito',
        type: 'Júpiter Quente',
        mass: '~220× Terra',
        dist: '159 anos-luz',
        temp: '1320 K',
        note: 'Primeiro exoplaneta com atmosfera detectada — vapor d\'água confirmado pelo Hubble.'
    },
    {
        name: 'TRAPPIST-1e',
        star: 'TRAPPIST-1',
        year: 2017,
        method: 'Trânsito',
        type: 'Terrestre',
        mass: '~0.77× Terra',
        dist: '39 anos-luz',
        temp: '246 K',
        note: 'Um dos candidatos mais promissores a habitabilidade — na zona habitável de sua estrela.'
    },
    {
        name: 'Kepler-452b',
        star: 'Kepler-452',
        year: 2015,
        method: 'Trânsito',
        type: 'Super-Terra',
        mass: '~5× Terra',
        dist: '1402 anos-luz',
        temp: '265 K',
        note: 'Chamado de "primo da Terra". Orbita uma estrela solar em período de 385 dias.'
    },
    {
        name: 'Beta Pic b',
        star: 'Beta Pictoris',
        year: 2009,
        method: 'Imagem Direta',
        type: 'Gigante de Gelo',
        mass: '~4300× Terra',
        dist: '63 anos-luz',
        temp: '1700 K',
        note: 'Fotografado diretamente. Orbita dentro de um disco de detritos que pode estar formando luas.'
    }
];

// ============================================
// PROCESSADOR E MAPEADOR DE DADOS REAIS
// ============================================

// Gera o dataset global — mapeando o real do CSV para a visualização
export const planetsDataset = realPlanets.map((p, i) => {
    // Determinar classificação do planeta dinamicamente
    let type = 'Rochoso';
    const radius = p.radius || 1.0;
    const massVal = p.mass || 1.0;
    const orbsmax = p.orbsmax || 1.0;

    if (radius > 6.0 || massVal > 50) {
        type = orbsmax < 0.15 ? 'Júpiter Quente' : 'Gigante de Gelo';
    } else if (radius > 2.0 || massVal > 10) {
        type = 'Netuniano';
    } else if (radius > 1.25 || massVal > 2) {
        type = 'Super-Terra';
    } else {
        type = Math.random() > 0.5 ? 'Terrestre' : 'Rochoso';
    }

    // Mapeamento físico orbital real (orbsmax) -> visual (radius) usando escala logarítmica
    // orbsmax no dataset varia de ~0.005 UA a ~100 UA
    // Queremos mapear isso para a faixa de raio visual de 35px a 260px
    const minVal = 0.005;
    const maxVal = 100;
    const minR = 35;
    const maxR = 260;

    let visualRadius = minR;
    if (orbsmax > 0) {
        const logMin = Math.log10(minVal);
        const logMax = Math.log10(maxVal);
        const logVal = Math.log10(Math.max(minVal, Math.min(maxVal, orbsmax)));
        visualRadius = minR + ((logVal - logMin) / (logMax - logMin)) * (maxR - minR);
    }

    // Tamanho do planeta físico (radius em raios terrestres) -> tamanho visual (clamp [1.5, 7.0])
    const visualSize = Math.max(1.5, Math.min(7.0, 1.5 + Math.sqrt(radius) * 1.5));

    // Velocidade de rotação baseada na Terceira Lei de Kepler (v proporcional a 1 / sqrt(r))
    const baseSpeed = 0.05 / Math.sqrt(orbsmax);
    const speed = Math.max(0.012, Math.min(0.13, baseSpeed));

    return {
        id: `planet-${i}`,
        name: p.name,
        year: p.year,
        method: p.method,
        type,
        mass: p.mass ? `${p.mass.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}× Terra` : '—',
        radius: visualRadius,
        angle: p.angle || Math.random() * Math.PI * 2,
        color: METHODS_CONFIG[p.method] ? METHODS_CONFIG[p.method].color : '#94A3B8',
        size: visualSize,
        speed: speed
    };
});

// ============================================
// CONSTANTES GLOBAIS (Dinâmicas do CSV)
// ============================================
export const TOTAL_DISCOVERIES = computedStats.totalDiscoveries;
export const YEAR_RANGE = computedStats.yearRange;
