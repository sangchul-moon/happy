/**
 * Split View State Management
 *
 * Manages multiple session panels displayed side by side.
 * Uses Zustand for state management with persistence.
 */

import { create } from 'zustand';
import { Platform } from 'react-native';
import { loadSplitViewPanels, saveSplitViewPanels } from '@/sync/persistence';

interface SplitViewState {
    // Array of session IDs currently displayed in split view
    panels: string[];

    // Maximum number of panels allowed
    maxPanels: number;

    // Add a session to split view
    addPanel: (sessionId: string) => void;

    // Set a single session as the only panel (replaces all)
    setPanel: (sessionId: string) => void;

    // Remove a session from split view
    removePanel: (sessionId: string) => void;

    // Close all panels
    closeAllPanels: () => void;

    // Check if a session is in split view
    hasPanel: (sessionId: string) => boolean;

    // Set max panels (useful for responsive design)
    setMaxPanels: (max: number) => void;
}

export const useSplitViewStore = create<SplitViewState>((set, get) => ({
    panels: [],
    maxPanels: 4,

    addPanel: (sessionId: string) => {
        const { panels, maxPanels } = get();

        // Don't add if already exists
        if (panels.includes(sessionId)) {
            return;
        }

        // Don't exceed max panels
        if (panels.length >= maxPanels) {
            // Replace the last panel
            const updated = [...panels.slice(0, -1), sessionId];
            set({ panels: updated });
            saveSplitViewPanels(updated);
            return;
        }

        const updated = [...panels, sessionId];
        set({ panels: updated });
        saveSplitViewPanels(updated);
    },

    setPanel: (sessionId: string) => {
        const { panels } = get();
        if (panels.length === 1 && panels[0] === sessionId) {
            return;
        }
        const updated = [sessionId];
        set({ panels: updated });
        saveSplitViewPanels(updated);
    },

    removePanel: (sessionId: string) => {
        const { panels } = get();
        const updated = panels.filter(id => id !== sessionId);
        set({ panels: updated });
        saveSplitViewPanels(updated);
    },

    closeAllPanels: () => {
        set({ panels: [] });
        saveSplitViewPanels([]);
    },

    hasPanel: (sessionId: string) => {
        return get().panels.includes(sessionId);
    },

    setMaxPanels: (max: number) => {
        const { panels } = get();
        // Trim panels if exceeding new max
        if (panels.length > max) {
            const updated = panels.slice(0, max);
            set({ panels: updated, maxPanels: max });
            saveSplitViewPanels(updated);
        } else {
            set({ maxPanels: max });
        }
    },
}));

// Hook for checking if split view is active
export function useSplitViewActive() {
    return useSplitViewStore(state => state.panels.length > 0);
}

// Hook for getting panel count
export function useSplitViewPanelCount() {
    return useSplitViewStore(state => state.panels.length);
}

// Hook for getting all panels
export function useSplitViewPanels() {
    return useSplitViewStore(state => state.panels);
}

// Hook for split view actions
export function useSplitViewActions() {
    return useSplitViewStore(state => ({
        addPanel: state.addPanel,
        removePanel: state.removePanel,
        closeAllPanels: state.closeAllPanels,
        hasPanel: state.hasPanel,
    }));
}

// Hydrate panels from persistent storage (call after DOM/localStorage is ready)
export function hydrateSplitViewPanels() {
    try {
        const panels = loadSplitViewPanels();
        if (panels.length > 0) {
            useSplitViewStore.setState({ panels });
        }
    } catch (e) {
        console.error('Failed to hydrate split view panels', e);
    }
}

// Check if split view is supported (only on web/desktop)
export function isSplitViewSupported() {
    return Platform.OS === 'web';
}
