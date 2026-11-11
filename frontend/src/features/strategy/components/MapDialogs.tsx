import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { get } from '@/api/http';
import { EP } from '@/api/endpoints';
import { DataGrid } from '@/components/data-grid/DataGrid';
import { useListState } from '@/components/data-grid/useListState';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Select } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Misc';
import { usePerspectives, useKpiOptions } from '@/features/catalog/hooks';
import { codeName } from '@/features/common/shared';
import { fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { MapKpi, MapNode, ObjectiveKpi } from '../types';

export interface ObjectiveRow {
  id: number;
  code: string;
  name: string;
  description?: string;
  perspectiveId: number;
  perspectiveName: string;
  perspectiveColor: string;
  perspectiveSort: number;
  onMap?: boolean;
}

/** 37.1 Dialog “Tìm kiếm mục tiêu trọng tâm đặt vào chiến lược” */
export function ObjectivePickerDialog({ strategyId, onMap, onClose, onAdd }: { strategyId: number; onMap: Set<number>; onClose: () => void; onAdd: (rows: ObjectiveRow[]) => void }) {
  const perspectives = usePerspectives();
  const list = useListState<{ keyword: string; perspectiveId: string; strategyId: number }, ObjectiveRow>('objectives-for-strategy', EP.objectives.searchForStrategy, {
    keyword: '',
    perspectiveId: '',
    strategyId,
  });
  const [picked, setPicked] = useState<Map<number, ObjectiveRow>>(new Map());
  const rows = list.gridProps.rows;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Tìm kiếm mục tiêu trọng tâm đặt vào chiến lược"
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button disabled={!picked.size} onClick={() => onAdd([...picked.values()])}>
            Thêm vào chiến lược
          </Button>
        </>
      }
    >
      <div className="mb-3 flex gap-2">
        <Input
          aria-label="Từ khóa tìm kiếm mục tiêu"
          placeholder="Mã hoặc tên mục tiêu trọng tâm"
          value={list.draft.keyword}
          onChange={(e) => list.set('keyword', e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && list.search()}
        />
        <Select
          aria-label="Viễn cảnh"
          className="w-48"
          placeholder="Tất cả viễn cảnh"
          options={(perspectives.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
          value={list.draft.perspectiveId}
          onChange={(e) => list.set('perspectiveId', e.target.value)}
        />
        <Button variant="secondary" onClick={list.search}>
          Tìm kiếm
        </Button>
      </div>
      <DataGrid<ObjectiveRow>
        title="Danh sách mục tiêu trọng tâm"
        {...list.gridProps}
        rowKey={(r) => r.id}
        selectable
        isRowSelectable={(r) => !onMap.has(r.id)}
        selected={[...picked.keys()]}
        onSelectedChange={(keys) =>
          setPicked((prev) => {
            const next = new Map<number, ObjectiveRow>();
            const pageIds = new Set(rows.map((r) => r.id));
            for (const [k, v] of prev) if (!pageIds.has(k)) next.set(k, v);
            for (const k of keys) {
              const r = rows.find((x) => x.id === k) ?? prev.get(Number(k));
              if (r) next.set(r.id, r);
            }
            return next;
          })
        }
        rowClassName={(r) => (onMap.has(r.id) ? 'opacity-50' : undefined)}
        columns={[
          { key: 'code', header: 'Mã – Tên mục tiêu trọng tâm', width: 300, render: (r) => codeName(r.code, r.name) + (onMap.has(r.id) ? ' (đã có trên bản đồ)' : '') },
          { key: 'description', header: 'Mô tả', width: 240 },
          { key: 'perspectiveName', header: 'Viễn cảnh', width: 120 },
        ]}
      />
    </Dialog>
  );
}

/** 38.1 Dialog “Giao KPI” — chọn tiêu chí KPI cho từng mục tiêu trọng tâm trên bản đồ */
export function AssignKpiDialog({ nodes, onClose, onConfirm }: { nodes: MapNode[]; onClose: () => void; onConfirm: (frame: Map<number, MapKpi[]>) => void }) {
  const [active, setActive] = useState<number | null>(nodes[0]?.objectiveId ?? null);
  const [frame, setFrame] = useState<Map<number, Map<number, MapKpi>>>(() => new Map(nodes.map((n) => [n.objectiveId, new Map(n.kpis.map((k) => [k.kpiId, k]))])));
  const [keyword, setKeyword] = useState('');
  const [kw, setKw] = useState('');
  const [scope, setScope] = useState<'objective' | 'perspective' | 'all'>('objective');
  const node = nodes.find((n) => n.objectiveId === active);
  const kpis = useKpiOptions({
    keyword: kw || undefined,
    objectiveId: scope === 'objective' ? node?.objectiveId : undefined,
    perspectiveId: scope === 'perspective' ? node?.perspectiveId : undefined,
    rootOnly: true,
  });
  const sel = active != null ? (frame.get(active) ?? new Map<number, MapKpi>()) : new Map<number, MapKpi>();
  const rows = useMemo(() => kpis.data ?? [], [kpis.data]);
  const toggle = (k: { id: number; code: string; name: string }, on: boolean) => {
    if (active == null) return;
    setFrame((prev) => {
      const next = new Map(prev);
      const m = new Map(next.get(active) ?? []);
      if (on) m.set(k.id, { objectiveId: active, kpiId: k.id, kpiCode: k.code, kpiName: k.name });
      else m.delete(k.id);
      next.set(active, m);
      return next;
    });
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Giao KPI"
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={() => onConfirm(new Map([...frame].map(([k, v]) => [k, [...v.values()]])))}>Xác nhận</Button>
        </>
      }
    >
      <div className="grid grid-cols-[240px_1fr] gap-3">
        <div className="max-h-[420px] overflow-auto rounded border" role="listbox" aria-label="Mục tiêu trọng tâm trên bản đồ">
          {nodes.map((n) => (
            <button
              key={n.objectiveId}
              type="button"
              role="option"
              aria-selected={n.objectiveId === active}
              onClick={() => setActive(n.objectiveId)}
              className={cn('block w-full border-b border-l-4 px-2 py-1.5 text-left text-[13px] hover:bg-slate-50', n.objectiveId === active && 'bg-primary/10 font-semibold')}
              style={{ borderLeftColor: n.perspectiveColor }}
            >
              {n.code} – {n.name}
              <span className="ml-1 text-[11px] text-slate-500">({frame.get(n.objectiveId)?.size ?? 0} KPI)</span>
            </button>
          ))}
          {!nodes.length && <p className="p-3 text-[13px] text-slate-500">Bản đồ chưa có mục tiêu trọng tâm</p>}
        </div>
        <div>
          <div className="mb-2 flex gap-2">
            <Input aria-label="Tìm tiêu chí KPI" placeholder="Mã hoặc tên tiêu chí KPI" value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setKw(keyword.trim())} />
            <Select
              aria-label="Phạm vi lọc KPI"
              className="w-48"
              options={[
                { value: 'objective', label: 'Theo mục tiêu' },
                { value: 'perspective', label: 'Theo viễn cảnh' },
                { value: 'all', label: 'Tất cả KPI' },
              ]}
              value={scope}
              onChange={(e) => setScope(e.target.value as typeof scope)}
            />
            <Button variant="secondary" onClick={() => setKw(keyword.trim())}>
              Tìm kiếm
            </Button>
          </div>
          <DataGrid
            title="Danh sách tiêu chí KPI"
            rows={rows}
            loading={kpis.isFetching}
            rowKey={(r) => r.id}
            pagination={false}
            maxHeight="max-h-[360px]"
            columns={[
              {
                key: 'pick',
                header: '',
                width: 40,
                render: (r) => <Checkbox aria-label={`Chọn ${r.code}`} checked={sel.has(r.id)} disabled={active == null} onCheckedChange={(v) => toggle(r, !!v)} />,
              },
              { key: 'code', header: 'Mã – Tên tiêu chí KPI', width: 320, render: (r) => codeName(r.code, r.name) },
              { key: 'perspectiveName', header: 'Viễn cảnh', width: 110 },
              { key: 'objectiveCode', header: 'Mục tiêu', width: 100 },
            ]}
          />
        </div>
      </div>
    </Dialog>
  );
}

