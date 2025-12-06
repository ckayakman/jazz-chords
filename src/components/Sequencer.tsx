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
        <details className="w-full max-w-4xl mx-auto mt-8 bg-gray-50 rounded-xl border border-gray-200 shadow-sm group">
            <summary
                className="p-6 cursor-pointer font-bold transition-colors outline-none hover:opacity-80 flex items-center justify-between"
                style={{ fontSize: '1.8rem', color: 'var(--secondary-color)' }}
            >
                <span>Chord Sequencer</span>
            </summary>

            <div className="px-6 pb-6 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex justify-end gap-2 mb-4 items-center whitespace-nowrap">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors cursor-text" onClick={() => document.getElementById('bpm-input')?.focus()}>
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
                        />
                    </div>
                    <button
                        onClick={isPlaying ? onStop : onPlay}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${isPlaying
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                    >
                        {isPlaying ? <><Square size={18} /> Stop</> : <><Play size={18} /> Play</>}
                    </button>
                    <button
                        onClick={onClearAll}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                        title="Clear Sequence"
                    >
                        <Trash2 size={18} /> Clear
                    </button>
                </div>

                {isPlaying ? (
                    <div className="flex flex-col items-center justify-center py-8 animate-in fade-in zoom-in duration-300">
                        {/* Animation View */}
                        <div className="text-4xl font-bold text-indigo-900 mb-6">
                            Measure {Math.floor(currentBeat / 4) + 1} : Beat {(currentBeat % 4) + 1}
                        </div>

                        <div
                            className="transform scale-125 origin-top inline-block"
                            style={{ width: 'max-content', margin: '0 auto' }}
                        >
                            <ChordDiagram
                                voicing={sequence[currentBeat]}
                                displayMode={displayMode}
                                intervalMap={sequence[currentBeat]?.intervalMap || intervalMap}
                                // We can pass a dummy onClick or undefined since interaction isn't primary here
                                onClick={undefined}
                                interactive={false}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-4 gap-4">
                        {/* 4 Measures */}
                        {[0, 1, 2, 3].map(measureIdx => (
                            <div key={measureIdx} className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                                <div className="text-xs text-gray-400 mb-2 font-mono text-center">Measure {measureIdx + 1}</div>
                                <div className="grid grid-cols-4 gap-2">
                                    {[0, 1, 2, 3].map(beatIdx => {
                                        const globalIdx = measureIdx * 4 + beatIdx;
                                        const voicing = sequence[globalIdx];
                                        const isActive = activeSlot === globalIdx;
                                        // const isPlayingBeat = currentBeat === globalIdx; // Not needed in grid view if hidden during play

                                        return (
                                            <div
                                                key={globalIdx}
                                                onClick={() => onSlotClick(globalIdx)}
                                                className={`
                                                    relative h-16 rounded cursor-pointer transition-all border-2 flex items-center justify-center text-xs text-center p-1
                                                    ${isActive ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}
                                                    ${voicing ? 'bg-indigo-50 text-indigo-900 font-semibold' : 'text-gray-400'}
                                                `}
                                            >
                                                <div className="flex items-center justify-center gap-1 w-full h-full">
                                                    {isActive && (
                                                        <span className="text-blue-600 font-bold text-lg leading-none">►</span>
                                                    )}
                                                    {voicing ? (
                                                        <div className="flex-1 min-w-0">
                                                            <span className="line-clamp-2">{voicing.name}</span>
                                                            <button
                                                                onClick={(e) => onClearSlot(globalIdx, e)}
                                                                className="absolute -top-1 -right-1 bg-white rounded-full border border-gray-200 p-0.5 hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                <X size={10} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="opacity-30">{beatIdx + 1}</span>
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
                    <div className="mt-4 text-sm text-gray-500 text-center">
                        <p>Click a slot to select it, then click a chord diagram below to add it to the sequence.</p>
                    </div>
                )}
            </div>
        </details>
    );
};

export default Sequencer;
