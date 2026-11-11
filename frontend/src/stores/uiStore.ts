import { create } from 'zustand';

export interface Crumb {
  label: string;
  to?: string;
}

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  breadcrumb: Crumb[];
  setBreadcrumb: (c: Crumb[]) => void;
}

function readCollapsed() {
  try {
    return localStorage.getItem('sidebarCollapsed') === '1';
  } catch {
    return false;
  }
}

export const useUiStore = create<UiState>((set, get) => ({
  sidebarCollapsed: readCollapsed(),
  toggleSidebar: () => {
    const v = !get().sidebarCollapsed;
    try {
      localStorage.setItem('sidebarCollapsed', v ? '1' : '0');
    } catch {
      /* ignore */
    }
    set({ sidebarCollapsed: v });
  },
  breadcrumb: [],
  setBreadcrumb: (breadcrumb) => set({ breadcrumb }),
}));
