import React, { useState } from 'react';
import { X, Music, Check } from 'lucide-react';
import { AVAILABLE_KEYS, PROGRESSION_LABELS, ProgressionType } from '../logic/progression-generator';
import { VoicingType } from '../logic/voicing-generator';

interface ProgressionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoad: (progType: ProgressionType, key: string, voicingType: VoicingType, stringSet: number[]) => void;
}

const ProgressionModal: React.FC<ProgressionModalProps> = ({ isOpen, onClose, onLoad }) => {
    const [selectedProg, setSelectedProg] = useState<ProgressionType>('MajorII_V_I');
    const [selectedKey, setSelectedKey] = useState<string>('C');
    const [selectedVoicingType, setSelectedVoicingType] = useState<VoicingType>('Drop2');
    const [selectedStringSet, setSelectedStringSet] = useState<string>('Top'); // 'Top', 'Middle', 'Bottom', 'Low', 'High'

    if (!isOpen) return null;

    // Helper to map UI string set selection to actual number arrays
    const getStringSet = (vType: VoicingType, set: string): number[] => {
        if (vType === 'Drop2') {
            if (set === 'Top') return [2, 3, 4, 5];
            if (set === 'Middle') return [1, 2, 3, 4];
            if (set === 'Bottom') return [0, 1, 2, 3];
        } else if (vType === 'Drop3') {
            if (set === 'Top') return [1, 3, 4, 5]; // "Top" for drop 3 usually means root on A string
            if (set === 'Bottom') return [0, 2, 3, 4];
        } else if (vType === 'Drop2_4') {
            if (set === 'Low') return [0, 1, 2, 4];
            if (set === 'High') return [1, 2, 3, 5];
        } else {
            // Shell / Freddie Green
            // Usually determined by generator, but let's give hints?
            // The generator logic for Shell/FG iterates multiple sets.
            // We can pass specific ones if we want, or just let it auto-generate.
            // Our generator currently generates *all* and we pick best.
            // But if we want to force "Root on 6th string", we need to support that.
            // For now, let's pass a dummy set or handle in generator. 
            // Actually, the generator expects a specific set for Drop voicings.
            // For Shell, it generates all sets.
            // Let's optimize: Pass empty for Shell/FG and let generator handle, 
            // OR let user pick "E String Root" vs "A String Root".
            // Let's keep it simple: "Auto" for Shell/FG in the UI.
            return [];
        }
        return [2, 3, 4, 5]; // Fallback
    };

    const handleLoad = () => {
        const strings = getStringSet(selectedVoicingType, selectedStringSet);
        onLoad(selectedProg, selectedKey, selectedVoicingType, strings);
        onClose();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '500px' }}>
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <h2><Music size={24} style={{ display: 'inline', marginRight: '8px' }} /> Library</h2>
                </div>

                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Progression Type */}
                    <div className="form-group">
                        <label className="input-label">Progression</label>
                        <select
                            className="chord-input"
                            style={{ width: '100%' }}
                            value={selectedProg}
                            onChange={(e) => setSelectedProg(e.target.value as ProgressionType)}
                        >
                            {Object.entries(PROGRESSION_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Key */}
                    <div className="form-group">
                        <label className="input-label">Key</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem' }}>
                            {AVAILABLE_KEYS.map(k => (
                                <button
                                    key={k}
                                    onClick={() => setSelectedKey(k)}
                                    style={{
                                        padding: '0.5rem',
                                        borderRadius: '0.25rem',
                                        backgroundColor: selectedKey === k ? 'var(--primary-color)' : 'var(--bg-color)',
                                        color: selectedKey === k ? '#fff' : 'var(--text-color)',
                                        border: '1px solid var(--border-color)',
                                        cursor: 'pointer',
                                        fontWeight: 600
                                    }}
                                >
                                    {k}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ height: '1px', background: 'var(--border-color)' }}></div>

                    {/* Voicing Settings */}
                    <div>
                        <h4 style={{ marginBottom: '1rem', color: 'var(--text-color)' }}>Voicing Settings</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="input-label">Type</label>
                                <select
                                    className="chord-input"
                                    style={{ width: '100%' }}
                                    value={selectedVoicingType}
                                    onChange={(e) => setSelectedVoicingType(e.target.value as VoicingType)}
                                >
                                    <option value="Drop2">Drop 2</option>
                                    <option value="Drop3">Drop 3</option>
                                    <option value="Drop2_4">Drop 2 & 4</option>
                                    <option value="Shell">Shell (3-Note)</option>
                                    <option value="FreddieGreen">Freddie Green</option>
                                </select>
                            </div>

                            {/* String Set - Context Dependent */}
                            {['Drop2', 'Drop3', 'Drop2_4'].includes(selectedVoicingType) && (
                                <div className="form-group">
                                    <label className="input-label">String Set</label>
                                    <select
                                        className="chord-input"
                                        style={{ width: '100%' }}
                                        value={selectedStringSet}
                                        onChange={(e) => setSelectedStringSet(e.target.value)}
                                    >
                                        {selectedVoicingType === 'Drop2' && (
                                            <>
                                                <option value="Top">Top (1-4)</option>
                                                <option value="Middle">Middle (2-5)</option>
                                                <option value="Bottom">Bottom (3-6)</option>
                                            </>
                                        )}
                                        {selectedVoicingType === 'Drop3' && (
                                            <>
                                                <option value="Top">Top (Strings 5,3,2,1)</option>
                                                <option value="Bottom">Bottom (Strings 6,4,3,2)</option>
                                            </>
                                        )}
                                        {selectedVoicingType === 'Drop2_4' && (
                                            <>
                                                <option value="High">High (Strings 5,4,3,1)</option>
                                                <option value="Low">Low (Strings 6,5,4,2)</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                            )}
                        </div>
                        <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.5rem' }}>
                            * Smart Voice Leading will automatically choose the smoothest path between chords.
                        </p>
                    </div>

                </div>

                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '0.5rem',
                            border: '1px solid var(--primary-color)',
                            backgroundColor: 'transparent',
                            color: 'var(--primary-color)',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleLoad}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '0.5rem',
                            border: 'none',
                            backgroundColor: 'var(--primary-color)',
                            color: 'black',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <Check size={18} /> Load Progression
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProgressionModal;
