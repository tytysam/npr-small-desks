/**
 * The cabinets the set comes in (SETUP's Cabinet row), shared by both sets.
 * Plain data, no three.js: the 3D set's measurements for each are in
 * src/components/tv3d/cabinets.js, the 2D set's look in TV.css (walnut) and
 * a stylesheet per cabinet (e.g. TVTeak.css).
 *
 * - model: the badge on the rail
 * - woods: the body's and the bezel's woods (src/js/woodGrain.js)
 */
export const CABINETS = [
  { key: 'walnut', label: 'Walnut', model: 'NP-R1', woods: { body: 'walnut', bezel: 'honey' } },
  { key: 'teak', label: 'Teak', model: 'NP-D6', woods: { body: 'teak', bezel: 'teak' } },
  { key: 'cream', label: 'Cream', model: 'NP-S9', woods: { body: 'teak', bezel: 'blond' } },
];

export const DEFAULT_CABINET = 'walnut';

/** The cabinet for `key`, or the default one. */
export const cabinetFor = (key) => CABINETS.find((c) => c.key === key) ?? CABINETS[0];
