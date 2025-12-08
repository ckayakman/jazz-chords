import { useState, useEffect, useRef } from 'react';
import { Voicing } from '../logic/voicing-generator';
import { playChordAt, getAudioContext } from '../logic/audio';

interface UseSequencerProps {
    sequence: (Voicing | null)[];
    bpm: number;
    isPlaying: boolean;
}

export function useSequencer({ sequence, bpm, isPlaying }: UseSequencerProps) {
    const [currentBeat, setCurrentBeat] = useState<number>(-1);
    const nextNoteTimeRef = useRef<number>(0);
    const currentStepRef = useRef<number>(0);
    const timerIDRef = useRef<number | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);

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

            // Reset if starting fresh
            if (currentBeat === -1) {
                nextNoteTimeRef.current = audioCtxRef.current!.currentTime + 0.1;
                currentStepRef.current = 0;
            }

            timerIDRef.current = window.setInterval(() => scheduler(), lookahead);
        } else {
            if (timerIDRef.current) {
                window.clearInterval(timerIDRef.current);
            }
            setCurrentBeat(-1);
        }

        return () => {
            if (timerIDRef.current) {
                window.clearInterval(timerIDRef.current);
            }
        };
    }, [isPlaying]);

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

        // Calculate dynamic loop length
        let lastPopulatedIndex = -1;
        sequenceRef.current.forEach((voicing, idx) => {
            if (voicing) lastPopulatedIndex = idx;
        });

        // Default to 16 if empty, otherwise loop up to the end of the last populated measure
        let loopSteps = 32;
        if (lastPopulatedIndex !== -1) {
            const maxMeasureIndex = Math.floor(lastPopulatedIndex / 4);
            loopSteps = (maxMeasureIndex + 1) * 4;
        }

        currentStepRef.current = (currentStepRef.current + 1) % loopSteps;
    };

    const scheduleNote = (beatNumber: number, time: number) => {
        const delay = (time - audioCtxRef.current!.currentTime) * 1000;
        setTimeout(() => {
            setCurrentBeat(beatNumber);
        }, Math.max(0, delay));

        // Play audio using fresh sequence ref
        const voicing = sequenceRef.current[beatNumber];
        if (voicing) {
            playChordAt(voicing.positions, time);
        }
    };

    return { currentBeat };
}
