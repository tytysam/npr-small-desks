import { useEffect, useState } from 'react';
import { setTone } from '../js/hiss';
import Signature from './Signature';
import './SignOff.css';

const TONE_GAIN = 0.05; // a 1 kHz sine is piercing; keep it well under the concerts

// SMPTE bars, left to right: the main bars, the castellations under them,
// and the bottom row (-I, white, +Q, black, the PLUGE strip, black).
const BARS = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
const CASTELLATIONS = ['#0000c0', '#131313', '#c000c0', '#131313', '#00c0c0', '#131313', '#c0c0c0'];
const BOTTOM = [
  ['#00214c', 5],
  ['#ffffff', 5],
  ['#32006a', 5],
  ['#131313', 5],
  ['#090909', 4 / 3],
  ['#131313', 4 / 3],
  ['#1d1d1d', 4 / 3],
  ['#131313', 4],
];

const CREDITS = [
  ['NP-R1', 'This concludes our broadcast day'],
  ['Designed & built by', 'Tyler Samuelson'],
  ['Concerts', 'NPR Music · Tiny Desk'],
  ['Picture', 'YouTube'],
  ['Set', 'Walnut, honey, and a little three.js'],
  ['Thanks for watching', 'Stay tuned'],
];

// Each phase's element ends its own CSS animation to hand over to the next,
// so pausing the animations (the set paused or off) pauses the cycle too.
const NEXT = { bars: 'credits', credits: 'signed', signed: 'bars' };

/**
 * Channel 000: the set signing off for the night, the way stations ended
 * the broadcast day. Color bars with a station slate and a 1 kHz tone, then
 * the credits roll, then the maker's signature writes itself; round again.
 * `volume` is the picture's sound level; `playing` false holds it all.
 */
const SignOff = ({ volume, playing }) => {
  const [phase, setPhase] = useState('bars');

  useEffect(() => {
    setTone(phase === 'bars' && playing ? volume * TONE_GAIN : 0);
  }, [phase, playing, volume]);
  useEffect(() => () => setTone(0), []);

  const advance = (e) => {
    if (e.target === e.currentTarget) setPhase(NEXT[phase]);
  };

  return (
    <div className={`sign-off${playing ? '' : ' is-paused'}`}>
      {phase === 'bars' && (
        <div className="sign-off-bars" onAnimationEnd={advance} aria-label="Color bars">
          <div className="sign-off-row sign-off-row-main">
            {BARS.map((color) => (
              <span key={color} style={{ background: color }} />
            ))}
          </div>
          <div className="sign-off-row sign-off-row-castellations">
            {CASTELLATIONS.map((color, i) => (
              <span key={i} style={{ background: color }} />
            ))}
          </div>
          <div className="sign-off-row sign-off-row-bottom">
            {BOTTOM.map(([color, flex], i) => (
              <span key={i} style={{ background: color, flex }} />
            ))}
          </div>
          <div className="sign-off-slate">
            NP-R1 · CH 000
          </div>
        </div>
      )}
      {phase === 'credits' && (
        <div className="sign-off-credits" onAnimationEnd={advance}>
          {CREDITS.map(([role, name]) => (
            <p key={role} className="sign-off-credit">
              <span className="sign-off-role">{role}</span>
              <span className="sign-off-name">{name}</span>
            </p>
          ))}
        </div>
      )}
      {phase === 'signed' && (
        <div className="sign-off-signed" onAnimationEnd={advance}>
          <Signature className="sign-off-signature" />
          <span className="sign-off-name">Tyler Samuelson</span>
          <span className="sign-off-role">NP-R1 · 2026</span>
        </div>
      )}
    </div>
  );
};

export default SignOff;
