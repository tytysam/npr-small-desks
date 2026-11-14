import { SCENE_DEFAULTS, normalizeScene, nextView, VIEWS, dimColor, wallTones, WALL } from './sceneSettings';

describe('normalizeScene', () => {
  test('fills in defaults', () => {
    expect(normalizeScene(null)).toEqual(SCENE_DEFAULTS);
    expect(normalizeScene({ mood: 'evening' })).toEqual({ ...SCENE_DEFAULTS, mood: 'evening' });
  });

  test('drops unknown choices and settings it no longer has', () => {
    expect(normalizeScene({ mood: 'disco', floor: 'rug', wall: 'teal' })).toEqual(SCENE_DEFAULTS);
    expect(normalizeScene({ mood: 'showroom' })).toEqual(SCENE_DEFAULTS);
  });
});

describe('nextView', () => {
  test('steps through the views and wraps', () => {
    expect(nextView('front')).toBe('angle');
    expect(nextView(VIEWS.at(-1).key)).toBe('front');
  });
});

describe('wall tones', () => {
  test('dimColor darkens toward black', () => {
    expect(dimColor('#808080', 0)).toBe('#808080');
    expect(dimColor('#808080', 0.5)).toBe('#404040');
    expect(dimColor('#808080', 1)).toBe('#000000');
  });

  test('only the 3D set dims the wall for its mood', () => {
    const settings = { ...SCENE_DEFAULTS, mood: 'lightsOut' };
    expect(wallTones(settings, { is3d: false }).mid).toBe(WALL.mid);
    expect(wallTones(settings, { is3d: true }).mid).not.toBe(WALL.mid);
  });
});
