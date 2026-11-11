import ReactECharts from 'echarts-for-react';
import type { ECharts } from 'echarts';
import { useEffect, useMemo, useRef } from 'react';
import { fmtNum, fmtPct } from '@/lib/format';
import { toNum, type Num } from '../types';

const PRIMARY = '#0b5cab';
const AXIS = '#94a3b8';
const GRID_LINE = '#eef2f7';
const INK = '#334155';
const SVG = { renderer: 'svg' as const };

/** Thẻ “Điểm BSC tổng hợp”: gauge ECharts thang 5 */
export function BscGauge({ score }: { score: Num }) {
  const v = toNum(score);
  const option = useMemo(
    () => ({
      series: [
        {
          type: 'gauge',
          min: 0,
          max: 5,
          splitNumber: 5,
          radius: '100%',
          center: ['50%', '62%'],
          startAngle: 200,
          endAngle: -20,
          progress: { show: true, width: 14, roundCap: true, itemStyle: { color: PRIMARY } },
          axisLine: { lineStyle: { width: 14, color: [[1, '#e2e8f0']] }, roundCap: true },
          pointer: { show: false },
          axisTick: { show: false },
          splitLine: { length: 6, distance: -14, lineStyle: { color: '#fff', width: 2 } },
          axisLabel: { distance: 18, color: AXIS, fontSize: 11 },
          anchor: { show: false },
          title: { show: false },
          detail: {
            valueAnimation: false,
            offsetCenter: [0, '-5%'],
            fontSize: 26,
            fontWeight: 600,
            color: INK,
            formatter: () => (v === null ? '—' : fmtNum(v, 2)),
          },
          data: [{ value: v ?? 0 }],
        },
      ],
    }),
    [v],
  );
  return <ReactECharts option={option} opts={SVG} style={{ height: 170 }} notMerge />;
}

interface BarItem {
  key: string | number;
  label: string;
  value: Num;
  extra?: string;
}

/** Bar chart ngang (điểm BSC thang 5) — bấm cột → onPick */
export function HBarChart({ items, onPick, height, ariaLabel }: { items: BarItem[]; onPick?: (key: string | number) => void; height?: number; ariaLabel: string }) {
  const rev = useMemo(() => [...items].reverse(), [items]);
  const option = useMemo(
    () => ({
      grid: { left: 8, right: 40, top: 8, bottom: 24, containLabel: true },
      tooltip: {
        trigger: 'item',
        formatter: (p: { dataIndex: number }) => {
          const it = rev[p.dataIndex];
          return `${it.label}<br/>Điểm BSC: <b>${fmtNum(it.value, 2) || '—'}</b>${it.extra ? `<br/>${it.extra}` : ''}`;
        },
      },
      xAxis: { type: 'value', min: 0, max: 5, splitLine: { lineStyle: { color: GRID_LINE } }, axisLabel: { color: AXIS } },
      yAxis: {
        type: 'category',
        data: rev.map((i) => i.label),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: AXIS } },
        axisLabel: { color: INK, width: 210, overflow: 'truncate', fontSize: 11 },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 16,
          itemStyle: { color: PRIMARY, borderRadius: [0, 4, 4, 0] },
          cursor: onPick ? 'pointer' : 'default',
          label: { show: true, position: 'right', color: INK, fontSize: 11, formatter: (p: { value: number | null }) => (p.value === null ? '' : fmtNum(p.value, 2)) },
          data: rev.map((i) => toNum(i.value)),
        },
      ],
    }),
    [rev, onPick],
  );
  const events = useMemo(() => (onPick ? { click: (p: { dataIndex: number }) => onPick(rev[p.dataIndex].key) } : undefined), [onPick, rev]);
  return (
    <div role="img" aria-label={ariaLabel}>
      <ReactECharts option={option} opts={SVG} style={{ height: height ?? Math.max(160, rev.length * 30 + 40) }} onEvents={events} notMerge />
    </div>
  );
}

