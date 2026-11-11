import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';

dayjs.extend(customParseFormat);
dayjs.extend(relativeTime);
dayjs.locale('vi');

/** Ngày dd/mm/yyyy (CLAUDE.md §4.6) */
export function fmtDate(v?: string | Date | null): string {
  if (!v) return '';
  const d = dayjs(v);
  return d.isValid() ? d.format('DD/MM/YYYY') : '';
}

/** Ngày giờ dd/mm/yyyy HH:mm */
export function fmtDateTime(v?: string | Date | null): string {
  if (!v) return '';
  const d = dayjs(v);
  return d.isValid() ? d.format('DD/MM/YYYY HH:mm') : '';
}

export function fmtRelative(v?: string | null): string {
  if (!v) return '';
  return dayjs(v).fromNow();
}

/** dd/mm/yyyy → yyyy-mm-dd (gửi API) */
export function parseViDate(s: string): string | null {
  const d = dayjs(s, ['DD/MM/YYYY', 'D/M/YYYY'], true);
  return d.isValid() ? d.format('YYYY-MM-DD') : null;
}

const nf2 = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const nfAuto = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

/** Số kiểu Việt Nam 1.234.567,89 — hiển thị 2 chữ số thập phân */
export function fmtNum(v?: number | string | null, digits: 0 | 2 | 'auto' = 'auto'): string {
  if (v === null || v === undefined || v === '') return '';
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return '';
  return digits === 2 ? nf2.format(n) : digits === 0 ? nf0.format(n) : nfAuto.format(n);
}

export function fmtPct(v?: number | string | null): string {
  const s = fmtNum(v, 2);
  return s ? `${s}%` : '';
}

/** Parse số người dùng nhập (chấp nhận 1.234,5 hoặc 1234.5) */
export function parseNum(s: string | null | undefined): number | null {
  if (s === null || s === undefined) return null;
  let t = String(s).trim().replace(/\s/g, '');
  if (!t) return null;
  if (t.includes(',') && t.includes('.')) {
    t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (t.includes(',')) {
    t = t.replace(',', '.');
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
