export const ICONS = {
  today: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z',
  tasks: 'M10 6h10M10 12h10M10 18h10M4 6l1.2 1.2L7.5 5M4 12l1.2 1.2L7.5 11M4 18l1.2 1.2L7.5 17',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  diary: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11M9 8h6',
  goals: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10zM12 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2z',
  sport: 'M6 7v10M3 10v4M18 7v10M21 10v4M6 12h12',
  billiards: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 7.5a2 2 0 1 0 0 4a2 2 0 1 0 0-4zM12 11.5a2.3 2.3 0 1 0 0 4.6a2.3 2.3 0 1 0 0-4.6z',
  english: 'M4 5h7M7.5 5v1c0 4-2 7-4 8M5 9c1 2 3 4 6 5M13 20l4-9 4 9M14.5 17h5',
  reading: 'M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3zM21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z',
  blog: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  review: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  settings: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12l5 5L20 7',
  chevron: 'M6 9l6 6 6-6',
  close: 'M6 6l12 12M18 6L6 18',
  menu: 'M4 6h16M4 12h16M4 18h16',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z'
};

export const icon = (name, size = 20, sw = 1.8) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[name]}"></path></svg>`;

export const WAVE_PATH = 'M0 10 Q 15 0 30 10 T 60 10 T 90 10 T 120 10 T 150 10 T 180 10 T 210 10 T 240 10 V20 H0z';
export const WAVE_PATH_SOFT = 'M0 10 Q 15 2 30 10 T 60 10 T 90 10 T 120 10 T 150 10 T 180 10 T 210 10 T 240 10 V20 H0z';

// Вода внутри любого контейнера: pct — уровень в процентах
export const water = (pct, { top = -6, h = 7, fill = '#2E8FD6', key = '' } = {}) =>
  `<span class="water${pct ? '' : ' empty'}" data-key="w${key}" style="height:${pct}%"><svg class="wave" viewBox="0 0 240 20" preserveAspectRatio="none" style="position:absolute;left:0;top:${top}px;width:200%;height:${h}px" aria-hidden="true"><path d="${WAVE_PATH}" fill="${fill}"></path></svg></span>`;
