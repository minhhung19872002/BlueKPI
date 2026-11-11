import { describe, expect, it } from 'vitest';
import { fileNameFrom } from '@/api/http';
import { fmtDate, fmtNum, parseNum, parseViDate } from './format';

describe('format', () => {
  it('ngày dd/mm/yyyy', () => {
    expect(fmtDate('2014-05-15')).toBe('15/05/2014');
    expect(parseViDate('15/05/2014')).toBe('2014-05-15');
    expect(parseViDate('31/02/2014')).toBeNull();
  });
  it('số kiểu Việt Nam', () => {
    expect(fmtNum(1234567.891, 2)).toBe('1.234.567,89');
    expect(parseNum('1.234.567,89')).toBe(1234567.89);
    expect(parseNum('1234.5')).toBe(1234.5);
    expect(parseNum('abc')).toBeNull();
  });
  it('đọc tên file từ Content-Disposition', () => {
    expect(fileNameFrom("attachment; filename*=UTF-8''Danh%20s%C3%A1ch.xlsx")).toBe('Danh sách.xlsx');
    expect(fileNameFrom('attachment; filename="a.xlsx"')).toBe('a.xlsx');
  });
});
