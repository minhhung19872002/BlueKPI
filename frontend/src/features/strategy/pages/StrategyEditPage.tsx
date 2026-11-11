import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBlocker, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { ReactFlowProvider, useReactFlow, type ReactFlowInstance } from '@xyflow/react';
import { ArrowLeft, Image as ImageIcon, LayoutGrid, Link2, ListPlus, Maximize, Minus, Plus, Save, Target, Unlink } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { get, put } from '@/api/http';
import { EP } from '@/api/endpoints';
import { Button } from '@/components/ui/Button';
import { confirm } from '@/components/ui/ConfirmDialog';
import { Field, Input, ReadField, Select } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/Misc';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { errorMessage, toast } from '@/components/ui/Toast';
import { TreeSelect } from '@/components/ui/TreeSelect';
import { useUnitUsers } from '@/features/catalog/hooks';
import { Section, useOrgTree } from '@/features/common/shared';
import { fmtDateTime } from '@/lib/format';
import { useHasPerm } from '@/stores/sessionStore';
import { AssignKpiDialog, ImagePreviewDialog, ObjectiveKpisDialog, ObjectivePickerDialog, type ObjectiveRow } from '../components/MapDialogs';
import { autoLayout, clampToLane, edgeKey, nextSlot, renderMapPng, StrategyMap } from '../components/StrategyMap';
import { STRATEGY_STATUS, type MapLink, type MapNode, type Strategy, type StrategyMapData } from '../types';
import { StrategyStatusBadge, useStages } from './StrategyListPage';

/** Màn hình “Cập nhật chiến lược” (36.3 xem, 36.5, 37.1–37.6, 38.1) */
export function StrategyEditPage() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  );
}

interface Info {
  name: string;
  orgUnitId: number | null;
  ownerUserId: number | null;
  stageId: number | null;
  year: number | null;
  status: string;
}

const infoOf = (s: Strategy): Info => ({ name: s.name, orgUnitId: s.orgUnitId, ownerUserId: s.ownerUserId, stageId: s.stageId, year: s.year, status: s.status });

