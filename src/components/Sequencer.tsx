import React from 'react';
import { Voicing } from '../logic/voicing-generator';
import { Play, Square, Trash2, X } from 'lucide-react';
import ChordDiagram from './ChordDiagram';

interface SequencerProps {
    sequence: ((Voicing & { intervalMap?: Record<string, string> }) | null)[];
    activeSlot: number | null;
    currentBeat: number;
    isPlaying: boolean;
    bpm: number;
    onBpmChange: (bpm: number) => void;
    onSlotClick: (index: number) => void;
    onClearSlot: (index: number, e: React.MouseEvent) => void;
    onPlay: () => void;
    onStop: () => void;
    onClearAll: () => void;
    displayMode: 'notes' | 'intervals';
    intervalMap: Record<string, string>;
}

const Sequencer: React.FC<SequencerProps> = ({
    sequence,
    activeSlot,
    currentBeat,
    isPlaying,
    bpm,
    onBpmChange,
    onSlotClick,
    onClearSlot,
    onPlay,
    onStop,
    onClearAll,
    displayMode,
    intervalMap
}) => {
    // Local state for input to allow typing without immediate clamping
    const [localBpm, setLocalBpm] = React.useState(bpm.toString());

    // Sync local state when prop changes (e.g. if set externally)
    React.useEffect(() => {
        setLocalBpm(bpm.toString());
    }, [bpm]);

    const handleBpmCommit = () => {
        let val = parseInt(localBpm);
        if (isNaN(val)) val = 90; // Default fallback
        const clamped = Math.min(160, Math.max(40, val));
        setLocalBpm(clamped.toString());
        onBpmChange(clamped);
    };

    return (
        <details className="sequencer-details group">
            <summary className="sequencer-summary">
                <span>Chord Sequencer</span>
            </summary>

            <div className="px-6 pb-6 fade-in-up">
                <div className="sequencer-controls">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors cursor-text" style={{ backgroundColor: '#333', color: '#e0e0e0' }} onClick={() => document.getElementById('bpm-input')?.focus()}>
                        <label htmlFor="bpm-input" className="text-sm font-semibold cursor-pointer">BPM:</label>
                        <input
                            id="bpm-input"
                            type="number"
                            min="40"
                            max="160"
                            value={localBpm}
                            onChange={(e) => setLocalBpm(e.target.value)}
                            onBlur={handleBpmCommit}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleBpmCommit();
                                    (e.target as HTMLInputElement).blur();
                                }
                            }}
                            className="w-12 bg-transparent text-center outline-none focus:ring-0 font-bold"
                            style={{ width: '3rem', background: 'transparent', textAlign: 'center', fontWeight: 'bold', outline: 'none', border: 'none', color: 'var(--primary-color)' }}
                        />
                    </div>
                    <button
                        onClick={isPlaying ? onStop : onPlay}
                        className={`control-btn ${isPlaying ? 'btn-stop' : 'btn-play'}`}
                    >
                        {isPlaying ? <><Square size={18} /> Stop</> : <><Play size={18} /> Play</>}
                    </button>
                    <button
                        onClick={onClearAll}
                        className="control-btn btn-clear"
                        title="Clear Sequence"
                    >
                        <Trash2 size={18} /> Clear
                    </button>
                </div>

                {isPlaying ? (
                    <div className="sequencer-playback-view">
                        {/* Playback View - Measure/Beat Indicator */}
                        <div className="text-4xl font-bold mb-10" style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '2.5rem', color: 'var(--text-color)' }}>
                            Measure {Math.floor(currentBeat / 4) + 1} : Beat {(currentBeat % 4) + 1}
                        </div>

                        <div
                            className="transform scale-125 origin-top inline-block"
                            style={{ width: 'max-content', margin: '0 auto', transform: 'scale(1.25)', marginTop: '0.5rem' }}
                        >
                            <ChordDiagram
                                voicing={sequence[currentBeat]}
                                displayMode={displayMode}
                                intervalMap={sequence[currentBeat]?.intervalMap || intervalMap}
                                onClick={undefined}
                                interactive={false}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="sequencer-scroll-container">
                        {/* 8 Measures */}
                        {Array.from({ length: 8 }, (_, i) => i).map(measureIdx => (
                            <div key={measureIdx} className="sequencer-measure-card">
                                <div className="measure-label">Measure {measureIdx + 1}</div>
                                <div className="beat-grid">
                                    {[0, 1, 2, 3].map(beatIdx => {
                                        const globalIdx = measureIdx * 4 + beatIdx;
                                        const voicing = sequence[globalIdx];
                                        const isActive = activeSlot === globalIdx;

                                        return (
                                            <div
                                                key={globalIdx}
                                                onClick={() => onSlotClick(globalIdx)}
                                                className={`beat-slot ${isActive ? 'active' : ''} ${voicing ? 'occupied' : ''}`}
                                            >
                                                <div className="beat-slot-content">
                                                    {isActive && (
                                                        <span className="play-cursor">►</span>
                                                    )}

                                                    <div className="beat-text-wrapper">
                                                        <span className="beat-label-mini">Beat {beatIdx + 1}</span>
                                                        {voicing && (
                                                            <div className="min-w-0 text-left" style={{ overflow: 'hidden' }}>
                                                                <span className="chord-name-text">{voicing.name}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {voicing && (
                                                        <button
                                                            onClick={(e) => onClearSlot(globalIdx, e)}
                                                            className="slot-clear-btn"
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!isPlaying && (
                    <div className="mt-4 text-sm text-gray-500 text-center" style={{ marginTop: '1rem', color: '#6b7280', fontSize: '0.875rem', textAlign: 'center' }}>
                        <p>Click a beat to select it, then click a chord diagram below to add it to the sequence.</p>
                    </div>
                )}
            </div>
        </details>
    );
};

export default Sequencer;
