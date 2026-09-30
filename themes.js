// Poster theme configurations
// Each theme defines its visual style, decorations, and optional filters

// Theme definitions for the theme picker UI
const PLAYLIST_THEMES = [
  {id: 'gallery', name: '封面画廊', badge: '🖼️', caption: '经典画廊风格'},
  {id: 'editorial', name: '出版物', badge: '📰', caption: '杂志编辑风格'},
  {id: 'seasonal', name: '季节主题', badge: '🌸', caption: '春夏秋冬'}
];

// Detailed theme configurations including decorations
const THEMES = {
  gallery: {
    name: '封面画廊',
    kicker: 'A GALLERY OF SOUND',
    description: '经典画廊风格，适合展示专辑封面',
    background: '#f5f1e8',
    foreground: '#2a2a2a',

    decorations: [
      // Light texture overlay
      {
        type: 'pattern',
        position: 'texture',
        svg: `<svg width="100%" height="100%" style="position:absolute;inset:0;pointer-events:none;opacity:0.025" xmlns="http://www.w3.org/2000/svg">
          <filter id="gallery-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" seed="15"/>
            <feColorMatrix type="saturate" values="0"/>
          </filter>
          <rect width="100%" height="100%" filter="url(#gallery-noise)"/>
        </svg>`
      }
    ],

    availableFilters: ['vintage', 'grain', 'halftone']
  },

  editorial: {
    name: '出版物',
    kicker: 'EDITORIAL SELECTION',
    description: '杂志编辑风格，强调排版',
    // Editorial theme uses CSS variables set by design.js, don't override
    background: null,
    foreground: null,

    decorations: [],
    availableFilters: ['vintage', 'grain']
  },

  spring: {
    name: '春日拼贴',
    kicker: 'SPRING PLAYLIST',
    description: '水彩花卉拼贴风格',
    background: '#fbf8ee',
    foreground: '#2a2a2a',
    collageMode: true, // 标记为拼贴模式，卡片会随机旋转

    decorations: [],
    availableFilters: ['vintage', 'grain']
  },

  summer: {
    name: '夏日',
    description: '明亮活力，橙色调',
    background: '#fffbf5',
    foreground: '#2a2a2a',

    decorations: [
      {
        type: 'pattern',
        position: 'background',
        pattern: 'diagonal-stripes',
        style: {
          background: 'repeating-linear-gradient(36deg, #e56e3520 0px, #e56e3520 8px, transparent 8px, transparent 16px)',
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none'
        }
      },
      {
        type: 'svg',
        position: 'top-right',
        svg: `<svg width="200" height="200" style="position:absolute;top:-10px;right:-40px">
          <circle cx="100" cy="100" r="85" fill="#f3a43b"/>
        </svg>`
      }
    ],
    availableFilters: ['vibrant', 'warm']
  },

  autumn: {
    name: '秋日',
    description: '枫叶红棕色，沉稳复古',
    background: '#fdf9f4',
    foreground: '#2a2a2a',

    decorations: [
      {
        type: 'svg',
        position: 'border',
        svg: `<svg width="100%" height="100%" style="position:absolute;inset:0;pointer-events:none">
          <rect x="1.8%" y="1.8%" width="96.4%" height="96.4%" fill="none" stroke="#b55336" stroke-width="1.5" opacity="0.4"/>
        </svg>`
      },
      {
        type: 'svg',
        position: 'top-right',
        svg: `<svg width="150" height="200" style="position:absolute;top:10%;right:8%;opacity:0.85;transform:rotate(16deg)">
          <path d="M 0,-27.5 L 6,-9 L 22.5,-15 L 16,4 L 35,12.5 L 16,20 L 22.5,37.5 L 6,27.5 L 0,47.5 L -6,27.5 L -22.5,37.5 L -16,20 L -35,12.5 L -16,4 L -22.5,-15 L -6,-9 Z"
                fill="#b55336d9" transform="translate(75,100) scale(0.8)"/>
        </svg>`
      }
    ],
    availableFilters: ['vintage', 'warm', 'sepia']
  },

  winter: {
    name: '冬日',
    description: '冷色调，简洁几何',
    background: '#f8fbfc',
    foreground: '#2a2a2a',

    decorations: [
      {
        type: 'pattern',
        position: 'background',
        pattern: 'grid',
        svg: `<svg width="100%" height="100%" style="position:absolute;inset:0;pointer-events:none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="winter-grid" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#6ca9b8" stroke-width="0.8" opacity="0.2"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#winter-grid)"/>
        </svg>`
      },
      {
        type: 'text',
        position: 'top-right',
        content: '*  ·  *  ·  *',
        style: {
          fontSize: '0.9rem',
          color: '#28748faa',
          fontFamily: 'serif',
          position: 'absolute',
          right: '15%',
          top: '4rem'
        }
      }
    ],
    availableFilters: ['cool', 'clarity']
  }
};

