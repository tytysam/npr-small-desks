import { useEffect, useState } from 'react';
import { getWood } from '../js/woodGrain';

let images = null; // { walnut, honey } image URLs, made once per visit
let pending = null;

const whenIdle = () =>
  new Promise((resolve) => {
    if (window.requestIdleCallback) window.requestIdleCallback(resolve, { timeout: 1500 });
    else setTimeout(resolve, 200);
  });

const toUrl = (canvas) =>
  new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null), 'image/jpeg', 0.92));

// One wood per idle slot, so neither paint blocks the first frames.
const paintAll = async () => {
  await whenIdle();
  const honey = await toUrl(getWood('honey').color);
  await whenIdle();
  const walnut = await toUrl(getWood('walnut').color);
  images = honey && walnut ? { walnut, honey } : null;
  return images;
};

/**
 * The shared wood grain (src/js/woodGrain.js) as image URLs for the 2D set's
 * CSS. Null until painted; the set shows its CSS wood until then.
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
