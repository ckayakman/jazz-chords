import React from 'react';
import { Voicing } from '../logic/voicing-generator';
import { validateSequence } from '../logic/persistence-utils';
import { Play, Square, Trash2, X, Download, Upload, Pause, SkipBack, SkipForward, Repeat, BookOpen } from 'lucide-react';
import { generateProgressionSequence, ProgressionType } from '../logic/progression-generator';
import { VoicingType } from '../logic/voicing-generator';

import ChordDiagram from './ChordDiagram';
import SaveModal from './SaveModal';
import ProgressionModal from './ProgressionModal';

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
    isRepeatMode: boolean;
    repeatRange: { start: number, end: number } | null;
    onToggleRepeatMode: () => void;
    onSetRepeatRange: (range: { start: number, end: number } | null) => void;
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
    onPaste,
    isRepeatMode,
    repeatRange,
    onToggleRepeatMode,
    onSetRepeatRange
}) => {
    // Local state for input to allow typing without immediate clamping
    const [localBpm, setLocalBpm] = React.useState(bpm.toString());
    const [copyMode, setCopyMode] = React.useState<'idle' | 'start' | 'end' | 'target'>('idle');
    const [showSaveModal, setShowSaveModal] = React.useState(false);
    const [showProgressionModal, setShowProgressionModal] = React.useState(false);
    const [downloadUrl, setDownloadUrl] = React.useState<string | null>(null);
    const [copyStart, setCopyStart] = React.useState<number | null>(null);
    const [copyEnd, setCopyEnd] = React.useState<number | null>(null);



    // Repeat Selection State
    const [repeatSelStart, setRepeatSelStart] = React.useState<number | null>(null);
    const [repeatSelMode, setRepeatSelMode] = React.useState<'idle' | 'start' | 'end'>('idle');

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

    // Cleanup download URL when modal closes or sequence changes
    React.useEffect(() => {
        if (!showSaveModal && downloadUrl && downloadUrl.startsWith('blob:')) {
            URL.revokeObjectURL(downloadUrl);
            setDownloadUrl(null);
        } else if (!showSaveModal && downloadUrl) {
            setDownloadUrl(null);
        }
    }, [showSaveModal, downloadUrl]);

    const handleSaveClick = async (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        const dataStr = JSON.stringify(sequence);

        try {
            if ('showSaveFilePicker' in window) {
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: 'sequence.json',
                    types: [{
                        description: 'JSON Sequence',
                        accept: { 'application/json': ['.json'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(dataStr);
                await writable.close();
                return; // Saved successfully, skip modal
            }
        } catch (err: any) {
            // User cancelled request or API failed
            if (err.name === 'AbortError') {
                return; // User cancelled, do nothing
            }
            console.warn('File System Access API not supported or failed, falling back to download:', err);
            // check for SecurityError specifically if needed, but fallback is safe
        }

        // Fallback: Use SaveModal with File object API
        // Using File constructor is cleaner than Blob for downloads, allows specifying name properties if needed
        const file = new File([dataStr], 'sequence.json', { type: 'application/json' });
        const url = URL.createObjectURL(file);
        setDownloadUrl(url);

        setShowSaveModal(true);
    };

    const handleCopyClick = () => {
        // If entering copy mode, ensure practice selection is cleared
        if (copyMode === 'idle') {
            if (isPlaying && !isPaused) {
                onPause();
            }
            setCopyMode('start');
            setCopyStart(null);
            setCopyEnd(null);
            setRepeatSelMode('idle'); // Clear repeat selection if active
        } else {
            setCopyMode('idle');
            setCopyStart(null);
            setCopyEnd(null);
        }
    };

    const handleRepeatToggle = () => {
        if (!isRepeatMode) {
            // Enabling repeat mode
            onToggleRepeatMode();
            // If no range set, start selection
            if (!repeatRange) {
                setRepeatSelMode('start');
                setRepeatSelStart(null);
            }
        } else {
            // Cancel Repeat: Exit mode and clear state
            onToggleRepeatMode();
            setRepeatSelMode('idle');
            setRepeatSelStart(null);
            onSetRepeatRange(null); // Explicitly clear the range
            onStop(); // Stop playback immediately
        }
    };

    const handleSlotInteraction = (index: number) => {
        // Priority: Copy selection -> Repeat selection -> Normal interaction
        if (copyMode !== 'idle') {
            if (copyMode === 'start') {
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
            return;
        }

        if (repeatSelMode !== 'idle') {
            if (repeatSelMode === 'start') {
                setRepeatSelStart(index);
                setRepeatSelMode('end');
            } else if (repeatSelMode === 'end') {
                let start = repeatSelStart!;
                let end = index;
                if (end < start) {
                    const temp = start;
                    start = end;
                    end = temp;
                }
                onSetRepeatRange({ start, end });
                setRepeatSelMode('idle');
                setRepeatSelStart(null);
                // Auto-play on range select confirmation
                if (!isPlaying) {
                    onPlay();
                }
            }
            return;
        }

        // Normal interaction
        onSlotClick(index);
    };


    const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                if (validateSequence(json)) {
                    onStop(); // Stop playback to ensure fresh start (with count-in) on next play
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
                        className={`control-btn ref-copy-btn desktop-only-btn ${copyMode !== 'idle' ? 'btn-stop' : 'btn-clear'}`}
                        title="Copy Range"
                    >
                        <span style={{ fontWeight: 600 }}>{copyMode === 'idle' ? 'Copy' : 'Cancel Copy'}</span>
                    </button>

                    {/* Repeat Mode Button */}
                    <button
                        onClick={handleRepeatToggle}
                        className={`control-btn desktop-only-btn ${isRepeatMode ? 'btn-stop' : 'btn-clear'}`}
                        title={isRepeatMode ? "Cancel Repeat Loop" : "Enable Repeat Loop"}
                    >
                        <Repeat size={18} />
                        <span style={{ fontWeight: 600, marginLeft: '0.25rem' }}>{isRepeatMode ? 'Cancel Repeat' : 'Repeat'}</span>
                    </button>

                    <button
                        onClick={onClearAll}
                        className="control-btn btn-clear"
                        title="Clear Sequence"
                    >
                        <Trash2 size={18} /> Clear
                    </button>

                    <div className="h-6 w-px bg-gray-700 mx-2"></div>

                    {/* Library Button */}
                    <button
                        onClick={() => setShowProgressionModal(true)}
                        className="control-btn btn-clear desktop-only-btn"
                        title="Load from Library"
                    >
                        <BookOpen size={18} /> Library
                    </button>


                    <button
                        type="button"
                        onClick={handleSaveClick}
                        className="control-btn btn-clear desktop-only-btn"
                        title="Save Sequence"
                    >
                        <Download size={18} /> Save
                    </button>
                    <button
                        onClick={() => document.getElementById('hidden-file-input')?.click()}
                        className="control-btn btn-clear desktop-only-btn"
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
                    <div style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--secondary-color)', fontWeight: 'bold', fontStyle: 'italic' }}>
                        {copyMode === 'start' && "Select Start Beat for Copy"}
                        {copyMode === 'end' && "Select End Beat for Copy"}
                        {copyMode === 'target' && "Select Target Beat to Paste"}
                    </div>
                )}

                {repeatSelMode !== 'idle' && (
                    <div style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--secondary-color)', fontWeight: 'bold', fontStyle: 'italic' }}>
                        {repeatSelMode === 'start' && "Select Start Beat for Repeat Loop"}
                        {repeatSelMode === 'end' && "Select End Beat for Repeat Loop"}
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
                                        let isPracticeHighlighted = false;

                                        if (copyMode === 'end' && copyStart !== null) {
                                            if (globalIdx === copyStart) isHighlighted = true;
                                        }
                                        if (copyMode === 'target' && copyStart !== null && copyEnd !== null) {
                                            if (globalIdx >= copyStart && globalIdx <= copyEnd) isHighlighted = true;
                                        }

                                        // Repeat Selection Highlighting
                                        if (repeatSelMode === 'end' && repeatSelStart !== null) {
                                            if (globalIdx === repeatSelStart) isPracticeHighlighted = true;
                                        }

                                        // Active Repeat Range Highlighting (if not selecting)
                                        if (isRepeatMode && repeatRange && repeatSelMode === 'idle') {
                                            if (globalIdx >= repeatRange.start && globalIdx <= repeatRange.end) {
                                                isPracticeHighlighted = true;
                                            }
                                        }


                                        return (
                                            <div
                                                key={globalIdx}
                                                id={`beat-slot-${globalIdx}`}
                                                onClick={() => handleSlotInteraction(globalIdx)}
                                                className={`beat-slot ${isActive ? 'active' : ''} ${voicing ? 'occupied' : ''} ${isHighlighted ? 'highlight-select' : ''} ${isPracticeHighlighted ? 'highlight-practice' : ''}`}
                                                style={{
                                                    ...(isHighlighted ? { borderColor: 'var(--primary-color)', backgroundColor: 'rgba(124, 58, 237, 0.1)' } : {}),
                                                    ...(isPracticeHighlighted ? { borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: '2px' } : {})
                                                }}
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


            <SaveModal
                isOpen={showSaveModal}
                onClose={() => setShowSaveModal(false)}
                downloadUrl={downloadUrl}
            />

            <ProgressionModal
                isOpen={showProgressionModal}
                onClose={() => setShowProgressionModal(false)}
                onLoad={(progType, key, vType, strSet) => {
                    const seq = generateProgressionSequence(progType, key, vType, strSet);
                    if (seq.length > 0) {
                        onLoad(seq);
                    } else {
                        alert('Could not generate voicings for this progression in this key/range. Try a different range or voicing type.');
                    }
                }}
            />
        </details >
    );
};

export default Sequencer;
