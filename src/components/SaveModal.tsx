import React, { useState, useEffect, useRef } from 'react';
import { X, Save } from 'lucide-react';

interface SaveModalProps {
    isOpen: boolean;
    onClose: () => void;
    downloadUrl: string | null;
    defaultFilename?: string;
}

const SaveModal: React.FC<SaveModalProps> = ({
    isOpen,
    onClose,
    downloadUrl,
    defaultFilename = 'sequence'
}) => {
    const [filename, setFilename] = useState(defaultFilename);
    const inputRef = useRef<HTMLInputElement>(null);
    const saveLinkRef = useRef<HTMLAnchorElement>(null);

    // Reset filename when modal opens
    useEffect(() => {
        if (isOpen) {
            setFilename(defaultFilename);
            // Focus input on open
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 100);
        }
    }, [isOpen, defaultFilename]);

    // Handle Enter key to trigger the save link click
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            saveLinkRef.current?.click();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    if (!isOpen) return null;

    const finalFilename = filename.endsWith('.json') ? filename : filename + '.json';

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
        }}>
            <div style={{
                backgroundColor: 'var(--surface-color)',
                padding: '2rem',
                borderRadius: '12px',
                border: '1px solid #333',
                width: '100%',
                maxWidth: '400px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                animation: 'fadeInUp 0.2s ease-out'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0, color: 'var(--text-color)', fontSize: '1.5rem' }}>Save Sequence</h3>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}
                    >
                        <X size={24} />
                    </button>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#aaa', fontSize: '0.9rem' }}>
                        Filename
                    </label>
                    <input
                        ref={inputRef}
                        type="text"
                        value={filename}
                        onChange={(e) => setFilename(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter filename"
                        className="chord-input"
                        style={{ width: '100%', boxSizing: 'border-box', fontSize: '1rem', padding: '0.6rem' }}
                    />
                    <div style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.8rem', textAlign: 'right' }}>
                        .json will be added automatically
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button
                        onClick={onClose}
                        className="control-btn"
                        style={{ backgroundColor: '#333', color: '#e0e0e0' }}
                    >
                        Cancel
                    </button>
                    <a
                        ref={saveLinkRef}
                        href={downloadUrl || undefined}
                        download={finalFilename}
                        className="control-btn"
                        style={{
                            backgroundColor: 'var(--primary-color)',
                            color: 'black',
                            fontWeight: 'bold',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: downloadUrl ? 'pointer' : 'not-allowed',
                            opacity: downloadUrl ? 1 : 0.5
                        }}
                    >
                        <Save size={18} />
                        Save
                    </a>
                </div>
            </div>
        </div>
    );
};

export default SaveModal;
