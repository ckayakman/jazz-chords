export interface RhythmTrigger {
    offset: number; // 0.0 to 1.0 (portion of beat)
    duration?: number; // Optional override for note duration (relative to beat)
}

export type RhythmPattern = RhythmTrigger[][];

export const RHYTHM_PATTERNS: Record<string, RhythmPattern> = {
    'Four on the Floor': [
        [{ offset: 0, duration: 0.8 }],
        [{ offset: 0, duration: 0.8 }],
        [{ offset: 0, duration: 0.8 }],
        [{ offset: 0, duration: 0.8 }]
    ],
    'Charleston': [
        [{ offset: 0, duration: 1.2 }],       // Beat 1 (Dotted Quarter approx)
        [{ offset: 0.5, duration: 0.4 }],     // Beat 2& (Eighth) - Short
        [],                    // Beat 3 (rest)
        []                     // Beat 4 (rest)
    ],
    'Tresillo (3-3-2)': [
        [{ offset: 0, duration: 1.2 }],       // 1.0 (Dotted Quarter)
        [],                    // 2.0 (Skip)
        [{ offset: 0.5, duration: 1.2 }],     // 2.5 (Dotted Quarter)
        [{ offset: 0, duration: 0.8 }]        // 4.0 (Quarter)
    ],
    'Jazz Swing (Red Garland)': [
        // "and" of 2, "and" of 4. Short comping stabs.
        [],
        [{ offset: 0.5, duration: 0.3 }],
        [],
        [{ offset: 0.5, duration: 0.3 }]
    ]
};

export type RhythmPatternKey = keyof typeof RHYTHM_PATTERNS;

export function getAdaptiveTriggers(
    pattern: RhythmPattern,
    beatIndex: number,
    currentVoicing: { name: string } | null,
    prevVoicing: { name: string } | null
): RhythmTrigger[] {
    // 1. Get standard triggers for this beat from the pattern
    const triggers = pattern[beatIndex];

    // 2. If the pattern defines triggers, stick to the pattern (priority to rhythm)
    if (triggers && triggers.length > 0) {
        return triggers;
    }

    // 3. If no triggers, check for harmonic change ("Adaptation")
    if (currentVoicing) {
        // Play if it's the first beat (prev is null) or if the chord name has changed
        const isChange = !prevVoicing || (currentVoicing.name !== prevVoicing.name);

        if (isChange) {
            // Fill the gap with a simple downbeat strum
            return [{ offset: 0, duration: 1.0 }];
        }
    }

    // 4. Otherwise, silence as per pattern
    return [];
}
