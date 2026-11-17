import { useEffect, useId, useRef } from 'react';
import { VIEWS, MOODS } from '../js/sceneSettings';
import './ScenePane.css';

/** The scene button beside "?": a little movie camera. */
export const SceneButton = ({ onClick, open, ref }) => (
  <button
    ref={ref}
    type="button"
    className={`scene-button ${open ? 'is-open' : ''}`}
    aria-label="Scene"
    aria-expanded={open}
    aria-controls="scene-pane"
    onClick={onClick}
  >
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <circle cx="7.5" cy="6.5" r="3" />
      <circle cx="14.5" cy="6.5" r="3" />
      <rect x="3" y="10.5" width="13" height="9" rx="1.5" />
      <path d="M16 13.5 L21 11 V19 L16 16.5 Z" />
    </svg>
  </button>
);

/** One row of choices, as radio buttons drawn like chips. */
const Choices = ({ legend, name, options, value, onChange }) => {
  const id = useId();
  return (
    <fieldset className="scene-row">
      <legend className="scene-heading">{legend}</legend>
      <div className="scene-chips">
        {options.map((o) => (
          <label key={o.key} className={`scene-chip ${value === o.key ? 'is-on' : ''}`}>
            <input type="radio" name={`${id}-${name}`} value={o.key} checked={value === o.key} onChange={() => onChange(name, o.key)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
};

/**
 * The Scene pane: the 3D set's camera views and lighting. Not modal,
 * so the set stays live while you change things; Esc or ✕ closes it and
 * focus goes back to the scene button.
 */
const ScenePane = ({ scene, onChange, onView, onClose }) => {
  const paneRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const onKeyDown = (e) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    onClose();
  };

  return (
    <section
      ref={paneRef}
      id="scene-pane"
      className="scene-pane"
      role="dialog"
      aria-modal="false"
      aria-labelledby="scene-title"
      onKeyDown={onKeyDown}
    >
      <button ref={closeRef} type="button" className="scene-close" aria-label="Close" onClick={onClose}>
        ✕
      </button>
      <h2 id="scene-title" className="scene-title">
        Scene
      </h2>
      <p className="scene-model">The room around your NP-R1</p>

      <div className="scene-row">
        <h3 className="scene-heading">View</h3>
        <div className="scene-chips">
          {VIEWS.map((v) => (
            <button key={v.key} type="button" className="scene-chip" onClick={() => onView(v.key)}>
              {v.label}
            </button>
          ))}
        </div>
      </div>
      <Choices legend="Lighting" name="mood" options={MOODS} value={scene.mood} onChange={onChange} />
      <p className="scene-note">C steps through the views · double-click the room to reset</p>
    </section>
  );
};

export default ScenePane;
