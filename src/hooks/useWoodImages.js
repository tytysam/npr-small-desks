import { useEffect, useState } from 'react';
import { getWood } from '../js/woodGrain';

const images = new Map(); // `${body}/${bezel}` → { body, bezel } image URLs, once painted
const pending = new Map(); // the same key → the promise of them

const whenIdle = () =>
  new Promise((resolve) => {
    if (window.requestIdleCallback) window.requestIdleCallback(resolve, { timeout: 1500 });
    else setTimeout(resolve, 200);
  });

const toUrl = (canvas) =>
  new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null), 'image/jpeg', 0.92));

// One wood per idle slot, so no paint blocks the first frames. The bezel
// first: it's smaller, so the set changes sooner.
const paintPair = async (woods, key) => {
  await whenIdle();
  const bezel = await toUrl(getWood(woods.bezel, 'bezel').color);
  await whenIdle();
  const body = await toUrl(getWood(woods.body, 'body').color);
  const result = body && bezel ? { body, bezel } : null;
  images.set(key, result);
  return result;
};

/**
 * The shared wood grain (src/js/woodGrain.js) for a cabinet's woods
 * (`{ body, bezel }`, src/js/cabinets.js), as image URLs for the 2D set's
 * CSS: `{ body, bezel }`. Null until painted; the set shows its CSS wood
 * until then.
 */
const useWoodImages = (woods) => {
  const key = `${woods.body}/${woods.bezel}`;
  const [ready, setReady] = useState(() => ({ key, urls: images.get(key) ?? null }));
  useEffect(() => {
    if (images.get(key)) return undefined;
    let live = true;
    // If painting fails, the set just keeps its CSS wood.
    if (!pending.has(key)) pending.set(key, paintPair(woods, key).catch(() => null));
    pending.get(key).then((urls) => live && setReady({ key, urls }));
    return () => {
      live = false;
    };
    // `key` stands for `woods`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return images.get(key) ?? (ready.key === key ? ready.urls : null);
};

export default useWoodImages;