function Editor() {
  const { id } = useParams({ strict: false }) as { id: string };
  const search = useSearch({ strict: false }) as { mode?: string; year?: number };
  const navigate = useNavigate();
  const qc = useQueryClient();
  const rf = useReactFlow();
  const sid = Number(id);
  const canUpdate = useHasPerm('STRATEGY:UPDATE');
  const canAssign = useHasPerm('STRATEGY:ASSIGN_KPI');
  const canImage = useHasPerm('STRATEGY:EXPORT_IMAGE');
  const q = useQuery({ queryKey: ['strategy-map', sid], queryFn: () => get<StrategyMapData>(EP.strategies.map(sid)), staleTime: 0, gcTime: 0 });
  const data = q.data;
  const s = data?.strategy;
  const editable = !!s && canUpdate && search.mode !== 'view' && s.status === 'DANG_THUC_HIEN';

  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [edges, setEdges] = useState<MapLink[]>([]);
  const [info, setInfo] = useState<Info | null>(null);
  const [dirty, setDirty] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [selEdge, setSelEdge] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'objectives' | 'kpi' | null>(null);
  const [expand, setExpand] = useState<MapNode | null>(null);
  const [png, setPng] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof Info, string>>>({});
  const box = useRef<HTMLDivElement>(null);
  const version = useRef<number>(0);

  useEffect(() => {
    if (!data) return;
    setNodes(data.nodes);
    setEdges(data.edges);
    setInfo(infoOf(data.strategy));
    version.current = data.strategy.version;
    setDirty(false);
  }, [data]);

  // Rời trang khi còn thay đổi chưa lưu → cảnh báo
  useBlocker({
    shouldBlockFn: async () => {
      if (!dirty) return false;
      return !(await confirm({ title: 'Thay đổi chưa được lưu', message: 'Bản đồ chiến lược còn thay đổi chưa lưu. Bạn có chắc chắn muốn rời trang?', confirmText: 'Rời trang', danger: true }));
    },
    enableBeforeUnload: () => dirty,
  });

  const lanes = useMemo(() => data?.lanes ?? [], [data]);
  const touch = () => setDirty(true);

  const onMove = useCallback(
    (oid: number, x: number, y: number, done: boolean) => {
      setNodes((ns) =>
        ns.map((n) => {
          if (n.objectiveId !== oid) return n;
          const p = done ? clampToLane(lanes, n, x, y) : { x, y };
          return { ...n, posX: p.x, posY: p.y };
        }),
      );
      if (done) setDirty(true);
    },
    [lanes],
  );

  const onConnect = (c: MapLink) => {
    if (c.source === c.target) return toast.error('Không được nối mục tiêu với chính nó');
    if (edges.some((e) => (e.source === c.source && e.target === c.target) || (e.source === c.target && e.target === c.source))) return toast.error('Liên kết giữa hai mục tiêu đã tồn tại');
    setEdges((es) => [...es, c]);
    touch();
  };

  const removeNode = useCallback((oid: number) => {
    setNodes((ns) => ns.filter((n) => n.objectiveId !== oid));
    setEdges((es) => es.filter((e) => e.source !== oid && e.target !== oid));
    setSelEdge(null);
    setDirty(true);
  }, []);

  const removeEdge = () => {
    if (!selEdge) return;
    setEdges((es) => es.filter((e) => edgeKey(e) !== selEdge));
    setSelEdge(null);
    touch();
  };

  const addObjectives = (rows: ObjectiveRow[]) => {
    setNodes((ns) => {
      const out = [...ns];
      for (const r of rows) {
        if (out.some((n) => n.objectiveId === r.id)) continue;
        const p = nextSlot(lanes, out, r.perspectiveId);
        out.push({
          objectiveId: r.id,
          code: r.code,
          name: r.name,
          description: r.description,
          perspectiveId: r.perspectiveId,
          perspectiveCode: '',
          perspectiveName: r.perspectiveName,
          perspectiveColor: r.perspectiveColor,
          perspectiveSort: r.perspectiveSort,
          posX: p.x,
          posY: p.y,
          kpis: [],
        });
      }
      return out;
    });
    setDialog(null);
    touch();
    setTimeout(() => rf.fitView({ padding: 0.05 }), 50);
  };

  const layout = () => {
    setNodes((ns) => autoLayout(lanes, ns, edges));
    touch();
    setTimeout(() => rf.fitView({ padding: 0.05 }), 50);
  };

  const exportImage = async () => {
    if (!box.current || !s) return;
    try {
      setPng(await renderMapPng(rf as unknown as ReactFlowInstance, box.current, `${s.code} – ${info?.name ?? s.name}`));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof Info, string>> = {};
    if (!info?.name.trim()) e.name = 'Vui lòng nhập Tên chiến lược';
    if (!info?.orgUnitId) e.orgUnitId = 'Vui lòng chọn Đơn vị';
    if (!info?.ownerUserId) e.ownerUserId = 'Vui lòng chọn Chủ trì';
    if (!info?.stageId) e.stageId = 'Vui lòng chọn Giai đoạn áp dụng';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const save = async () => {
    if (!s || !info || !validate()) return;
    setSaving(true);
    try {
      const vp = rf.getViewport();
      const r = await put<StrategyMapData>(EP.strategies.map(sid), {
        nodes: nodes.map((n) => ({ objectiveId: n.objectiveId, posX: Math.round(n.posX), posY: Math.round(n.posY) })),
        edges: edges.map((e) => ({ source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null, targetHandle: e.targetHandle ?? null })),
        kpis: nodes.flatMap((n) => n.kpis.map((k) => ({ objectiveId: n.objectiveId, kpiId: k.kpiId }))),
        viewport: JSON.stringify(vp),
        version: version.current,
      });
      version.current = r.data!.strategy.version;
      let saved = r.data!;
      // thông tin chung lưu sau bản đồ (chuyển “Hoàn thành” sẽ khóa sửa bản đồ)
      if (JSON.stringify(info) !== JSON.stringify(infoOf(s))) {
        const u = await put<Strategy>(EP.strategies.one(sid), { ...info, name: info.name.trim(), version: version.current });
        version.current = u.data!.version;
        saved = { ...saved, strategy: u.data! };
      }
      toast.success(r.message || 'Lưu bản đồ chiến lược thành công');
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['strategies'] });
      qc.setQueryData(['strategy-map', sid], saved);
      if (info.status === 'HOAN_THANH') navigate({ to: '/kpi-admin/strategies/$id', params: { id }, search: { mode: 'view' } });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (q.isError) return <div className="p-4 text-danger">{errorMessage(q.error)}</div>;
  if (!s || !info) return <div className="p-4 text-sm text-slate-500">Đang tải...</div>;

  return (
    <div>
      <PageHeader
        title={editable ? 'Cập nhật chiến lược' : 'Xem chi tiết chiến lược'}
        actions={
          <Button variant="outline" onClick={() => navigate({ to: '/kpi-admin/strategies' })}>
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Button>
        }
      />
      <Section title="Thông tin chung">
        {editable ? (
          <InfoForm info={info} errors={errors} onChange={(v) => (setInfo(v), touch())} strategy={s} />
        ) : (
          <div className="grid grid-cols-4 gap-3">
            <ReadField label="Mã chiến lược" value={s.code} />
            <ReadField label="Tên chiến lược" value={s.name} className="col-span-3" />
            <ReadField label="Đơn vị" value={s.orgUnitName} />
            <ReadField label="Chủ trì" value={s.ownerName} />
            <ReadField label="Giai đoạn áp dụng" value={s.stageName} />
            <ReadField label="Năm" value={s.year} />
            <ReadField label="Trạng thái" value={<StrategyStatusBadge status={s.status} />} />
            <ReadField label="Số mục tiêu" value={s.objectiveCount} />
            <ReadField label="Số KPI" value={s.kpiCount} />
            <ReadField label="Ngày cập nhật" value={fmtDateTime(s.updatedAt)} />
          </div>
        )}
      </Section>
      <div className="mb-2 flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Thanh công cụ bản đồ">
        {editable && (
          <>
            <Button size="sm" variant="secondary" onClick={() => setDialog('objectives')}>
              <ListPlus className="h-4 w-4" />
              Cập nhật mục tiêu trọng tâm
            </Button>
            <Button size="sm" variant={drawMode ? 'primary' : 'secondary'} aria-pressed={drawMode} onClick={() => setDrawMode((d) => !d)}>
              <Link2 className="h-4 w-4" />
              Vẽ liên kết
            </Button>
            <Button size="sm" variant="secondary" disabled={!selEdge} onClick={removeEdge}>
              <Unlink className="h-4 w-4" />
              Xóa liên kết
            </Button>
            {canAssign && (
              <Button size="sm" variant="secondary" disabled={!nodes.length} onClick={() => setDialog('kpi')}>
                <Target className="h-4 w-4" />
                Giao KPI
              </Button>
            )}
          </>
        )}
        {canImage && (
          <Button size="sm" variant="secondary" onClick={exportImage}>
            <ImageIcon className="h-4 w-4" />
            Tải ảnh bản đồ
          </Button>
        )}
        {editable && (
          <Button size="sm" variant="secondary" onClick={layout}>
            <LayoutGrid className="h-4 w-4" />
            Tự động sắp xếp
          </Button>
        )}
        <Button size="sm" variant="outline" aria-label="Phóng to" onClick={() => rf.zoomIn()}>
          <Plus className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" aria-label="Thu nhỏ" onClick={() => rf.zoomOut()}>
          <Minus className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={() => rf.fitView({ padding: 0.05 })}>
          <Maximize className="h-4 w-4" />
          Vừa màn hình
        </Button>
        {editable && (
          <Button size="sm" className="ml-auto" onClick={save} loading={saving}>
            <Save className="h-4 w-4" />
            Lưu
          </Button>
        )}
      </div>
      {drawMode && <p className="mb-1 text-[13px] text-primary">Kéo từ handle trên node để nối liên kết giữa các mục tiêu</p>}
      {dirty && <p className="mb-1 text-[12px] text-amber-700">Có thay đổi chưa lưu</p>}
      <div ref={box}>
        <StrategyMap
          lanes={lanes}
          nodes={nodes}
          edges={edges}
          editable={editable}
          drawMode={editable && drawMode}
          selectedEdge={selEdge}
          onSelectEdge={setSelEdge}
          onMove={editable ? onMove : undefined}
          onConnect={onConnect}
          onRemove={removeNode}
          onExpand={setExpand}
          height="h-[520px]"
        />
      </div>
      {dialog === 'objectives' && <ObjectivePickerDialog strategyId={sid} onMap={new Set(nodes.map((n) => n.objectiveId))} onClose={() => setDialog(null)} onAdd={addObjectives} />}
      {dialog === 'kpi' && (
        <AssignKpiDialog
          nodes={nodes}
          onClose={() => setDialog(null)}
          onConfirm={(frame) => {
            setNodes((ns) => ns.map((n) => ({ ...n, kpis: frame.get(n.objectiveId) ?? n.kpis })));
            setDialog(null);
            touch();
          }}
        />
      )}
      {expand && <ObjectiveKpisDialog strategyId={sid} node={expand} year={search.year ?? s.year} onClose={() => setExpand(null)} />}
      {png && <ImagePreviewDialog src={png} fileName={`BanDoChienLuoc_${s.code}.png`} onClose={() => setPng(null)} />}
    </div>
  );
}

function InfoForm({ info, errors, onChange, strategy }: { info: Info; errors: Partial<Record<keyof Info, string>>; onChange: (v: Info) => void; strategy: Strategy }) {
  const org = useOrgTree();
  const stages = useStages();
  const users = useUnitUsers(info.orgUnitId);
  const stage = stages.data?.find((x) => x.id === info.stageId);
  const years = stage ? Array.from({ length: stage.toYear - stage.fromYear + 1 }, (_, i) => stage.fromYear + i).map((y) => ({ value: y, label: String(y) })) : [];
  const ownerOptions = (users.data ?? []).map((u) => ({ value: u.id, label: u.fullName, sub: u.username }));
  if (info.ownerUserId && !ownerOptions.some((o) => o.value === info.ownerUserId)) ownerOptions.unshift({ value: info.ownerUserId, label: strategy.ownerName, sub: strategy.ownerUsername });
  return (
    <div className="grid grid-cols-3 gap-3">
      <Field label="Tên chiến lược" required htmlFor="sf-name" error={errors.name} className="col-span-2">
        <Input id="sf-name" value={info.name} onChange={(e) => onChange({ ...info, name: e.target.value })} />
      </Field>
      <ReadField label="Mã chiến lược" value={strategy.code} />
      <Field label="Đơn vị" required htmlFor="sf-unit" error={errors.orgUnitId}>
        <TreeSelect id="sf-unit" aria-label="Đơn vị" nodes={org.data ?? []} value={info.orgUnitId} onChange={(v) => onChange({ ...info, orgUnitId: v ?? null, ownerUserId: null })} />
      </Field>
      <Field label="Chủ trì" required htmlFor="sf-owner" error={errors.ownerUserId}>
        <SearchSelect id="sf-owner" aria-label="Chủ trì" options={ownerOptions} value={info.ownerUserId} onChange={(v) => onChange({ ...info, ownerUserId: v ?? null })} />
      </Field>
      <Field label="Giai đoạn áp dụng" required htmlFor="sf-stage" error={errors.stageId}>
        <Select
          id="sf-stage"
          options={(stages.data ?? []).map((x) => ({ value: x.id, label: x.name }))}
          value={info.stageId ?? ''}
          onChange={(e) => {
            const st = stages.data?.find((x) => x.id === Number(e.target.value));
            onChange({ ...info, stageId: st?.id ?? null, year: st ? Math.min(Math.max(info.year ?? st.fromYear, st.fromYear), st.toYear) : info.year });
          }}
        />
      </Field>
      <Field label="Năm" htmlFor="sf-year">
        <Select id="sf-year" options={years} value={info.year ?? ''} onChange={(e) => onChange({ ...info, year: Number(e.target.value) })} />
      </Field>
      <Field label="Trạng thái" htmlFor="sf-status">
        <Select id="sf-status" options={STRATEGY_STATUS} value={info.status} onChange={(e) => onChange({ ...info, status: e.target.value })} />
      </Field>
    </div>
  );
}
