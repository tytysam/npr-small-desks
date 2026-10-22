import { SIGNATURE } from '../js/signature';

/**
 * Tyler Samuelson's signature, as unfilled SVG strokes in the order they were
 * written. Give its paths a stroke (and any reveal) in CSS via `className`.
 */
const Signature = ({ className }) => {
  const [x, y, w, h] = SIGNATURE.viewBox;
  return (
    <svg className={className} viewBox={`${x} ${y} ${w} ${h}`} role="img" aria-label="Tyler Samuelson's signature">
      {SIGNATURE.paths.map((d, i) => (
        <path key={i} d={d} pathLength="1" strokeWidth={SIGNATURE.strokeWidth} />
      ))}
    </svg>
  );
};

export default Signature;
