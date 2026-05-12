import { useState, useEffect, useRef } from 'react';
import { Voicing } from '../logic/voicing-generator';
import { playChordAt, playClickAt, getAudioContext } from '../logic/audio';
import { RHYTHM_PATTERNS, RhythmPatternKey, getAdaptiveTriggers } from '../logic/rhythm-patterns';

interface UseSequencerProps {
    sequence: (Voicing | null)[];
    bpm: number;
    isPlaying: boolean;
    isPaused: boolean;
    isRepeatMode: boolean;
    repeatRange: { start: number, end: number } | null;
    selectedRhythm: RhythmPatternKey;
}

export function useSequencer({ sequence, bpm, isPlaying, isPaused, isRepeatMode, repeatRange, selectedRhythm }: UseSequencerProps) {
    const [currentBeat, setCurrentBeat] = useState<number>(-1);
    const nextNoteTimeRef = useRef<number>(0);
    const currentStepRef = useRef<number>(0);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const timerWorkerRef = useRef<Worker | null>(null);

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

    // Lookahead constants
    // const lookahead = 25.0; // Handled by worker now
    const scheduleAheadTime = 0.1; // How far ahead to schedule audio (in seconds)

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
            setCurrentBeat(-1);
            currentStepRef.current = 0;
        }

        return () => {
            // Don't terminate worker here, just stop it
            timerWorkerRef.current?.postMessage('stop');
        };
    }, [isPlaying, isPaused]);

    const scheduler = () => {
        // while there are notes that will need to play before the next interval, 
        // schedule them and advance the pointer.
        if (!audioCtxRef.current) return;

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
    };

    const scheduleNote = (beatNumber: number, time: number) => {
        const delay = (time - audioCtxRef.current!.currentTime) * 1000;
        setTimeout(() => {
            // Check if still playing before updating state to avoid race condition
            if (!isPlayingRef.current) return;

            // Only update currentBeat if >= 0 to avoid highlighting weird slots negative
            if (beatNumber >= 0) {
                setCurrentBeat(beatNumber);
            } else {
                setCurrentBeat(-1);
            }
        }, Math.max(0, delay));

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
        }
    };

    const stepTo = (step: number) => {
        const safeStep = Math.max(0, Math.min(step, 159));
        currentStepRef.current = safeStep;
        setCurrentBeat(safeStep);
    };

    return { currentBeat, stepTo };
}
