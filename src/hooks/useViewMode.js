import usePersistentState from './usePersistentState';

const MODES = ['2d', '3d'];

// Persists the user's 2D/3D preference across reloads.
const useViewMode = () => usePersistentState('npr-small-desk:viewMode', '2d', (mode) => MODES.includes(mode));

export default useViewMode;
