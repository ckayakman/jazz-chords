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
        currentStepRef.current = (currentStepRef.current + 1) % 16; // Loop 16 steps
    };

    const scheduleNote = (beatNumber: number, time: number) => {
        // Update UI (using requestAnimationFrame for sync if needed, but setState is okay for this simple case)
        // We use a draw callback or just set state. 
        // Since audio is precise, we want UI to update roughly at 'time'.
        // For simplicity in React, we just set state. It might be slightly early but acceptable.
        // To be more precise, we could set a timeout to update the UI exactly when the note hits.

        const delay = (time - audioCtxRef.current!.currentTime) * 1000;
        setTimeout(() => {
            setCurrentBeat(beatNumber);
        }, Math.max(0, delay));

        // Play audio
        const voicing = sequence[beatNumber];
        if (voicing) {
            playChordAt(voicing.positions, time);
        }
    };

    return { currentBeat };
}
