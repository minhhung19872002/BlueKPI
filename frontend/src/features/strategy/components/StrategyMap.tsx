import dagre from '@dagrejs/dagre';
import {
  Background,
  ConnectionMode,
  getNodesBounds,
  getViewportForBounds,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import { ChevronDown, Trash2 } from 'lucide-react';
import { memo, useMemo } from 'react';
import { COL_W, LANE_H, LANE_LABEL_W, NODE_H, NODE_W, X0, Y_PAD, type Lane, type MapKpi, type MapLink, type MapNode } from '../types';

export const edgeKey = (e: MapLink) => `${e.source}-${e.target}`;

interface ObjData extends Record<string, unknown> {
  node: MapNode;
  drawMode: boolean;
  editable: boolean;
  onRemove?: (id: number) => void;
  onExpand?: (n: MapNode) => void;
  /** Màu chip KPI (vd theo rating trên Dashboard) */
  kpiColor?: (objectiveId: number, k: MapKpi) => string | undefined;
}

interface LaneData extends Record<string, unknown> {
  lane: Lane;
  width: number;
}

const HANDLES: [string, Position][] = [
  ['top', Position.Top],
  ['bottom', Position.Bottom],
  ['left', Position.Left],
  ['right', Position.Right],
];

/** Node mục tiêu: viền màu viễn cảnh, “Mã – Tên”, số KPI + chip (tối đa 3), mở rộng (37.4), “Xóa” (37.3), handle khi vẽ liên kết */
const ObjectiveNode = memo(function ObjectiveNode({ data }: NodeProps<Node<ObjData>>) {
  const { node, drawMode, editable, onRemove, onExpand, kpiColor } = data;
  const chips = node.kpis.slice(0, 3);
  return (
    <div
      data-testid="objective-node"
      data-code={node.code}
      className="rounded-md border-2 bg-white text-[12px] shadow-sm"
      style={{ width: NODE_W, minHeight: NODE_H - 20, borderColor: node.perspectiveColor || '#64748b' }}
    >
      {HANDLES.map(([id, pos]) => (
        <Handle
          key={id}
          id={id}
          type="source"
          position={pos}
          isConnectable={drawMode}
          className="!h-3 !w-3 !border-2 !border-white !bg-primary"
          style={{ visibility: drawMode ? 'visible' : 'hidden' }}
        />
      ))}
      <div className="flex items-start gap-1 px-2 pt-1.5 font-semibold leading-snug" style={{ color: node.perspectiveColor }}>
        <span className="flex-1">
          {node.code} – {node.name}
        </span>
        {onExpand && (
          <button type="button" aria-label={`Xem KPI của mục tiêu ${node.code}`} className="nodrag rounded p-0.5 text-slate-500 hover:bg-slate-100" onClick={() => onExpand(node)}>
            <ChevronDown className="h-4 w-4" />
          </button>
        )}
        {editable && onRemove && (
          <button type="button" aria-label={`Xóa mục tiêu ${node.code}`} title="Xóa" className="nodrag inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-50" onClick={() => onRemove(node.objectiveId)}>
            <Trash2 className="h-3.5 w-3.5" />
            Xóa
          </button>
        )}
      </div>
      <div className="px-2 pb-1.5">
        <div className="mb-1 text-[11px] text-slate-500" data-testid="kpi-count">
          {node.kpis.length} KPI
        </div>
        <div className="flex flex-wrap gap-1">
          {chips.map((k) => (
            <span
              key={k.kpiId}
              title={`${k.kpiCode} – ${k.kpiName}`}
              data-testid="kpi-chip"
              className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700"
              style={kpiColor?.(node.objectiveId, k) ? { background: kpiColor(node.objectiveId, k), color: '#fff' } : undefined}
            >
              {k.kpiCode}
            </span>
          ))}
          {node.kpis.length > 3 && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px]">+{node.kpis.length - 3}</span>}
        </div>
      </div>
    </div>
  );
});

/** Dải viễn cảnh (swimlane) — group node, không kéo được */
const LaneNode = memo(function LaneNode({ data }: NodeProps<Node<LaneData>>) {
  const { lane, width } = data;
  return (
    <div data-testid="lane" className="flex border-b border-slate-200" style={{ width, height: LANE_H, background: `${lane.color}14` }}>
      <div className="flex items-center justify-center border-r border-slate-200 px-2 text-center text-[13px] font-semibold" style={{ width: LANE_LABEL_W, color: lane.color }}>
        {lane.name}
      </div>
    </div>
  );
});

const nodeTypes = { objective: ObjectiveNode, lane: LaneNode };

export function laneIndex(lanes: Lane[], perspectiveId: number) {
  const i = lanes.findIndex((l) => l.id === perspectiveId);
  return i < 0 ? 0 : i;
}

/** Giữ node trong dải viễn cảnh của nó */
export function clampToLane(lanes: Lane[], n: MapNode, x: number, y: number) {
  const top = laneIndex(lanes, n.perspectiveId) * LANE_H;
  return { x: Math.max(LANE_LABEL_W + 10, x), y: Math.min(Math.max(top + 8, y), top + LANE_H - NODE_H + 10) };
}

/** Vị trí trống tiếp theo trong dải */
export function nextSlot(lanes: Lane[], nodes: MapNode[], perspectiveId: number) {
  const top = laneIndex(lanes, perspectiveId) * LANE_H;
  const inLane = nodes.filter((n) => n.perspectiveId === perspectiveId);
  const maxX = inLane.reduce((m, n) => Math.max(m, n.posX), X0 - COL_W);
  return { x: maxX + COL_W, y: top + Y_PAD };
}

/** “Tự động sắp xếp”: Dagre (dưới → trên theo quan hệ nhân quả) để lấy thứ tự, rồi xếp hàng trong từng dải */
export function autoLayout(lanes: Lane[], nodes: MapNode[], edges: MapLink[]): MapNode[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'BT', nodesep: 40, ranksep: 60 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((n) => g.setNode(String(n.objectiveId), { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(String(e.source), String(e.target)));
  dagre.layout(g);
  const out: MapNode[] = [];
  lanes.forEach((l, i) => {
    nodes
      .filter((n) => n.perspectiveId === l.id)
      .sort((a, b) => g.node(String(a.objectiveId)).x - g.node(String(b.objectiveId)).x)
      .forEach((n, j) => out.push({ ...n, posX: X0 + j * COL_W, posY: i * LANE_H + Y_PAD }));
  });
  const placed = new Set(out.map((n) => n.objectiveId));
  return [...out, ...nodes.filter((n) => !placed.has(n.objectiveId))];
}

export interface StrategyMapProps {
  lanes: Lane[];
  nodes: MapNode[];
  edges: MapLink[];
  editable?: boolean;
  drawMode?: boolean;
  selectedEdge?: string | null;
  onSelectEdge?: (key: string | null) => void;
  onMove?: (objectiveId: number, x: number, y: number, done: boolean) => void;
  onConnect?: (c: MapLink) => void;
  onRemove?: (objectiveId: number) => void;
  onExpand?: (n: MapNode) => void;
  onInit?: (rf: ReactFlowInstance) => void;
  kpiColor?: (objectiveId: number, k: MapKpi) => string | undefined;
  height?: string;
}

/** Canvas bản đồ chiến lược (@xyflow/react) — dùng chung cho màn sửa, xem (readonly) và Dashboard */
export function StrategyMap({ lanes, nodes, edges, editable = false, drawMode = false, selectedEdge, onSelectEdge, onMove, onConnect, onRemove, onExpand, onInit, kpiColor, height = 'h-[480px]' }: StrategyMapProps) {
  const width = Math.max(1100, nodes.reduce((m, n) => Math.max(m, n.posX + NODE_W + 60), 0));
  const rfNodes = useMemo<Node[]>(
    () => [
      ...lanes.map((l, i) => ({
        id: `lane-${l.id}`,
        type: 'lane',
        position: { x: 0, y: i * LANE_H },
        data: { lane: l, width } satisfies LaneData,
        draggable: false,
        selectable: false,
        connectable: false,
        focusable: false,
        zIndex: -1,
      })),
      ...nodes.map((n) => ({
        id: String(n.objectiveId),
        type: 'objective',
        position: { x: n.posX, y: n.posY },
        data: { node: n, drawMode, editable, onRemove: editable ? onRemove : undefined, onExpand, kpiColor } satisfies ObjData,
        draggable: editable && !drawMode,
        selectable: false,
        connectable: drawMode,
      })),
    ],
    [lanes, nodes, width, drawMode, editable, onRemove, onExpand, kpiColor],
  );
  const rfEdges = useMemo<Edge[]>(
    () =>
      edges.map((e) => {
        const k = edgeKey(e);
        const sel = k === selectedEdge;
        return {
          id: k,
          source: String(e.source),
          target: String(e.target),
          sourceHandle: e.sourceHandle ?? undefined,
          targetHandle: e.targetHandle ?? undefined,
          type: 'smoothstep',
          selectable: editable,
          markerEnd: { type: MarkerType.ArrowClosed, color: sel ? '#dc2626' : '#475569' },
          style: { stroke: sel ? '#dc2626' : '#475569', strokeWidth: sel ? 3 : 1.6 },
          className: sel ? 'edge-selected' : undefined,
          data: { selected: sel },
          interactionWidth: 16,
        };
      }),
    [edges, selectedEdge, editable],
  );

  const onNodesChange = (changes: NodeChange[]) => {
    if (!onMove) return;
    for (const c of changes) {
      if (c.type === 'position' && c.position && !c.id.startsWith('lane-')) onMove(Number(c.id), c.position.x, c.position.y, !c.dragging);
      else if (c.type === 'position' && !c.dragging && !c.id.startsWith('lane-')) {
        const n = nodes.find((x) => String(x.objectiveId) === c.id);
        if (n) onMove(n.objectiveId, n.posX, n.posY, true);
      }
    }
  };

  const connect = (c: Connection) => {
    if (!onConnect || !c.source || !c.target) return;
    onConnect({ source: Number(c.source), target: Number(c.target), sourceHandle: c.sourceHandle, targetHandle: c.targetHandle });
  };

  return (
    <div className={`${height} w-full rounded border border-slate-200 bg-white`} data-testid="strategy-map">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onConnect={connect}
        onEdgeClick={(_, e) => editable && onSelectEdge?.(e.id === selectedEdge ? null : e.id)}
        onPaneClick={() => onSelectEdge?.(null)}
        connectionMode={ConnectionMode.Loose}
        nodesConnectable={drawMode}
        nodesDraggable={editable && !drawMode}
        elementsSelectable={editable}
        deleteKeyCode={null}
        fitView
        fitViewOptions={{ padding: 0.05 }}
        minZoom={0.15}
        maxZoom={2}
        onInit={onInit}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} color="#f1f5f9" />
      </ReactFlow>
    </div>
  );
}

/** 37.5 Ảnh PNG toàn bản đồ, nền trắng, có tiêu đề chiến lược */
export async function renderMapPng(rf: ReactFlowInstance, container: HTMLElement, title: string): Promise<string> {
  const bounds = getNodesBounds(rf.getNodes());
  const w = Math.min(4000, Math.max(800, Math.ceil(bounds.width) + 40));
  const h = Math.min(3000, Math.max(400, Math.ceil(bounds.height) + 40));
  const vp = getViewportForBounds(bounds, w, h, 0.2, 2, 0.02);
  const el = container.querySelector('.react-flow__viewport') as HTMLElement;
  const map = await toPng(el, {
    backgroundColor: '#ffffff',
    width: w,
    height: h,
    style: { width: `${w}px`, height: `${h}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` },
  });
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('Không tạo được ảnh bản đồ'));
    img.src = map;
  });
  const TITLE_H = 56;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h + TITLE_H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px "Be Vietnam Pro", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, w / 2, 36);
  ctx.drawImage(img, 0, TITLE_H);
  return canvas.toDataURL('image/png');
}
