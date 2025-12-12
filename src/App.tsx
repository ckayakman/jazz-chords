import React, { useState, useEffect } from 'react'
import { parseChord, getNotesFromIntervals, getIntervalMap } from './logic/music-theory'
import { generateVoicings, Voicing } from './logic/voicing-generator'
import ChordDiagram from './components/ChordDiagram'
import Sequencer from './components/Sequencer'
import { useSequencer } from './hooks/useSequencer'
import { playChord } from './logic/audio'
import FilterDropdown from './components/FilterDropdown'
import { validateSequence } from './logic/persistence-utils'

function App() {
    const [input, setInput] = useState('Cmin7(b5)')
    const [drop2TopVoicings, setDrop2TopVoicings] = useState<Voicing[]>([])
    const [drop2MiddleVoicings, setDrop2MiddleVoicings] = useState<Voicing[]>([])
    const [drop2BottomVoicings, setDrop2BottomVoicings] = useState<Voicing[]>([])
    const [drop3LowVoicings, setDrop3LowVoicings] = useState<Voicing[]>([])

    const [drop3HighVoicings, setDrop3HighVoicings] = useState<Voicing[]>([])
    const [shellVoicings, setShellVoicings] = useState<Voicing[]>([])
    const [freddieGreenVoicings, setFreddieGreenVoicings] = useState<Voicing[]>([])
    const [error, setError] = useState('')
    const [displayMode, setDisplayMode] = useState<'notes' | 'intervals'>('notes')
    const [intervalMap, setIntervalMap] = useState<Record<string, string>>({})
    const [activeFilters, setActiveFilters] = useState<string[]>(['all'])

    // Sequencer State
    const [sequence, setSequence] = useState<((Voicing & { intervalMap?: Record<string, string> }) | null)[]>(Array(160).fill(null))
    const [activeSlot, setActiveSlot] = useState<number | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [isRepeatMode, setIsRepeatMode] = useState(false)
    const [repeatRange, setRepeatRange] = useState<{ start: number, end: number } | null>(null)

    const [bpm, setBpm] = useState(90)
    const [hasInteracted, setHasInteracted] = useState(false)

    const { currentBeat, stepTo } = useSequencer({ sequence, bpm, isPlaying, isPaused, isRepeatMode, repeatRange })

    // Sync active slot when paused to allow editing
    useEffect(() => {
        if (isPaused && currentBeat !== -1) {
            setActiveSlot(currentBeat);
        }
    }, [isPaused, currentBeat]);

    // Auto-load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('jazz-chords-sequence')
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                if (validateSequence(parsed)) {
                    // Start with 160 nulls, then map over parsing
                    // If the saved sequence is shorter, we might need to pad it to 160
                    // But actually setSequence(parsed) will just set it to whatever size was saved.
                    // If we want to ENFORCE 40 measures even for old saves, we should pad it.
                    // For now, let's just trust parsed but ideally we should pad/truncate.
                    // Given the user request is "capture size from 8 to 40", we should probably ensure it is always 160 long.
                    const padded = Array(160).fill(null).map((_, i) => parsed[i] || null);
                    setSequence(padded)
                }
            } catch (e) {
                console.error('Failed to load sequence from localStorage', e)
            }
        }
    }, [])

    // Auto-save to localStorage
    useEffect(() => {
        // Save minimal data to avoid quota issues if it gets huge, 
        // though our objects are small.
        localStorage.setItem('jazz-chords-sequence', JSON.stringify(sequence))
    }, [sequence])



    useEffect(() => {
        handleSearch()
    }, []) // Run once on mount with default

    const handleSearch = () => {
        setError('')
        const parsed = parseChord(input)
        if (!parsed) {
            setError('Invalid chord name. Try "Cmaj7", "Dm7", "G7", "Cmin7(b5)"')
            setDrop2TopVoicings([])
            setDrop2MiddleVoicings([])
            setDrop2BottomVoicings([])
            setDrop3LowVoicings([])
            setDrop3HighVoicings([])

            setShellVoicings([])
            setFreddieGreenVoicings([])
            return
        }

        const notes = getNotesFromIntervals(parsed.root, parsed.intervals)
        const iMap = getIntervalMap(parsed.root, parsed.intervals)
        setIntervalMap(iMap)

        let d2Top: Voicing[] = []
        let d2Mid: Voicing[] = []
        let d2Bot: Voicing[] = []
        let d3Low: Voicing[] = []
        let d3High: Voicing[] = []
        let shell: Voicing[] = []
        let fg: Voicing[] = []

        if (notes.length === 4) {
            d2Top = generateVoicings(notes, 'Drop2', [2, 3, 4, 5])
            d2Mid = generateVoicings(notes, 'Drop2', [1, 2, 3, 4])
            d2Bot = generateVoicings(notes, 'Drop2', [0, 1, 2, 3])
            d3Low = generateVoicings(notes, 'Drop3', [0, 2, 3, 4])
            d3High = generateVoicings(notes, 'Drop3', [1, 3, 4, 5])

            // Shell & FG: Root, 3rd, 7th -> Indices 0, 1, 3
            const shellNotes = [notes[0], notes[1], notes[3]]
            shell = generateVoicings(shellNotes, 'Shell')
            fg = generateVoicings(shellNotes, 'FreddieGreen')

        } else if (parsed.quality === 'Altered Dominant') {
            // Generate multiple variations for "Alt" chords
            // Variations: 7b9b5, 7#9b5, 7b9#5, 7#9#5
            // All are rootless: 3, 7, alt5, alt9

            const variations = [
                { suffix: '(b9 b5)', intervals: ['1P', '3M', '5d', '7m', '9m'] },
                { suffix: '(#9 b5)', intervals: ['1P', '3M', '5d', '7m', '9A'] },
                { suffix: '(b9 #5)', intervals: ['1P', '3M', '5A', '7m', '9m'] },
                { suffix: '(#9 #5)', intervals: ['1P', '3M', '5A', '7m', '9A'] },
            ];

            // Update interval map to include all possible altered intervals for correct display
            // Collect all unique intervals from variations
            const allIntervals = Array.from(new Set(variations.flatMap(v => v.intervals)));
            const expandedMap = getIntervalMap(parsed.root, allIntervals);
            setIntervalMap(expandedMap);

            const genRootless = (v: { suffix: string, intervals: string[] }, type: 'Drop2' | 'Drop3', strings: number[]) => {
                const vNotes = getNotesFromIntervals(parsed.root, v.intervals);
                // Rootless: 3rd, 5th, 7th, 9th -> Indices 1, 2, 3, 4
                // Note: getNotesFromIntervals returns [Root, 3, 5, 7, 9]
                const rootlessNotes = [vNotes[1], vNotes[2], vNotes[3], vNotes[4]];

                return generateVoicings(rootlessNotes, type, strings).map(voicing => ({
                    ...voicing,
                    name: `${voicing.name} ${v.suffix}`
                }));
            };

            variations.forEach(v => {
                d2Top.push(...genRootless(v, 'Drop2', [2, 3, 4, 5]));
                d2Mid.push(...genRootless(v, 'Drop2', [1, 2, 3, 4]));
                d2Bot.push(...genRootless(v, 'Drop2', [0, 1, 2, 3]));
                d3Low.push(...genRootless(v, 'Drop3', [0, 2, 3, 4]));
                d3High.push(...genRootless(v, 'Drop3', [1, 3, 4, 5]));
                d3High.push(...genRootless(v, 'Drop3', [1, 3, 4, 5]));
            });

            // Shell & FG for Alt: Treat as Dominant 7 (1, 3, b7)
            const shellNotes = getNotesFromIntervals(parsed.root, ['1P', '3M', '7m'])
            shell = generateVoicings(shellNotes, 'Shell')
            fg = generateVoicings(shellNotes, 'FreddieGreen')


        } else if (notes.length === 5) {
            // 5-note chord (e.g. 9th chords): Root, 3rd, 5th, 7th, 9th
            // Generate two sets: Omit 5 and Omit Root

            // Omit 5: Root, 3rd, 7th, 9th (Indices 0, 1, 3, 4)
            const notesOmit5 = [notes[0], notes[1], notes[3], notes[4]]

            // Omit Root: 3rd, 5th, 7th, 9th (Indices 1, 2, 3, 4)
            const notesOmitRoot = [notes[1], notes[2], notes[3], notes[4]]

            const genAndLabel = (n: string[], labelSuffix: string, type: 'Drop2' | 'Drop3', strings: number[]) => {
                return generateVoicings(n, type, strings).map(v => ({
                    ...v,
                    name: `${v.name} ${labelSuffix}`
                }))
            }

            // Drop 2 Top
            d2Top = [
                ...genAndLabel(notesOmit5, '(Omit 5)', 'Drop2', [2, 3, 4, 5]),
                ...genAndLabel(notesOmitRoot, '(Omit Root)', 'Drop2', [2, 3, 4, 5])
            ]
            // Drop 2 Mid
            d2Mid = [
                ...genAndLabel(notesOmit5, '(Omit 5)', 'Drop2', [1, 2, 3, 4]),
                ...genAndLabel(notesOmitRoot, '(Omit Root)', 'Drop2', [1, 2, 3, 4])
            ]
            // Drop 2 Bot
            d2Bot = [
                ...genAndLabel(notesOmit5, '(Omit 5)', 'Drop2', [0, 1, 2, 3]),
                ...genAndLabel(notesOmitRoot, '(Omit Root)', 'Drop2', [0, 1, 2, 3])
            ]
            // Drop 3 Low
            d3Low = [
                ...genAndLabel(notesOmit5, '(Omit 5)', 'Drop3', [0, 2, 3, 4]),
                ...genAndLabel(notesOmitRoot, '(Omit Root)', 'Drop3', [0, 2, 3, 4])
            ]
            // Drop 3 High
            d3High = [
                ...genAndLabel(notesOmit5, '(Omit 5)', 'Drop3', [1, 3, 4, 5]),
                ...genAndLabel(notesOmitRoot, '(Omit Root)', 'Drop3', [1, 3, 4, 5])
            ]

            // Shell & FG: Root, 3rd, 7th -> Indices 0, 1, 3
            // Note: 5-note chords are R(0), 3(1), 5(2), 7(3), 9(4)
            const shellNotes = [notes[0], notes[1], notes[3]]
            shell = generateVoicings(shellNotes, 'Shell')
            fg = generateVoicings(shellNotes, 'FreddieGreen')


        } else {
            setError('This app only supports 6th, 7th, and extended chords.')
            setDrop2TopVoicings([])
            setDrop2MiddleVoicings([])
            setDrop2BottomVoicings([])
            setDrop3LowVoicings([])
            setDrop3LowVoicings([])
            setDrop3HighVoicings([])
            setShellVoicings([])
            setFreddieGreenVoicings([])
            return
        }

        setDrop2TopVoicings(d2Top)
        setDrop2MiddleVoicings(d2Mid)
        setDrop2BottomVoicings(d2Bot)
        setDrop3LowVoicings(d3Low)
        setDrop3HighVoicings(d3High)
        setShellVoicings(shell)
        setFreddieGreenVoicings(fg)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch()
        }
    }

    const handleChordClick = (voicing: Voicing) => {
        if (activeSlot !== null) {
            // Add to sequence
            const newSeq = [...sequence]
            // Create a new voicing object with the full name and interval map
            newSeq[activeSlot] = {
                ...voicing,
                name: `${input} - ${voicing.name}`,
                intervalMap: intervalMap
            }
            setSequence(newSeq)

            // Play preview
            playChord(voicing.positions)

            // Advance slot only if not paused (when paused, we want to replace the current beat repeatedly)
            if (!isPaused) {
                setActiveSlot((prev) => (prev !== null && prev < 159) ? prev + 1 : null)
            }
        } else {
            // Just play
            playChord(voicing.positions)
        }
    }

    const handleClearSlot = (index: number, e: React.MouseEvent) => {
        e.stopPropagation()
        const newSeq = [...sequence]
        newSeq[index] = null
        setSequence(newSeq)
    }

    const handlePaste = (start: number, end: number, target: number) => {
        const newSeq = [...sequence]
        const length = end - start + 1

        for (let i = 0; i < length; i++) {
            const sourceIdx = start + i
            const targetIdx = target + i

            if (targetIdx < newSeq.length) {
                // Deep copy if not null to avoid reference issues
                newSeq[targetIdx] = sequence[sourceIdx] ? JSON.parse(JSON.stringify(sequence[sourceIdx])) : null
            }
        }
        setSequence(newSeq)
    }

    const handleFilterChange = (filterId: string) => {
        if (filterId === 'all') {
            setActiveFilters(['all'])
            return
        }

        let newFilters = [...activeFilters]

        // If 'all' was selected, remove it
        if (newFilters.includes('all')) {
            newFilters = []
        }

        if (newFilters.includes(filterId)) {
            newFilters = newFilters.filter(f => f !== filterId)
        } else {
            newFilters.push(filterId)
        }

        // If no filters left, revert to 'all'
        if (newFilters.length === 0) {
            newFilters = ['all']
        }

        setActiveFilters(newFilters)
    }

    const shouldShowSection = (sectionId: string) => {
        return activeFilters.includes('all') || activeFilters.includes(sectionId)
    }

    const handleToggleRepeat = () => {
        const nextState = !isRepeatMode;
        setIsRepeatMode(nextState);
        // If turning OFF, clear the range
        if (!nextState) {
            setRepeatRange(null);
        }
    }

    return (
        <div className="app-container">
            <header>
                <h1>Jazz Guitar Chord Visualizer</h1>
                <div className="search-box">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onFocus={() => {
                            if (!hasInteracted) {
                                setInput('')
                                setHasInteracted(true)
                            }
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter chord (e.g. Cmin7(b5), Gmaj6)"
                        className="chord-input"
                    />
                    <button onClick={handleSearch} className="search-btn">
                        Visualize
                    </button>
                    <button
                        onClick={() => setDisplayMode(prev => prev === 'notes' ? 'intervals' : 'notes')}
                        className="mode-toggle-btn"
                        title={`Current view: ${displayMode}. Click to switch.`}
                    >
                        {displayMode === 'notes' ? 'Gb' : 'b5'}
                    </button>
                    <FilterDropdown selectedFilters={activeFilters} onFilterChange={handleFilterChange} />
                </div>
                {error && <p className="error-msg">{error}</p>}

                <details className="supported-chords-details" style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 500, color: 'var(--text-color)' }}>
                        Supported Chords & Formulas
                    </summary>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#aaa' }}>
                        <div>
                            <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Basic 7th Chords</h3>
                            <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
                                <li><span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>Major 7</span> (maj7, Maj7, M7): 1, 3, 5, 7</li>
                                <li><span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>Dominant 7</span> (7, dom7): 1, 3, 5, b7</li>
                                <li><span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>Minor 7</span> (m7, min7, -7): 1, b3, 5, b7</li>
                                <li><span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>Half Diminished</span> (m7b5, min7b5, -7b5, ø): 1, b3, b5, b7</li>
                                <li><span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>Diminished 7</span> (dim7, o7): 1, b3, b5, bb7</li>
                            </ul>
                        </div>
                        <div>
                            <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Extended & Altered</h3>
                            <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
                                <li><span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>Major 9</span> (maj9, Maj9, M9): 1, 3, 5, 7, 9</li>
                                <li><span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>Dominant 9</span> (9, dom9): 1, 3, 5, b7, 9</li>
                                <li><span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>Minor 9</span> (m9, min9, -9): 1, b3, 5, b7, 9</li>
                                <li><span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>Dominant 7(b9)</span> (7b9, dom7b9): 1, 3, 5, b7, b9</li>
                                <li><span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>Minor 7(b9)</span> (m7b9, min7b9, -7b9): 1, b3, 5, b7, b9</li>
                                <li><span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>Major 7 #4</span> (maj7#4, Maj7#4, M7#4): 1, 3, #4, 7</li>
                                <li><span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>6th Chords</span> (6, Maj6, M6 / m6, min6, -6): 1, 3/b3, 5, 6</li>
                                <li><span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>Minor Major 7</span> (mMaj7, minMaj7, -Maj7): 1, b3, 5, 7</li>
                                <li><span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>Augmented Major 7</span> (maj7#5, Maj7#5, M7#5): 1, 3, #5, 7</li>
                                <li><span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>Augmented Dominant 7</span> (7#5, dom7#5): 1, 3, #5, b7</li>
                                <li><span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>Dominant 7 #11</span> (7#11, dom7#11): 1, 3, 5, b7, #11</li>
                                <li><span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>Dominant 7 sus4</span> (7sus4): 1, 4, 5, b7</li>
                                <li><span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>Altered Dominant</span> (alt, 7alt): 1, 3, b7 + (b5/#5, b9/#9)</li>
                            </ul>
                        </div>
                    </div>
                </details>
            </header>

            <Sequencer
                sequence={sequence}
                activeSlot={activeSlot}
                currentBeat={currentBeat}
                isPlaying={isPlaying}
                isPaused={isPaused}
                bpm={bpm}
                onBpmChange={setBpm}
                onSlotClick={setActiveSlot}
                onClearSlot={handleClearSlot}
                onPlay={() => { setIsPlaying(true); setIsPaused(false); }}
                onStop={() => { setIsPlaying(false); setIsPaused(false); }}
                onPause={() => setIsPaused(true)}
                onResume={() => setIsPaused(false)}
                onClearAll={() => setSequence(Array(160).fill(null))}
                onLoad={(seq: any) => setSequence(seq)}
                onStepChange={stepTo}
                displayMode={displayMode}
                intervalMap={intervalMap}
                onPaste={handlePaste}
                isRepeatMode={isRepeatMode}
                repeatRange={repeatRange}
                onToggleRepeatMode={handleToggleRepeat}
                onSetRepeatRange={setRepeatRange}
            />

            <main>
                {drop2TopVoicings.length > 0 && shouldShowSection('drop2-top') && (
                    <section className="voicing-section">
                        <h2>Drop 2 Voicings - Top Strings (4,3,2,1)</h2>
                        <div className="diagram-grid">
                            {drop2TopVoicings.map((v, i) => (
                                <ChordDiagram
                                    key={`d2t-${i}`}
                                    voicing={v}
                                    displayMode={displayMode}
                                    intervalMap={intervalMap}
                                    onClick={() => handleChordClick(v)}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {drop2MiddleVoicings.length > 0 && shouldShowSection('drop2-mid') && (
                    <section className="voicing-section">
                        <h2>Drop 2 Voicings - Middle Strings (5,4,3,2)</h2>
                        <div className="diagram-grid">
                            {drop2MiddleVoicings.map((v, i) => (
                                <ChordDiagram
                                    key={`d2m-${i}`}
                                    voicing={v}
                                    displayMode={displayMode}
                                    intervalMap={intervalMap}
                                    onClick={() => handleChordClick(v)}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {drop2BottomVoicings.length > 0 && shouldShowSection('drop2-bot') && (
                    <section className="voicing-section">
                        <h2>Drop 2 Voicings - Low Strings (6,5,4,3)</h2>
                        <div className="diagram-grid">
                            {drop2BottomVoicings.map((v, i) => (
                                <ChordDiagram
                                    key={`d2b-${i}`}
                                    voicing={v}
                                    displayMode={displayMode}
                                    intervalMap={intervalMap}
                                    onClick={() => handleChordClick(v)}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {drop3LowVoicings.length > 0 && shouldShowSection('drop3-bot') && (
                    <section className="voicing-section">
                        <h2>Drop 3 Voicings - Low Strings (6,4,3,2)</h2>
                        <div className="diagram-grid">
                            {drop3LowVoicings.map((v, i) => (
                                <ChordDiagram
                                    key={`d3l-${i}`}
                                    voicing={v}
                                    displayMode={displayMode}
                                    intervalMap={intervalMap}
                                    onClick={() => handleChordClick(v)}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {drop3HighVoicings.length > 0 && shouldShowSection('drop3-top') && (
                    <section className="voicing-section">
                        <h2>Drop 3 Voicings - High Strings (5,3,2,1)</h2>
                        <div className="diagram-grid">
                            {drop3HighVoicings.map((v, i) => (
                                <ChordDiagram
                                    key={`d3h-${i}`}
                                    voicing={v}
                                    displayMode={displayMode}
                                    intervalMap={intervalMap}
                                    onClick={() => handleChordClick(v)}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {shellVoicings.length > 0 && shouldShowSection('shell') && (
                    <section className="voicing-section">
                        <h2>Shell Voicings (3-Note)</h2>
                        <div className="diagram-grid">
                            {shellVoicings.map((v, i) => (
                                <ChordDiagram
                                    key={`shell-${i}`}
                                    voicing={v}
                                    displayMode={displayMode}
                                    intervalMap={intervalMap}
                                    onClick={() => handleChordClick(v)}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {freddieGreenVoicings.length > 0 && shouldShowSection('freddie-green') && (
                    <section className="voicing-section">
                        <h2>Freddie Green Style Voicings</h2>
                        <div className="diagram-grid">
                            {freddieGreenVoicings.map((v, i) => (
                                <ChordDiagram
                                    key={`fg-${i}`}
                                    voicing={v}
                                    displayMode={displayMode}
                                    intervalMap={intervalMap}
                                    onClick={() => handleChordClick(v)}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {drop2TopVoicings.length === 0 && drop2MiddleVoicings.length === 0 && drop2BottomVoicings.length === 0 && drop3LowVoicings.length === 0 && drop3HighVoicings.length === 0 && shellVoicings.length === 0 && freddieGreenVoicings.length === 0 && !error && (
                    <p style={{ color: '#6b7280', marginTop: '2rem' }}>No voicings found within playable range (no open strings, span &le; 4).</p>
                )}
            </main>
        </div>
    )
}

export default App
