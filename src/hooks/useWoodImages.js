import { useEffect, useState } from 'react';
import { getWood } from '../js/woodGrain';

let images = null; // { body, bezel } image URLs, once painted
let pending = null;

const whenIdle = () =>
  new Promise((resolve) => {
    if (window.requestIdleCallback) window.requestIdleCallback(resolve, { timeout: 1500 });
    else setTimeout(resolve, 200);
  });

const toUrl = (canvas) =>
  new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null), 'image/jpeg', 0.92));

// One wood per idle slot, so no paint blocks the first frames. The bezel
// first: it's smaller, so the set changes sooner.
const paintAll = async () => {
  await whenIdle();
  const bezel = await toUrl(getWood('honey', 'bezel').color);
  await whenIdle();
  const body = await toUrl(getWood('walnut', 'body').color);
  images = body && bezel ? { body, bezel } : null;
  return images;
};

/**
 * The shared wood grain (src/js/woodGrain.js) as image URLs for the 2D set's
 * CSS: `{ body, bezel }` (walnut and honey). Null until painted; the set
 * shows its CSS wood until then.
 */
const useWoodImages = () => {
  const [ready, setReady] = useState(images);
  useEffect(() => {
    if (images) return undefined;
    let live = true;
    // If painting fails, the set just keeps its CSS wood.
    pending = pending || paintAll().catch(() => null);
    pending.then((result) => live && setReady(result));
    return () => {
      live = false;
    };
  }, []);
  return ready;
};

export default useWoodImages;
