import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import usePersistentState from './usePersistentState';
import { makeSchedule, onAir } from '../js/schedule';
import { makeShuffleBag } from '../js/shuffleBag';
import { pickRandomIndex } from '../js/channels';

const isStation = (v) => Number.isInteger(v) && v >= 0;

/**
 * What's on the set: the tuned station and the programme it's showing.
 *
 * - **Live** (`broadcast`): each station airs its slot in the shared
 *   schedule, so the programme follows the wall clock.
 * - **VCR**: station k simply plays video k from the start.
 * - A `?v=` link plays that video once (`override`); changing channel
 *   returns to normal tuning from there.
 *
 * A "tune" is a moment the picture is (re)acquired: changing station,
 * rejoining live after a pause/power cycle, or a mode switch. Programmes are
 * computed from the latest tune, so they stay put between tunes.
 */
const useTuner = ({ channels, broadcast }) => {
  const [station, setStation] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [override, setOverride] = useState(null);
  const [tune, setTune] = useState({ at: Date.now(), startAt: 0 });
  const [lastStation, setLastStation] = usePersistentState('npr-small-desk:lastStation', null, isStation);

  const schedule = useMemo(() => (channels.length ? makeSchedule(channels) : null), [channels]);
  const bag = useMemo(() => makeShuffleBag(channels.length), [channels.length]);
  const lastStationRef = useRef(lastStation);

  // Tune in once the lineup arrives: ?ch= / ?v= link, then last station, then random.
  useEffect(() => {
    if (channels.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const linkedChannel = Number(params.get('ch')) - 1;
    const linkedVideo = channels.findIndex((c) => c.id === params.get('v'));
    let next = pickRandomIndex(channels.length);
    if (isStation(lastStationRef.current) && lastStationRef.current < channels.length) next = lastStationRef.current;
    if (isStation(linkedChannel) && linkedChannel < channels.length) next = linkedChannel;
    if (linkedVideo >= 0) {
      next = linkedVideo;
      if (broadcast) setOverride(channels[linkedVideo].id);
    }
    setStation(next);
    setTune({ at: Date.now(), startAt: 0 });
    // Only on arrival of the lineup; later mode changes retune explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels]);

  const program = useMemo(() => {
    if (station === null || !schedule) return null;
    if (override) {
      const video = channels.find((c) => c.id === override);
      if (video) return { video, index: channels.indexOf(video), startAt: tune.startAt, live: false };
    }
    if (broadcast) {
      const { index, offset, remaining } = onAir(schedule, station, tune.at);
      return { video: channels[index], index, startAt: offset, remaining, live: true };
    }
    return { video: channels[station], index: station, startAt: tune.startAt, live: false };
  }, [channels, schedule, station, override, broadcast, tune]);

  const tuneTo = useCallback(
    (next) => {
      if (channels.length === 0) return;
      if (station !== null && station !== next) setPrevious(station);
      setStation(next);
      setOverride(null);
      setTune({ at: Date.now(), startAt: 0 });
    },
    [channels.length, station]
  );

  const step = useCallback(
    (direction) => {
      if (channels.length === 0) return;
      tuneTo((((station ?? 0) + direction) % channels.length + channels.length) % channels.length);
    },
    [channels.length, station, tuneTo]
  );

  const jumpRandom = useCallback(() => {
    if (channels.length === 0) return;
    tuneTo(bag.next(station));
  }, [channels.length, bag, station, tuneTo]);

  const recall = useCallback(() => {
    if (previous !== null) tuneTo(previous);
  }, [previous, tuneTo]);

  /** Re-acquire the picture: live stations rejoin the schedule now; VCR starts at `startAt`. */
  const rejoin = useCallback((startAt = 0) => setTune({ at: Date.now(), startAt }), []);

  /** The programme finished (or wouldn't play): move on. */
  const programEnded = useCallback(() => {
    if (!program) return;
    if (program.live) {
      // If the player ran a little behind the schedule, the clock may still
      // say the old video; jump past its end so we don't replay the tail.
      const now = Date.now();
      const next = onAir(schedule, station, now);
      setTune({ at: next.index === program.index ? now + (next.remaining + 1) * 1000 : now, startAt: 0 });
    } else {
      step(1);
    }
  }, [program, schedule, station, step]);

  // Remember where we were, and keep the address bar shareable.
  const videoId = program?.video.id;
  useEffect(() => {
    if (station === null || !videoId) return;
    setLastStation(station);
    const url = new URL(window.location.href);
    if (override || !broadcast) {
      url.searchParams.set('v', videoId);
      url.searchParams.delete('ch');
    } else {
      url.searchParams.set('ch', String(station + 1));
      url.searchParams.delete('v');
    }
    window.history.replaceState(null, '', url);
  }, [station, videoId, override, broadcast, setLastStation]);

  return { station, program, previous, tuneTo, step, jumpRandom, recall, rejoin, programEnded };
};

export default useTuner;
