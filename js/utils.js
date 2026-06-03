/**
 * js/utils.js — Funções utilitárias e configurações visuais
 * 
 * Contém helpers para classificação de tipos planetários, conversões físicas,
 * tratamento de dados nulos/ausentes e paletas de cores compartilhadas.
 */

// ============================================
// 1. TRATAMENTO DE DADOS E VALORES AUSENTES
// ============================================

/**
 * Helper didático solicitado para exibir valores ausentes sem quebrar o layout.
 * Exibe "Sem dados registrados" em caso de valores vazios, nulos ou NaN.
 */
export function displayValue(value, suffix = "") {
    if (value === null || value === undefined || value === "" || Number.isNaN(value) || value === "—") {
        return "Sem dados registrados";
    }
    // Se for numérico, formatar com vírgula local
    if (typeof value === 'number') {
        return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${suffix}`;
    }
    return `${value}${suffix}`;
}

/**
 * Parse numérico seguro para evitar NaNs indesejados.
 */
export function safeParseNum(val) {
    if (val === undefined || val === null || val === '' || val === '—') return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
}

// ============================================
// 2. CONVERSÕES E CÁLCULOS FÍSICOS
// ============================================

/**
 * Converte distância em Parsecs para Anos-luz.
 * 1 Parsec ≈ 3.26156 Anos-luz
 */
export function parsecToLY(parsec) {
    if (parsec === null || parsec === undefined) return null;
    return parsec * 3.26156;
}

/**
 * Calcula a gravidade superficial relativa à Terra.
 * Fórmula: g = M / R² (onde M = massas terrestres, R = raios terrestres)
 */
export function calcRelativeGravity(mass, radius) {
    if (mass === null || radius === null || radius <= 0) return null;
    const g = mass / (radius * radius);
    return isNaN(g) ? null : g;
}

// ============================================
// 3. CLASSIFICAÇÃO DOS PLANETAS
// ============================================

/**
 * Classifica os exoplanetas com base no raio (como especificado).
 * Retorna as categorias em português e inglês para uso no D3 e na UI.
 */
export function classifyPlanet(radiusEarth) {
    if (!Number.isFinite(radiusEarth) || radiusEarth <= 0) {
        return { en: "Unknown", pt: "Desconhecido" };
    }
    if (radiusEarth < 1.25) {
        return { en: "Terrestrial", pt: "Terrestre" };
    }
    if (radiusEarth < 2.0) {
        return { en: "Super Earth", pt: "Super-Terra" };
    }
    if (radiusEarth < 6.0) {
        return { en: "Neptune-like", pt: "Netuniano" };
    }
    return { en: "Gas Giant", pt: "Gigante Gasoso" };
}

// ============================================
// 4. SISTEMA DE CORES E DETECÇÃO DE APROXIMAÇÕES
// ============================================

// Paleta brutalista e de alto contraste para os métodos de descoberta
export const METHOD_COLORS = {
    'Trânsito': '#60A5FA', // Azul vibrante
    'Velocidade Radial': '#F97316', // Laranja quente
    'Imagem Direta': '#A78BFA', // Roxo elétrico
    'Micro-lente': '#FACC15', // Amarelo sol
    'Pulsar Timing': '#94A3B8', // Cinza médio
    'Tempo de Trânsito': '#F472B6', // Rosa
    'Astrometria': '#34D399', // Verde menta
    'Variação de Eclipse': '#FB923C', // Laranja claro
    'Modulação de Brilho': '#E879F9', // Magenta
    'Variação de Pulsação': '#818CF8', // Indigo
    'Cinemática de Disco': '#2DD4BF', // Ciano
    'Outros': '#94A3B8'
};

export const TYPE_COLORS = {
    'Terrestre': '#34D399',
    'Super-Terra': '#60A5FA',
    'Netuniano': '#A78BFA',
    'Gigante Gasoso': '#F97316',
    'Desconhecido': '#64748B'
};

export function getMethodColor(method) {
    return METHOD_COLORS[method] || METHOD_COLORS['Outros'];
}

export function getTypeColor(type) {
    return TYPE_COLORS[type] || TYPE_COLORS['Desconhecido'];
}

/**
 * Filtro dinâmico flexível para ocultar aproximações matemáticas.
 * Procura pela string "CALCULATED_VALUE" ou similares nas referências da NASA.
 */
export function hasCalculatedValues(planet) {
    if (planet.bmassprov === 'M-R relationship') return true;
    if (planet.bmassprov === 'Msini') return true;
    if (planet.isRadiusCalc) return true;
    if (planet.isMassCalc) return true;
    return false;
}

/**
 * Formatação numérica localizada.
 */
export function formatNumber(val, decimals = 1, locale = 'pt-BR') {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return val.toLocaleString(locale, { 
        maximumFractionDigits: decimals,
        minimumFractionDigits: 0
    });
}

/**
 * Renderiza um valor com unidade, ou exibe mensagem de dado ausente.
 */
export function renderValue(val, unit = '', opts = {}) {
    const { 
        decimals = 1, 
        locale = 'pt-BR', 
        missing = 'Sem dados registrados' 
    } = opts;

    if (val === null || val === undefined || val === '—') {
        return { text: missing, isMissing: true };
    }

    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) {
        return { text: missing, isMissing: true };
    }

    const formatted = num.toLocaleString(locale, { 
        maximumFractionDigits: decimals,
        minimumFractionDigits: 0
    });

    return { 
        text: unit ? `${formatted} ${unit}` : formatted, 
        isMissing: false 
    };
}
