import { describe, expect, it } from 'vitest';
import { COL_W, LANE_H, LANE_LABEL_W, NODE_H, X0, Y_PAD, type Lane, type MapLink, type MapNode } from '../types';
import { autoLayout, clampToLane, edgeKey, laneIndex, nextSlot } from './StrategyMap';

const lanes: Lane[] = [
  { id: 1, code: 'TC', name: 'Tài chính', color: '#1D4ED8', sortOrder: 1 },
  { id: 2, code: 'KH', name: 'Khách hàng', color: '#059669', sortOrder: 2 },
  { id: 3, code: 'QT', name: 'Quy trình nội bộ', color: '#D97706', sortOrder: 3 },
];

const node = (id: number, perspectiveId: number, posX = 0, posY = 0): MapNode => ({
  objectiveId: id,
  code: `MT-${id}`,
  name: `Mục tiêu ${id}`,
  perspectiveId,
  perspectiveCode: '',
  perspectiveName: '',
  perspectiveColor: '#000',
  perspectiveSort: perspectiveId,
  posX,
  posY,
  kpis: [],
});

describe('bản đồ chiến lược – hình học', () => {
  it('laneIndex theo thứ tự viễn cảnh, không tìm thấy → 0', () => {
    expect(laneIndex(lanes, 3)).toBe(2);
    expect(laneIndex(lanes, 99)).toBe(0);
  });

  it('clampToLane giữ node trong dải viễn cảnh và bên phải nhãn dải', () => {
    const n = node(1, 2);
    const p = clampToLane(lanes, n, 10, 5000);
    expect(p.x).toBe(LANE_LABEL_W + 10);
    expect(p.y).toBe(LANE_H + LANE_H - NODE_H + 10);
    expect(clampToLane(lanes, n, 400, 0).y).toBe(LANE_H + 8);
  });

  it('nextSlot đặt mục tiêu mới vào cột trống tiếp theo của đúng dải (37.1)', () => {
    expect(nextSlot(lanes, [], 3)).toEqual({ x: X0, y: 2 * LANE_H + Y_PAD });
    const ns = [node(1, 1, X0, Y_PAD), node(2, 1, X0 + COL_W, Y_PAD)];
    expect(nextSlot(lanes, ns, 1)).toEqual({ x: X0 + 2 * COL_W, y: Y_PAD });
    expect(nextSlot(lanes, ns, 2)).toEqual({ x: X0, y: LANE_H + Y_PAD });
  });

  it('edgeKey nhận diện liên kết theo nguồn → đích', () => {
    const e: MapLink = { source: 4, target: 7 };
    expect(edgeKey(e)).toBe('4-7');
  });
});

describe('Tự động sắp xếp (Dagre trong từng dải)', () => {
  it('mỗi node nằm đúng dải, xếp hàng cách đều, giữ đủ node', () => {
    const ns = [node(1, 1, 999, 999), node(2, 2, 5, 5), node(3, 2, 7, 7), node(4, 3, 1, 1)];
    const es: MapLink[] = [
      { source: 4, target: 3 },
      { source: 3, target: 1 },
      { source: 2, target: 1 },
    ];
    const out = autoLayout(lanes, ns, es);
    expect(out).toHaveLength(4);
    for (const n of out) expect(n.posY).toBe(laneIndex(lanes, n.perspectiveId) * LANE_H + Y_PAD);
    const kh = out.filter((n) => n.perspectiveId === 2).map((n) => n.posX).sort((a, b) => a - b);
    expect(kh).toEqual([X0, X0 + COL_W]);
    expect(out.find((n) => n.objectiveId === 1)!.posX).toBe(X0);
  });

  it('node thuộc viễn cảnh không còn hiệu lực vẫn được giữ lại', () => {
    const out = autoLayout(lanes, [node(9, 42, 10, 10)], []);
    expect(out).toHaveLength(1);
    expect(out[0].objectiveId).toBe(9);
  });
});
