import { useState, useEffect, useRef } from 'react';
import { Voicing } from '../logic/voicing-generator';
import { playChordAt, playClickAt, getAudioContext } from '../logic/audio';

interface UseSequencerProps {
    sequence: (Voicing | null)[];
    bpm: number;
    isPlaying: boolean;
    isPaused: boolean;
    isRepeatMode: boolean;
    repeatRange: { start: number, end: number } | null;
}

export function useSequencer({ sequence, bpm, isPlaying, isPaused, isRepeatMode, repeatRange }: UseSequencerProps) {
    const [currentBeat, setCurrentBeat] = useState<number>(-1);
    const nextNoteTimeRef = useRef<number>(0);
    const currentStepRef = useRef<number>(0);
    const timerIDRef = useRef<number | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);

    // Track isPlaying in a ref for access inside async/timeout callbacks
    const isPlayingRef = useRef(isPlaying);
    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    // Keep sequence in a ref to access latest value in scheduler interval
    const sequenceRef = useRef(sequence);
    useEffect(() => {
        sequenceRef.current = sequence;
    }, [sequence]);

    // Lookahead constants
    const lookahead = 25.0; // How frequently to call scheduling function (in milliseconds)
    const scheduleAheadTime = 0.1; // How far ahead to schedule audio (in seconds)

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
                if (timerIDRef.current) {
                    window.clearInterval(timerIDRef.current);
                    timerIDRef.current = null;
                }
            } else {
                if (!timerIDRef.current) {
                    // Resuming or Starting
                    if (currentBeat === -1) {
                        nextNoteTimeRef.current = audioCtxRef.current!.currentTime + 0.1;
                        // Start with count-in (-4) unless resuming logic says otherwise (but currentBeat === -1 implies stopped)
                        // If starting fresh in repeat mode? Still do count-in.
                        currentStepRef.current = -4;
                    } else {
                        // Resuming from Pause
                        nextNoteTimeRef.current = audioCtxRef.current!.currentTime + 0.1;

                        // If resuming and we are out of bounds in repeat mode, jump to start
                        if (isRepeatMode && repeatRange) {
                            if (currentBeat < repeatRange.start || currentBeat > repeatRange.end) {
                                currentStepRef.current = repeatRange.start;
                            } else {
                                // Resume from current, logic in nextNote will handle wrapping
                                currentStepRef.current = currentBeat;
                            }
                        } else {
                            currentStepRef.current = currentBeat;
                        }
                    }
                    timerIDRef.current = window.setInterval(() => scheduler(), lookahead);
                }
            }
        } else {
            if (timerIDRef.current) {
                window.clearInterval(timerIDRef.current);
                timerIDRef.current = null;
            }
            setCurrentBeat(-1);
            currentStepRef.current = 0;
        }

        return () => {
            if (timerIDRef.current) {
                window.clearInterval(timerIDRef.current);
                timerIDRef.current = null;
            }
        };
    }, [isPlaying, isPaused]);

    const scheduler = () => {
        // while there are notes that will need to play before the next interval, 
        // schedule them and advance the pointer.
        while (nextNoteTimeRef.current < audioCtxRef.current!.currentTime + scheduleAheadTime) {
            scheduleNote(currentStepRef.current, nextNoteTimeRef.current);
            nextNote();
        }
    };

    const nextNote = () => {
        const secondsPerBeat = 60.0 / bpm;
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
            loopEnd = repeatRange.end + 1; // End is exclusive for modulo logic usually, but here we want to loop back to start AFTER end
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
            // where stop is pressed but this timeout still fires
            if (!isPlayingRef.current) return;

            // Only update currentBeat if >= 0 to avoid highlighting weird slots negative
            if (beatNumber >= 0) {
                setCurrentBeat(beatNumber);
            } else {
                setCurrentBeat(-1); // Or keep -1
            }
        }, Math.max(0, delay));

        if (beatNumber < 0) {
            // Count-in clicks
            // beatNumber is -4, -3, -2, -1
            // Accent on -4 (which represents the '1' of the pre-measure)
            // Or -4, -3, -2, -1 corresponding to 1, 2, 3, 4 of count-in
            const isAccent = (beatNumber === -4);
            playClickAt(time, isAccent);
        } else {
            // Play audio using fresh sequence ref
            const voicing = sequenceRef.current[beatNumber];
            if (voicing) {
                playChordAt(voicing.positions, time);
            }
        }
    };

    const stepTo = (step: number) => {
        // Allow stepTo to override bounds if manual, but generally respected? 
        // Actually stepTo is used for manual navigation.
        const safeStep = Math.max(0, Math.min(step, 159));
        currentStepRef.current = safeStep;
        setCurrentBeat(safeStep);
    };

    return { currentBeat, stepTo };
}
