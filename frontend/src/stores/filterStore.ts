import { create } from 'zustand';

/** Bộ lọc dùng chung giữa các màn (năm/kỳ đang chọn) */
interface FilterState {
  year: number;
  period: string;
  setYear: (y: number) => void;
  setPeriod: (p: string) => void;
  /** Lưu filter theo từng màn để quay lại giữ nguyên */
  screens: Record<string, Record<string, unknown>>;
  setScreen: (key: string, v: Record<string, unknown>) => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  year: new Date().getFullYear(),
  period: 'Y',
  setYear: (year) => set({ year }),
  setPeriod: (period) => set({ period }),
  screens: {},
  setScreen: (key, v) => set((s) => ({ screens: { ...s.screens, [key]: v } })),
}));