/** Bar chart dọc (điểm BSC theo tỉnh/năm). onPickIndex: bấm vào vùng cột (kể cả năm chưa có số liệu) */
export function VBarChart({
  items,
  onPick,
  height = 260,
  ariaLabel,
  rotate = 0,
  testId,
}: {
  items: BarItem[];
  onPick?: (key: string | number) => void;
  height?: number;
  ariaLabel: string;
  rotate?: number;
  testId?: string;
}) {
  const option = useMemo(
    () => ({
      grid: { left: 36, right: 16, top: 24, bottom: rotate ? 70 : 28 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (ps: { dataIndex: number }[]) => {
          const it = items[ps[0].dataIndex];
          return `${it.label}<br/>Điểm BSC: <b>${fmtNum(it.value, 2) || '—'}</b>${it.extra ? `<br/>${it.extra}` : ''}`;
        },
      },
      xAxis: {
        type: 'category',
        data: items.map((i) => i.label),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: AXIS } },
        axisLabel: { color: INK, fontSize: 11, rotate, interval: 0 },
        triggerEvent: true,
      },
      yAxis: { type: 'value', min: 0, max: 5, splitLine: { lineStyle: { color: GRID_LINE } }, axisLabel: { color: AXIS } },
      series: [
        {
          type: 'bar',
          barMaxWidth: 36,
          itemStyle: { color: PRIMARY, borderRadius: [4, 4, 0, 0] },
          cursor: onPick ? 'pointer' : 'default',
          label: { show: items.length <= 12, position: 'top', color: INK, fontSize: 11, formatter: (p: { value: number | null }) => (p.value === null ? '' : fmtNum(p.value, 2)) },
          data: items.map((i) => toNum(i.value)),
        },
      ],
    }),
    [items, onPick, rotate],
  );
  /** Bấm bất kỳ đâu trong cột của một hạng mục (onClick ECharts qua zrender + convertFromPixel) */
  const latest = useRef({ items, onPick });
  useEffect(() => {
    latest.current = { items, onPick };
  }, [items, onPick]);
  const onReady = (chart: ECharts) => {
    chart.getZr().on('click', (e: { offsetX: number; offsetY: number }) => {
      const { items: its, onPick: pick } = latest.current;
      const pt = [e.offsetX, e.offsetY];
      if (!pick || !chart.containPixel('grid', pt)) return;
      const idx = chart.convertFromPixel({ xAxisIndex: 0 }, pt) as unknown as number | number[];
      const i = Array.isArray(idx) ? idx[0] : idx;
      if (typeof i === 'number' && its[i]) pick(its[i].key);
    });
  };
  return (
    <div role="img" aria-label={ariaLabel} data-testid={testId}>
      <ReactECharts option={option} opts={SVG} style={{ height }} onChartReady={onReady} notMerge />
    </div>
  );
}

/** Line chart điểm BSC theo kỳ (14.1) */
export function BscLineChart({ items, ariaLabel }: { items: { label: string; value: Num; rate?: Num }[]; ariaLabel: string }) {
  const option = useMemo(
    () => ({
      grid: { left: 36, right: 20, top: 24, bottom: 48 },
      tooltip: {
        trigger: 'axis',
        formatter: (ps: { dataIndex: number }[]) => {
          const it = items[ps[0].dataIndex];
          return `${it.label}<br/>Điểm BSC: <b>${fmtNum(it.value, 2) || '—'}</b><br/>% TH/KH: ${fmtPct(it.rate) || '—'}`;
        },
      },
      xAxis: { type: 'category', data: items.map((i) => i.label), axisTick: { show: false }, axisLine: { lineStyle: { color: AXIS } }, axisLabel: { color: INK, fontSize: 11, rotate: 30, interval: 0 } },
      yAxis: { type: 'value', min: 0, max: 5, splitLine: { lineStyle: { color: GRID_LINE } }, axisLabel: { color: AXIS } },
      series: [
        {
          type: 'line',
          symbolSize: 8,
          lineStyle: { width: 2, color: PRIMARY },
          itemStyle: { color: PRIMARY, borderColor: '#fff', borderWidth: 2 },
          label: { show: true, position: 'top', color: INK, fontSize: 11, formatter: (p: { value: number | null }) => (p.value === null ? '' : fmtNum(p.value, 2)) },
          data: items.map((i) => toNum(i.value)),
        },
      ],
    }),
    [items],
  );
  return (
    <div role="img" aria-label={ariaLabel}>
      <ReactECharts option={option} opts={SVG} style={{ height: 260 }} notMerge />
    </div>
  );
}
