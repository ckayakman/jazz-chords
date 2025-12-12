import React, { useState, useRef, useEffect } from 'react';

interface FilterDropdownProps {
    selectedFilters: string[];
    onFilterChange: (filter: string) => void;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({ selectedFilters, onFilterChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const options = [
        { id: 'all', label: 'All' },
        { id: 'drop2-top', label: 'Drop 2 Top' },
        { id: 'drop2-mid', label: 'Drop 2 Middle' },
        { id: 'drop2-bot', label: 'Drop 2 Bottom' },
        { id: 'drop2-4-low', label: 'Drop 2 & 4 Low' },
        { id: 'drop2-4-high', label: 'Drop 2 & 4 High' },
        { id: 'drop3-top', label: 'Drop 3 Top' },
        { id: 'drop3-bot', label: 'Drop 3 Bottom' },
        { id: 'shell', label: 'Shell' },
        { id: 'freddie-green', label: 'Freddie Green' },
    ];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div className="filter-container" ref={dropdownRef}>
            <button
                className="filter-btn"
                onClick={() => setIsOpen(!isOpen)}
            >
                Filter
            </button>
            {isOpen && (
                <div className="filter-dropdown">
                    {options.map((option) => (
                        <div
                            key={option.id}
                            className={`filter-option ${selectedFilters.includes(option.id) ? 'selected' : ''}`}
                            onClick={() => onFilterChange(option.id)}
                        >
                            <span className="checkbox">
                                {selectedFilters.includes(option.id) && '✓'}
                            </span>
                            {option.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FilterDropdown;
