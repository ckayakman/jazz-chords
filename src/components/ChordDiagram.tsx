import React from 'react';
import { Voicing } from '../logic/voicing-generator';
import { playChord } from '../logic/audio';

interface ChordDiagramProps {
    voicing: Voicing | null;
    displayMode?: 'notes' | 'intervals';
    intervalMap?: Record<string, string>;
    onClick?: () => void;
}

const ChordDiagram: React.FC<ChordDiagramProps> = ({ voicing, displayMode = 'notes', intervalMap = {}, onClick }) => {
    const positions = voicing ? voicing.positions : [];

    // Determine fret range to display
    const frets = positions.map(p => p.fret);
    const minFret = frets.length > 0 ? Math.min(...frets) : 1;
    const maxFret = frets.length > 0 ? Math.max(...frets) : 5;


    // Display a window of 5 frets.
    // We prefer starting at minFret - 1 for aesthetics (padding at top).
    // But we must ensure maxFret is included.
    let startFret = Math.max(1, minFret - 1);
    const windowSize = 5;
    if (startFret + windowSize - 1 < maxFret) {
        startFret = maxFret - windowSize + 1;
    }
    const endFret = startFret + windowSize - 1;

    const width = 200;
    const height = 240;
    const padding = 30;
    const stringSpacing = (width - 2 * padding) / 5;
    const fretSpacing = (height - 2 * padding) / 5;

    return (
        <div
            className="chord-diagram cursor-pointer hover:bg-gray-800 rounded-lg transition-colors duration-200 inline-block"
            onClick={onClick || (() => positions.length > 0 && playChord(positions))}
            title="Click to play or add to sequence"
        >
            <h3 className="text-center mb-2 text-lg font-semibold min-h-[1.75rem]">{voicing ? voicing.name : 'Rest'}</h3>
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
                {/* Fretboard background */}
                <rect x={padding} y={padding} width={width - 2 * padding} height={height - 2 * padding} fill="#2a2a2a" />

                {/* Frets (Horizontal lines) */}
                {Array.from({ length: 6 }).map((_, i) => (
                    <line
                        key={`fret-${i}`}
                        x1={padding}
                        y1={padding + i * fretSpacing}
                        x2={width - padding}
                        y2={padding + i * fretSpacing}
                        stroke="#555"
                        strokeWidth={2}
                    />
                ))}

                {/* Strings (Vertical lines) */}
                {Array.from({ length: 6 }).map((_, i) => (
                    <line
                        key={`string-${i}`}
                        x1={padding + i * stringSpacing}
                        y1={padding}
                        x2={padding + i * stringSpacing}
                        y2={height - padding}
                        stroke="#888"
                        strokeWidth={i < 2 ? 1 : i < 4 ? 1.5 : 2} // Thicker for low strings? Actually low E is index 0 in our logic but index 0 here is left...
                    // Usually diagrams have Low E on left.
                    // Our logic: 0=Low E.
                    // So index 0 (left) should be Low E.
                    />
                ))}

                {/* Fret Numbers */}
                <text x={padding - 10} y={padding + fretSpacing / 2 + 5} fill="#aaa" fontSize="12" textAnchor="end">
                    {startFret}
                </text>

                {/* Dots */}
                {positions.map((pos, i) => {
                    // pos.string: 0=Low E (Left), 5=High E (Right)
                    const stringX = padding + pos.string * stringSpacing;

                    // pos.fret relative to startFret
                    // If fret is 5 and startFret is 4:
                    // It should be in the 2nd slot (between line 1 and 2? No, between line 1 and 2 is fret 1 relative)
                    // Fret N is between line N-1 and N.
                    // relativeFret = pos.fret - startFret + 1;
                    // y = padding + (relativeFret - 0.5) * fretSpacing;

                    const relativeFret = pos.fret - startFret + 1;

                    // Check if visible
                    if (pos.fret < startFret || pos.fret > endFret) return null;

                    const y = padding + (relativeFret - 0.5) * fretSpacing;

                    return (
                        <g key={i}>
                            <circle cx={stringX} cy={y} r={12} fill="#bb86fc" />
                            <text x={stringX} y={y + 4} fill="#000" fontSize="10" textAnchor="middle" fontWeight="bold">
                                {displayMode === 'intervals' ? (intervalMap[pos.note] || pos.note) : pos.note}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

export default ChordDiagram;