/** 37.4 KPI của mục tiêu trọng tâm */
export function ObjectiveKpisDialog({ strategyId, node, year, onClose }: { strategyId: number; node: MapNode; year: number; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['strategy-objective-kpis', strategyId, node.objectiveId, year],
    queryFn: () => get<ObjectiveKpi[]>(EP.strategies.objectiveKpis(strategyId, node.objectiveId), { year }),
  });
  const saved = new Set((q.data ?? []).map((k) => k.kpiId));
  const rows: ObjectiveKpi[] = [...(q.data ?? []), ...node.kpis.filter((k) => !saved.has(k.kpiId)).map((k) => ({ kpiId: k.kpiId, kpiCode: k.kpiCode, kpiName: k.kpiName }))];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`KPI của mục tiêu ${node.code}`} size="lg">
      <p className="mb-2 text-[13px] text-slate-600">
        {node.code} – {node.name} · Năm {year}
      </p>
      <DataGrid<ObjectiveKpi>
        title="Danh sách KPI thuộc mục tiêu"
        rows={rows}
        loading={q.isFetching}
        rowKey={(r) => r.kpiId}
        pagination={false}
        columns={[
          { key: 'kpiCode', header: 'Mã – Tên KPI', width: 280, render: (r) => codeName(r.kpiCode, r.kpiName) },
          { key: 'unitOfMeasureName', header: 'Đơn vị đo', width: 90 },
          { key: 'planValue', header: 'Mục tiêu', align: 'right', width: 90, render: (r) => fmtNum(r.planValue, 2) },
          { key: 'finalResult', header: 'Kết quả', align: 'right', width: 90, render: (r) => fmtNum(r.finalResult, 2) },
          { key: 'periodName', header: 'Kỳ đánh giá', width: 120, render: (r) => (r.periodName ? `${r.periodName} ${r.year}` : '') },
        ]}
      />
    </Dialog>
  );
}

/** 37.5 Dialog “Xem trước ảnh bản đồ chiến lược” */
export function ImagePreviewDialog({ src, fileName, onClose }: { src: string; fileName: string; onClose: () => void }) {
  const save = () => {
    const a = document.createElement('a');
    a.href = src;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Xem trước ảnh bản đồ chiến lược"
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button onClick={save}>
            <Download className="h-4 w-4" />
            Tải xuống
          </Button>
        </>
      }
    >
      <div className="max-h-[60vh] overflow-auto rounded border bg-white p-2">
        <img src={src} alt="Ảnh bản đồ chiến lược" className="mx-auto max-w-full" />
      </div>
    </Dialog>
  );
}