// Global filter effects that can be applied to any theme
const FILTER_EFFECTS = {
  vintage: {
    name: '复古',
    css: 'sepia(0.3) contrast(0.9) saturate(0.85)',
    description: '模拟老照片效果'
  },
  grain: {
    name: '颗粒',
    css: '',
    useCustom: true, // 需要用 SVG filter
    svg: `<svg style="position:absolute;width:0;height:0"><defs>
      <filter id="grain-filter">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise"/>
        <feColorMatrix in="noise" type="saturate" values="0"/>
        <feBlend in="SourceGraphic" in2="noise" mode="multiply" result="blend"/>
        <feComposite in="blend" in2="SourceGraphic" operator="in"/>
      </filter>
    </defs></svg>`,
    apply: (element) => element.style.filter = 'url(#grain-filter)'
  },
  halftone: {
    name: '网点',
    css: '',
    useCustom: true,
    svg: `<svg style="position:absolute;width:0;height:0"><defs>
      <filter id="halftone-filter">
        <feTurbulence type="fractalNoise" baseFrequency="2" numOctaves="1" result="noise"/>
        <feColorMatrix in="noise" type="saturate" values="0"/>
        <feComponentTransfer>
          <feFuncA type="discrete" tableValues="0 1"/>
        </feComponentTransfer>
        <feBlend in="SourceGraphic" mode="multiply"/>
      </filter>
    </defs></svg>`,
    apply: (element) => element.style.filter = 'url(#halftone-filter)'
  },
  'soft-glow': {
    name: '柔光',
    css: 'brightness(1.05) blur(0.3px)',
    description: '轻微发光效果'
  },
  bloom: {
    name: '光晕',
    css: 'brightness(1.1) contrast(0.95) saturate(1.2)',
    description: '梦幻光晕'
  },
  vibrant: {
    name: '鲜艳',
    css: 'saturate(1.3) contrast(1.1)',
    description: '提升饱和度'
  },
  warm: {
    name: '暖调',
    css: 'sepia(0.15) saturate(1.1)',
    description: '增加暖色'
  },
  cool: {
    name: '冷调',
    css: 'hue-rotate(10deg) saturate(0.9)',
    description: '冷色调'
  },
  sepia: {
    name: '棕褐',
    css: 'sepia(0.6)',
    description: '棕褐色调'
  },
  clarity: {
    name: '清晰',
    css: 'contrast(1.15) saturate(1.05)',
    description: '提升清晰度'
  }
};

// Apply theme to poster element
function applyTheme(posterElement, themeKey, filters = []) {
  const theme = THEMES[themeKey];
  if (!theme) {
    console.warn(`Theme "${themeKey}" not found`);
    return;
  }

  // Remove old decorations
  posterElement.querySelectorAll('.theme-decoration').forEach(el => el.remove());

  // Apply background/foreground - support CSS variables
  if (theme.background && !theme.background.startsWith('var(')) {
    posterElement.style.backgroundColor = theme.background;
  }
  if (theme.foreground && !theme.foreground.startsWith('var(')) {
    posterElement.style.color = theme.foreground;
  }

  // Add decorations
  theme.decorations.forEach((decor, index) => {
    let element;

    if (decor.type === 'image') {
      element = document.createElement('img');
      element.src = decor.src;
      element.alt = '';
      element.className = 'theme-decoration';
      element.draggable = false;
      Object.assign(element.style, decor.style || {});
    } else {
      element = document.createElement('div');
      element.className = 'theme-decoration';
      element.dataset.decorationType = decor.type;
      element.dataset.decorationIndex = index;

      if (decor.type === 'line') {
        Object.assign(element.style, {
          position: 'absolute',
          ...decor.style
        });
      } else if (decor.type === 'svg') {
        element.innerHTML = decor.svg;
        element.style.position = 'absolute';
        element.style.inset = '0';
        element.style.pointerEvents = 'none';
      } else if (decor.type === 'pattern') {
        if (decor.svg) {
          element.innerHTML = decor.svg;
        }
        Object.assign(element.style, decor.style || {});
      } else if (decor.type === 'text') {
        element.textContent = decor.content;
        Object.assign(element.style, decor.style || {});
      }
    }

    posterElement.appendChild(element);
  });

  // Apply filters (temporarily disabled - will be redesigned)
  // applyFilters(posterElement, filters);
}

function applyFilters(posterElement, filterKeys = []) {
  const cssFilters = [];

  // Remove old custom filter SVGs
  posterElement.querySelectorAll('.filter-svg').forEach(el => el.remove());

  filterKeys.forEach(key => {
    const filter = FILTER_EFFECTS[key];
    if (!filter) return;

    if (filter.useCustom && filter.svg) {
      const svgEl = document.createElement('div');
      svgEl.className = 'filter-svg';
      svgEl.innerHTML = filter.svg;
      posterElement.appendChild(svgEl);
      if (filter.apply) {
        filter.apply(posterElement);
      }
    } else if (filter.css) {
      cssFilters.push(filter.css);
    }
  });

  if (cssFilters.length > 0 && !filterKeys.some(k => FILTER_EFFECTS[k]?.useCustom)) {
    posterElement.style.filter = cssFilters.join(' ');
  }
}

// Export for use in design.js
if (typeof window !== 'undefined') {
  window.PLAYLIST_THEMES = PLAYLIST_THEMES;
  window.THEMES = THEMES;
  window.FILTER_EFFECTS = FILTER_EFFECTS;
  window.applyTheme = applyTheme;
  window.applyFilters = applyFilters;
}
