

/**
 * Validates if the parsed JSON is a valid sequence array.
 * A valid sequence is an array of (Voicing | null).
 */
export function validateSequence(data: any): boolean {
    if (!Array.isArray(data)) return false;

    // Check if every item is either null or looks like a Voicing
    return data.every(item => {
        if (item === null) return true;

        // Basic shape check for Voicing
        return (
            typeof item === 'object' &&
            typeof item.name === 'string' &&
            Array.isArray(item.positions) &&
            // Check positions structure
            item.positions.every((pos: any) =>
                typeof pos.string === 'number' &&
                typeof pos.fret === 'number' &&
                typeof pos.note === 'string' // Note is a string type alias
            )
        );
    });
}
