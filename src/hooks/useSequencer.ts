import { useState, useEffect, useRef } from 'react';
import { Voicing } from '../logic/voicing-generator';
import { playChordAt, playClickAt, getAudioContext, playMidiNoteAt, getChordGain, resetAudioContext } from '../logic/audio';
import { RHYTHM_PATTERNS, RhythmPatternKey, getAdaptiveTriggers } from '../logic/rhythm-patterns';
import generateLick, { Lick } from '../../logic/lick-generator';
import { getNoteIndex } from '../logic/music-theory';

interface UseSequencerProps {
    sequence: (Voicing | null)[];
    bpm: number;
    isPlaying: boolean;
    isPaused: boolean;
    isRepeatMode: boolean;
    repeatRange: { start: number, end: number } | null;
    selectedRhythm: RhythmPatternKey;
    guitarLickEnabled?: boolean;
    lickDifficulty?: number; // 1..3
}

export function useSequencer({ sequence, bpm, isPlaying, isPaused, isRepeatMode, repeatRange, selectedRhythm, guitarLickEnabled = false, lickDifficulty = 1 }: UseSequencerProps) {
    const [currentBeat, setCurrentBeat] = useState<number>(-1);
    const nextNoteTimeRef = useRef<number>(0);
    const currentStepRef = useRef<number>(0);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const timerWorkerRef = useRef<Worker | null>(null);
    const scheduledTimeoutsRef = useRef<number[]>([]);
    // Lick state
    const lickStateRef = useRef<{ currentLick: Lick | null; lickRepeatsLeft: number; progRepeatsLeft: number } | null>(null);

    // Track isPlaying in a ref for access inside async/timeout callbacks
    const isPlayingRef = useRef(isPlaying);
    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    // Track selectedRhythm in ref
    const selectedRhythmRef = useRef(selectedRhythm);
    useEffect(() => {
        selectedRhythmRef.current = selectedRhythm;
    }, [selectedRhythm]);

    // Keep sequence in a ref to access latest value in scheduler interval
    const sequenceRef = useRef(sequence);
    useEffect(() => {
        sequenceRef.current = sequence;
    }, [sequence]);

    // Track bpm in ref
    const bpmRef = useRef(bpm);
    useEffect(() => {
        bpmRef.current = bpm;
    }, [bpm]);

    // Track guitar lick opts in refs
    const guitarLickEnabledRef = useRef<boolean>(false);
    const lickDifficultyRef = useRef<number>(1);


    // Lookahead constants
    // const lookahead = 25.0; // Handled by worker now
    const scheduleAheadTime = 0.25; // How far ahead to schedule audio (in seconds)

    // Initialize Worker
    useEffect(() => {
        const worker = new Worker(new URL('../workers/timer.worker.ts', import.meta.url), { type: 'module' });
        timerWorkerRef.current = worker;

        worker.onmessage = (e) => {
            if (e.data === 'tick') {
                scheduler();
            }
        };

        worker.postMessage({ interval: 25.0 });

        return () => {
            worker.terminate();
        };
    }, []);

    // Handle Visibility Change (iOS Fix)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
                    audioCtxRef.current.resume();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const clearScheduledTimeouts = () => {
        scheduledTimeoutsRef.current.forEach((timeoutId) => {
            window.clearTimeout(timeoutId);
        });
        scheduledTimeoutsRef.current = [];
    };

    useEffect(() => {
        if (isPlaying) {
            // Initialize AudioContext if needed
            if (!audioCtxRef.current) {
                audioCtxRef.current = getAudioContext();
            }

            if (audioCtxRef.current.state === 'suspended') {
                audioCtxRef.current.resume();
            }

            if (isPaused) {
                timerWorkerRef.current?.postMessage('stop');
            } else {
                // Resuming or Starting
                if (currentBeat === -1) {
                    nextNoteTimeRef.current = audioCtxRef.current!.currentTime + 0.1;
                    // Start with count-in (-4)
                    currentStepRef.current = -4;
                    // Reset lick state on fresh start
                    lickStateRef.current = { currentLick: null, lickRepeatsLeft: 4, progRepeatsLeft: 4 };
                } else {
                    // Resuming from Pause
                    nextNoteTimeRef.current = audioCtxRef.current!.currentTime + 0.1;

                    // If resuming and we are out of bounds in repeat mode, jump to start
                    if (isRepeatMode && repeatRange) {
                        if (currentBeat < repeatRange.start || currentBeat > repeatRange.end) {
                            currentStepRef.current = repeatRange.start;
                        } else {
                            currentStepRef.current = currentBeat;
                        }
                    } else {
                        currentStepRef.current = currentBeat;
                    }
                }
                timerWorkerRef.current?.postMessage('start');
            }
        } else {
            timerWorkerRef.current?.postMessage('stop');
            clearScheduledTimeouts();
            setCurrentBeat(-1);
            currentStepRef.current = 0;
            nextNoteTimeRef.current = 0;
            if (audioCtxRef.current) {
                audioCtxRef.current = null;
            }
            // Clear lick state when stopping
            if (lickStateRef.current) {
                lickStateRef.current.currentLick = null;
                lickStateRef.current.lickRepeatsLeft = 4;
                lickStateRef.current.progRepeatsLeft = 4;
            }
            resetAudioContext();
        }

        return () => {
            // Don't terminate worker here, just stop it
            timerWorkerRef.current?.postMessage('stop');
            clearScheduledTimeouts();
        };
    }, [isPlaying, isPaused]);

    // Keep guitar lick flags in refs when props change
    useEffect(() => {
        guitarLickEnabledRef.current = guitarLickEnabled;
        lickDifficultyRef.current = lickDifficulty;
    }, [guitarLickEnabled, lickDifficulty]);

    const chordDuckingStateRef = useRef<{ endTime: number | null }>({ endTime: null });

    const scheduleChordAttenuation = (triggerTime: number, durationSec: number) => {
        const chordGain = getChordGain();
        const duckedLevel = 0.35;
        const endTime = triggerTime + durationSec;

        // If there is already a longer duck period scheduled, keep it.
        if (chordDuckingStateRef.current.endTime && chordDuckingStateRef.current.endTime > endTime) {
            chordGain.gain.setValueAtTime(duckedLevel, triggerTime);
            return;
        }

        chordDuckingStateRef.current.endTime = endTime;
        chordGain.gain.setValueAtTime(duckedLevel, triggerTime);
        chordGain.gain.setValueAtTime(1.0, endTime);
    };

    const scheduler = () => {
        // while there are notes that will need to play before the next interval,
        // schedule them and advance the pointer.
        if (!audioCtxRef.current || !isPlayingRef.current) return;

        while (nextNoteTimeRef.current < audioCtxRef.current.currentTime + scheduleAheadTime) {
            scheduleNote(currentStepRef.current, nextNoteTimeRef.current);
            nextNote();
        }
    };

    const nextNote = () => {
        const secondsPerBeat = 60.0 / bpmRef.current;
        nextNoteTimeRef.current += secondsPerBeat;

        // If in count-in, just increment
        if (currentStepRef.current < 0) {
            let next = currentStepRef.current + 1;
            // If next is 0, we can check if we should jump to start of repeat range
            if (next === 0 && isRepeatMode && repeatRange) {
                next = repeatRange.start;
            }
            currentStepRef.current = next;
            return;
        }

        // Calculate dynamic loop length
        let lastPopulatedIndex = -1;
        sequenceRef.current.forEach((voicing, idx) => {
            if (voicing) lastPopulatedIndex = idx;
        });

        // Determine loop bounds
        let loopStart = 0;
        let loopEnd = 32;

        if (isRepeatMode && repeatRange) {
            loopStart = repeatRange.start;
            loopEnd = repeatRange.end + 1;
        } else {
            if (lastPopulatedIndex !== -1) {
                const maxMeasureIndex = Math.floor(lastPopulatedIndex / 4);
                loopEnd = (maxMeasureIndex + 1) * 4;
            }
        }

        const prevStep = currentStepRef.current;
        let nextStep = currentStepRef.current + 1;

        // Loop logic
        if (isRepeatMode && repeatRange) {
            // If we are outside the range or at the end, jump to start
            if (nextStep >= loopEnd || nextStep < loopStart) {
                nextStep = loopStart;
            }
        } else {
            // Normal behavior: loop back to 0 at the end of the calculated sequence
            if (nextStep >= loopEnd) {
                nextStep = 0;
            }
        }

        currentStepRef.current = nextStep;

        // Detect loop wrap (prevStep at end -> nextStep at loopStart)
        const loopWrapped = (prevStep >= loopStart && prevStep === loopEnd - 1 && nextStep === loopStart);
        if (loopWrapped) {
            // Handle lick cycle state
            if (!lickStateRef.current) {
                lickStateRef.current = { currentLick: null, lickRepeatsLeft: 4, progRepeatsLeft: 4 };
            }

            const lickState = lickStateRef.current;
            if (guitarLickEnabledRef.current) {
                if (lickState.lickRepeatsLeft > 0) {
                    // Ensure we have a current lick
                    if (!lickState.currentLick) {
                        // Build a simple progression snapshot from loopStart..loopEnd
                        const prog: { rootMidi: number; type?: string; durationBeats?: number }[] = [];
                        for (let m = loopStart; m < loopEnd; m += 4) {
                            const v = sequenceRef.current[m];
                            if (v && v.positions && v.positions.length > 0) {
                                const rootName = v.positions[0].note as any as string;
                                const idx = getNoteIndex(rootName);
                                const rootMidi = (isNaN(idx) ? 60 : 60 + idx);
                                prog.push({ rootMidi, type: undefined, durationBeats: 4 });
                            } else {
                                prog.push({ rootMidi: 60, type: undefined, durationBeats: 4 });
                            }
                        }
                        lickState.currentLick = generateLick(prog, undefined, lickDifficultyRef.current, { fretMin: 1, fretMax: 18 });
                    }
                    lickState.lickRepeatsLeft -= 1;
                } else if (lickState.progRepeatsLeft > 0) {
                    // Turn off lick playback for a number of cycles
                    lickState.currentLick = null;
                    lickState.progRepeatsLeft -= 1;
                } else {
                    // Reset counters and generate a fresh lick on next wrap
                    lickStateRef.current = { currentLick: null, lickRepeatsLeft: 4, progRepeatsLeft: 4 };
                }
            } else {
                // If feature disabled, clear any current lick
                lickState.currentLick = null;
            }
        }
    };

    const scheduleNote = (beatNumber: number, time: number) => {
        if (!isPlayingRef.current) return;

        const delay = (time - audioCtxRef.current!.currentTime) * 1000;
        const timeoutId = window.setTimeout(() => {
            scheduledTimeoutsRef.current = scheduledTimeoutsRef.current.filter((id) => id !== timeoutId);
            // Check if still playing before updating state to avoid race condition
            if (!isPlayingRef.current) return;

            // Only update currentBeat if >= 0 to avoid highlighting weird slots negative
            if (beatNumber >= 0) {
                setCurrentBeat(beatNumber);
            } else {
                setCurrentBeat(-1);
            }
        }, Math.max(0, delay));
        scheduledTimeoutsRef.current.push(timeoutId);

        if (beatNumber < 0) {
            // Count-in clicks
            const isAccent = (beatNumber === -4);
            playClickAt(time, isAccent);
        } else {
            // Play audio using fresh sequence ref
            const voicing = sequenceRef.current[beatNumber];

            if (voicing) {
                const currentPattern = RHYTHM_PATTERNS[selectedRhythmRef.current] || RHYTHM_PATTERNS['Four on the Floor'];
                const beatIndex = beatNumber % 4;
                const prevVoicing = beatNumber > 0 ? sequenceRef.current[beatNumber - 1] : null;
                const triggers = getAdaptiveTriggers(currentPattern, beatIndex, voicing, prevVoicing);

                if (triggers && triggers.length > 0) {
                    triggers.forEach(trigger => {
                        const secondsPerBeat = 60.0 / bpmRef.current;
                        const triggerTime = time + (trigger.offset * secondsPerBeat);
                        const durationBeats = trigger.duration || 1.0;
                        const durationSeconds = durationBeats * secondsPerBeat;

                        playChordAt(voicing.positions, triggerTime, durationSeconds);
                    });
                }
            }

            // Also schedule any lick notes that fall within this beat window
            const lickState = lickStateRef.current;
            if (lickState && lickState.currentLick) {
                const secondsPerBeat = 60.0 / bpmRef.current;
                const notes = lickState.currentLick.notes;
                notes.forEach(n => {
                    if (n.startBeat >= beatNumber && n.startBeat < beatNumber + 1) {
                        const offsetBeats = n.startBeat - beatNumber;
                        const triggerTime = time + offsetBeats * secondsPerBeat;
                        const durationSec = n.durationBeats * secondsPerBeat;
                        // If generator provided string/fret mapping, use guitar synth via playChordAt
                        scheduleChordAttenuation(triggerTime, durationSec);

                        if (typeof n.string === 'number' && typeof n.fret === 'number') {
                            const stringIdx = n.string + 1; // map 0->1(A), 1->2(D), ..., 4->5(high E)
                            const pos = [{ string: stringIdx, fret: n.fret, note: 'C' as any }];
                            playChordAt(pos, triggerTime, durationSec);
                        } else {
                            playMidiNoteAt(n.pitch, triggerTime, durationSec);
                        }
                    }
                });
            }
        }
    };

    const stepTo = (step: number) => {
        const safeStep = Math.max(0, Math.min(step, 159));
        currentStepRef.current = safeStep;
        setCurrentBeat(safeStep);
    };

    return { currentBeat, stepTo };
}
