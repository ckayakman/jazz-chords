import React from 'react';
import { Voicing } from '../logic/voicing-generator';
import { validateSequence } from '../logic/persistence-utils';
import { Play, Square, Trash2, X, Download, Upload, Pause, SkipBack, SkipForward } from 'lucide-react';
import ChordDiagram from './ChordDiagram';

interface SequencerProps {
    sequence: ((Voicing & { intervalMap?: Record<string, string> }) | null)[];
    activeSlot: number | null;
    currentBeat: number;
    isPlaying: boolean;
    isPaused: boolean;
    bpm: number;
    onBpmChange: (bpm: number) => void;
    onSlotClick: (index: number) => void;
    onClearSlot: (index: number, e: React.MouseEvent) => void;
    onPlay: () => void;
    onStop: () => void;
    onPause: () => void;
    onResume: () => void;
    onStepChange: (step: number) => void;
    onClearAll: () => void;
    onLoad: (seq: any[]) => void;
    displayMode: 'notes' | 'intervals';
    intervalMap: Record<string, string>;
    onPaste: (start: number, end: number, target: number) => void;
}

const Sequencer: React.FC<SequencerProps> = ({
    sequence,
    activeSlot,
    currentBeat,
    isPlaying,
    isPaused,
    bpm,
    onBpmChange,
    onSlotClick,
    onClearSlot,
    onPlay,
    onStop,
    onPause,
    onResume,
    onStepChange,
    onClearAll,
    onLoad,
    displayMode,
    intervalMap,
    onPaste
}) => {
    // Local state for input to allow typing without immediate clamping
    const [localBpm, setLocalBpm] = React.useState(bpm.toString());
    const [copyMode, setCopyMode] = React.useState<'idle' | 'start' | 'end' | 'target'>('idle');
    const [copyStart, setCopyStart] = React.useState<number | null>(null);
    const [copyEnd, setCopyEnd] = React.useState<number | null>(null);

    // Sync local state when prop changes (e.g. if set externally)
    React.useEffect(() => {
        setLocalBpm(bpm.toString());
    }, [bpm]);

    // Scroll to current beat when entering copy mode while playing
    React.useEffect(() => {
        if (copyMode === 'start' && isPlaying) {
            // Small timeout to allow render to switch to grid view
            setTimeout(() => {
                const el = document.getElementById(`beat-slot-${currentBeat}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                }
            }, 100);
        }
    }, [copyMode, isPlaying, currentBeat]);

    const handleBpmCommit = () => {
        let val = parseInt(localBpm);
        if (isNaN(val)) val = 90; // Default fallback
        const clamped = Math.min(160, Math.max(40, val));
        setLocalBpm(clamped.toString());
        onBpmChange(clamped);
    };

    const handleSave = () => {
        let filename = window.prompt('Enter filename for sequence:', 'sequence');
        if (!filename) return; // User cancelled or empty

        if (!filename.endsWith('.json')) {
            filename += '.json';
        }

        const dataStr = JSON.stringify(sequence);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleCopyClick = () => {
        if (copyMode === 'idle') {
            if (isPlaying && !isPaused) {
                onPause();
            }
            setCopyMode('start');
            setCopyStart(null);
            setCopyEnd(null);
        } else {
            setCopyMode('idle');
            setCopyStart(null);
            setCopyEnd(null);
        }
    };

    const handleSlotInteraction = (index: number) => {
        if (copyMode === 'idle') {
            onSlotClick(index);
        } else if (copyMode === 'start') {
            setCopyStart(index);
            setCopyMode('end');
        } else if (copyMode === 'end') {
            // Ensure end is after start, swap if needed
            let start = copyStart!;
            let end = index;
            if (end < start) {
                const temp = start;
                start = end;
                end = temp;
            }
            setCopyStart(start);
            setCopyEnd(end);
            setCopyMode('target');
        } else if (copyMode === 'target') {
            if (copyStart !== null && copyEnd !== null) {
                onPaste(copyStart, copyEnd, index);
                setCopyMode('idle');
                setCopyStart(null);
                setCopyEnd(null);
            }
        }
    };


    const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                if (validateSequence(json)) {
                    onLoad(json);
                } else {
                    alert('Invalid sequence file. Please select a valid JSON file generated by this application.');
                }
            } catch (err) {
                console.error('Failed to parse sequence file', err);
                alert('Failed to parse sequence file. It might be corrupted or not a valid JSON.');
            }
        };
        reader.readAsText(file);
        // Reset input so same file can be selected again
        e.target.value = '';
    };

    return (
        <details className="sequencer-details group">
            <summary className="sequencer-summary">
                <span>Chord Sequencer</span>
            </summary>

            <div className="px-6 pb-6 fade-in-up">
                <div className="sequencer-controls">
                    <div className="bpm-input-container" onClick={() => document.getElementById('bpm-input')?.focus()}>
                        <label htmlFor="bpm-input" className="bpm-label">Tempo (bpm)</label>
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
                            className="bpm-input"
                        />
                    </div>

                    {/* Play/Stop Button */}
                    <button
                        onClick={isPlaying ? onStop : onPlay}
                        className={`control-btn ${isPlaying ? 'btn-stop' : 'btn-play'}`}
                    >
                        {isPlaying ? <><Square size={18} /> Stop</> : <><Play size={18} /> Play</>}
                    </button>

                    {/* Pause/Resume Button - Only visible when playing or paused */}
                    {isPlaying && (
                        <button
                            onClick={isPaused ? onResume : onPause}
                            className={`control-btn ${isPaused ? 'btn-play' : 'btn-stop'}`}
                        >
                            {isPaused ? <><Play size={18} /> Resume</> : <><Pause size={18} /> Pause</>}
                        </button>
                    )}

                    {/* Copy Button */}
                    <button
                        onClick={handleCopyClick}
                        className={`control-btn ref-copy-btn ${copyMode !== 'idle' ? 'btn-active-action' : 'btn-clear'}`}
                        title="Copy Range"
                    >
                        <span style={{ fontWeight: 600 }}>{copyMode === 'idle' ? 'Copy' : 'Cancel Copy'}</span>
                    </button>

                    <button
                        onClick={onClearAll}
                        className="control-btn btn-clear"
                        title="Clear Sequence"
                    >
                        <Trash2 size={18} /> Clear
                    </button>

                    <div className="h-6 w-px bg-gray-700 mx-2"></div>

                    <button
                        onClick={handleSave}
                        className="control-btn btn-clear"
                        title="Save Sequence"
                    >
                        <Download size={18} /> Save
                    </button>
                    <button
                        onClick={() => document.getElementById('hidden-file-input')?.click()}
                        className="control-btn btn-clear"
                    >
                        <Upload size={18} /> Load
                    </button>
                    <input
                        id="hidden-file-input"
                        type="file"
                        accept=".json"
                        onChange={handleLoad}
                        style={{ display: 'none' }}
                    />
                </div>

                {copyMode !== 'idle' && (
                    <div style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>
                        {copyMode === 'start' && "Select Start Beat"}
                        {copyMode === 'end' && "Select End Beat"}
                        {copyMode === 'target' && "Select Target Beat to Paste"}
                    </div>
                )}

                {isPlaying && copyMode === 'idle' ? (
                    <div className="sequencer-playback-view">
                        {/* Playback View - Measure/Beat Indicator with Navigation */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '1rem',
                            marginBottom: '1rem'
                        }}>
                            {isPaused && (
                                <button
                                    onClick={() => onStepChange(currentBeat - 1)}
                                    // Use explicit style or class. Inline for now as requested for speed/precision.
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-color)', opacity: 0.8 }}
                                    className="hover:opacity-100 transition-opacity"
                                    title="Previous Beat"
                                >
                                    <SkipBack size={32} />
                                </button>
                            )}

                            <div style={{ fontSize: '1.8rem', textAlign: 'center', color: 'var(--text-color)', fontWeight: 'bold' }}>
                                Measure {Math.floor(currentBeat / 4) + 1} : Beat {(currentBeat % 4) + 1}
                            </div>

                            {isPaused && (
                                <button
                                    onClick={() => onStepChange(currentBeat + 1)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-color)', opacity: 0.8 }}
                                    className="hover:opacity-100 transition-opacity"
                                    title="Next Beat"
                                >
                                    <SkipForward size={32} />
                                </button>
                            )}
                        </div>

                        <div
                            className="inline-block"
                            style={{ width: 'max-content', margin: '0 auto', marginTop: '0.5rem' }}
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
                        {/* 40 Measures (was 8) */}
                        {Array.from({ length: 40 }, (_, i) => i).map(measureIdx => (
                            <div key={measureIdx} className="sequencer-measure-card">
                                <div className="measure-label">Measure {measureIdx + 1}</div>
                                <div className="beat-grid">
                                    {[0, 1, 2, 3].map(beatIdx => {
                                        const globalIdx = measureIdx * 4 + beatIdx;
                                        const voicing = sequence[globalIdx];
                                        const isActive = activeSlot === globalIdx;

                                        // Selection highlighting logic
                                        let isHighlighted = false;
                                        if (copyMode === 'end' && copyStart !== null) {
                                            if (globalIdx === copyStart) isHighlighted = true;
                                        }
                                        if (copyMode === 'target' && copyStart !== null && copyEnd !== null) {
                                            if (globalIdx >= copyStart && globalIdx <= copyEnd) isHighlighted = true;
                                        }

                                        return (
                                            <div
                                                key={globalIdx}
                                                id={`beat-slot-${globalIdx}`}
                                                onClick={() => handleSlotInteraction(globalIdx)}
                                                className={`beat-slot ${isActive ? 'active' : ''} ${voicing ? 'occupied' : ''} ${isHighlighted ? 'highlight-select' : ''}`}
                                                style={isHighlighted ? { borderColor: 'var(--primary-color)', backgroundColor: 'rgba(124, 58, 237, 0.1)' } : {}}
                                            >
                                                <div className="beat-slot-content">
                                                    {isActive && (
                                                        <span className="play-cursor">►</span>
                                                    )}

                                                    <div className="beat-text-wrapper">
                                                        <span className="beat-label-mini">Beat {beatIdx + 1}</span>
                                                        {voicing && (
                                                            <div style={{ minWidth: 0, textAlign: 'left', overflow: 'hidden' }}>
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
                    <div style={{ marginTop: '1rem', color: '#6b7280', fontSize: '0.875rem', textAlign: 'center' }}>
                        <p>Click a beat to select it, then click a chord diagram below to add it to the sequence.</p>
                    </div>
                )}
            </div>
        </details >
    );
};

export default Sequencer;
