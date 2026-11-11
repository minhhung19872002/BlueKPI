import { useQuery } from '@tanstack/react-query';
import { Plus, Upload } from 'lucide-react';
import { useState } from 'react';
import { ApiError, del, get } from '@/api/http';
import { EP } from '@/api/endpoints';
import { DataGrid } from '@/components/data-grid/DataGrid';
import { FilterItem, SearchBar } from '@/components/data-grid/SearchBar';
import { useListState } from '@/components/data-grid/useListState';
import { ExportButton } from '@/components/import-export/ExportButton';
import { ImportDialog } from '@/components/import-export/ImportDialog';
import { Button } from '@/components/ui/Button';
import { confirm, confirmDelete } from '@/components/ui/ConfirmDialog';
import { Drawer } from '@/components/ui/Dialog';
import { ReadField, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Misc';
import { errorMessage, toast } from '@/components/ui/Toast';
import { labelOf, RowActions, Section } from '@/features/common/shared';
import { fmtDateTime } from '@/lib/format';
import { useHasPerm } from '@/stores/sessionStore';
import { COMPLETION, COMPONENT_SOURCES, DATA_SOURCES, GROUP_AGG, TARGET_DATA_TYPES, useObjectives, usePerspectives } from '../hooks';
import { KpiFormDialog } from './KpiForm';

export interface KpiDetail {
  id: number;
  code: string;
  name: string;
  structure: string;
  parentId: number | null;
  parentCode?: string;
  groupAggregation: string;
  groupExpression?: string;
  perspectiveId: number;
  perspectiveCode: string;
  perspectiveName: string;
  perspectiveColor: string;
  groupKpiId: number | null;
  groupKpiCode?: string;
  groupKpiName?: string;
  targetDataType: string;
  completionFormula: string;
  completionExpression?: string;
  scoringMethodId: number;
  scoringMethodName: string;
  scoreByResult: boolean;
  objectiveId: number;
  objectiveCode: string;
  objectiveName: string;
  weight: number | null;
  unitOfMeasureId: number;
  unitOfMeasureName: string;
  assigningUnitId: number;
  assigningUnitName: string;
  assigningOfficerId: number;
  assigningOfficerName: string;
  evaluatingUnitId: number;
  evaluatingUnitName: string;
  evaluatingOfficerId: number;
  evaluatingOfficerName: string;
  dataSource: string;
  resultExpression?: string;
  isFocus: boolean;
  status: string;
  assigned: boolean;
  childCount: number;
  version: number;
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
  children: KpiDetail[];
  components: { id: number; code: string; name: string; formulaDefinitionId: number | null; formulaCode?: string; formulaName?: string; source: string }[];
}

/** 23.1–23.7 Tab “Danh sách KPI” */
export function KpiTab() {
  const canCreate = useHasPerm('KPI:CREATE');
  const canUpdate = useHasPerm('KPI:UPDATE');
  const canDelete = useHasPerm('KPI:DELETE');
  const canImport = useHasPerm('KPI:IMPORT');
  const canExport = useHasPerm('KPI:EXPORT');
  const perspectives = usePerspectives();
  const list = useListState<{ keyword: string; perspectiveId: string; objectiveId: string }, KpiDetail>('kpis', EP.kpis.tree, { keyword: '', perspectiveId: '', objectiveId: '' });
  const objectives = useObjectives(list.draft.perspectiveId ? Number(list.draft.perspectiveId) : null);
  const [form, setForm] = useState<{ open: boolean; id?: number }>({ open: false });
  const [view, setView] = useState<number | null>(null);
  const [imp, setImp] = useState(false);
  const searching = !!(list.applied.keyword || list.applied.perspectiveId || list.applied.objectiveId);

  const remove = async (r: KpiDetail) => {
    if (!(await confirmDelete(`${r.code} – ${r.name}`))) return;
    try {
      await del(EP.kpis.one(r.id));
      toast.success('Xóa thành công');
      list.query.refetch();
    } catch (e) {
      const d = e instanceof ApiError ? (e.data as { confirmRequired?: boolean } | null) : null;
      if (d?.confirmRequired && (await confirm({ title: 'Xác nhận xóa', message: (e as ApiError).message, danger: true, confirmText: 'Xác nhận' }))) {
        try {
          await del(EP.kpis.one(r.id), { withChildren: true });
          toast.success('Xóa thành công');
          list.query.refetch();
        } catch (e2) {
          toast.error(errorMessage(e2));
        }
      } else if (!d?.confirmRequired) toast.error(errorMessage(e));
    }
  };

  return (
    <div>
      <SearchBar
        keyword={list.draft.keyword}
        onKeywordChange={(v) => list.set('keyword', v)}
        placeholder="Tên hoặc mã tiêu chí"
        onSearch={list.search}
        onReset={list.reset}
        actions={
          <>
            {canCreate && (
              <Button onClick={() => setForm({ open: true })}>
                <Plus className="h-4 w-4" />
                Thêm tiêu chí
              </Button>
            )}
            {canImport && (
              <Button variant="outline" onClick={() => setImp(true)}>
                <Upload className="h-4 w-4" />
                Nhập dữ liệu
              </Button>
            )}
            {canExport && <ExportButton url={EP.kpis.export} params={list.exportParams} />}
          </>
        }
      >
        <FilterItem label="Viễn cảnh" width="w-48">
          <Select
            aria-label="Viễn cảnh"
            placeholder="Tất cả"
            options={(perspectives.data ?? []).map((p) => ({ value: p.id, label: `${p.code} – ${p.name}` }))}
            value={list.draft.perspectiveId}
            onChange={(e) => {
              list.set('perspectiveId', e.target.value);
              list.set('objectiveId', '');
            }}
          />
        </FilterItem>
        <FilterItem label="Mục tiêu trọng tâm" width="w-64">
          <Select
            aria-label="Mục tiêu trọng tâm"
            placeholder="Tất cả"
            options={(objectives.data ?? []).map((o) => ({ value: o.id, label: `${o.code} – ${o.name}` }))}
            value={list.draft.objectiveId}
            onChange={(e) => list.set('objectiveId', e.target.value)}
          />
        </FilterItem>
      </SearchBar>
      <h3 className="mb-2 text-sm font-semibold">Danh sách KPI</h3>
      <DataGrid<KpiDetail>
        key={searching ? 'expanded' : 'collapsed'}
        title="Danh sách KPI"
        {...list.gridProps}
        rowKey={(r) => r.id}
        getChildren={(r) => r.children}
        defaultExpandAll={searching}
        columns={[
          {
            key: 'code',
            header: 'Mã – Tên tiêu chí KPI',
            sortable: true,
            width: 320,
            render: (r) => (
              <span>
                <b>{r.code}</b> – {r.name} {r.isFocus && <Badge color="amber">Trọng tâm</Badge>}
              </span>
            ),
          },
          {
            key: 'perspectiveName',
            header: 'Viễn cảnh',
            sortable: true,
            width: 130,
            render: (r) => (
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.perspectiveColor }} />
                {r.perspectiveName}
              </span>
            ),
          },
          { key: 'unitOfMeasureName', header: 'Đơn vị đo', width: 90 },
          { key: 'parentCode', header: 'Mã KPI cha', width: 90 },
          { key: 'objectiveName', header: 'Mục tiêu trọng tâm', width: 190, render: (r) => `${r.objectiveCode} – ${r.objectiveName}` },
          { key: 'assigningUnitName', header: 'Đơn vị giao', width: 150 },
          {
            key: 'actions',
            header: 'Thao tác',
            width: 120,
            render: (r) => (
              <RowActions
                actions={[
                  { label: 'Xem', onClick: () => setView(r.id) },
                  { label: 'Sửa', onClick: () => setForm({ open: true, id: r.parentId ?? r.id }), show: canUpdate },
                  { label: 'Xóa', onClick: () => remove(r), show: canDelete, danger: true },
                ]}
              />
            ),
          },
        ]}
      />
      {form.open && <KpiFormDialog kpiId={form.id} onClose={() => setForm({ open: false })} onSaved={() => list.query.refetch()} />}
      {view !== null && <KpiView id={view} onClose={() => setView(null)} />}
      <ImportDialog open={imp} onOpenChange={setImp} templateUrl={EP.kpis.importTemplate} validateUrl={EP.kpis.importValidate} commitUrl={EP.kpis.importCommit} onDone={() => list.query.refetch()} />
    </div>
  );
}

/** 23.3 Xem chi tiết: toàn bộ trường form 24/25 (chỉ đọc), KPI con, thành phần */
export function KpiView({ id, onClose }: { id: number; onClose: () => void }) {
  const q = useQuery({ queryKey: ['kpi', id], queryFn: () => get<KpiDetail>(EP.kpis.one(id)) });
  const k = q.data;
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title="Thông tin tiêu chí KPI" width="w-[900px]">
      {k && (
        <>
          <Section title="Thông tin chung">
            <div className="grid grid-cols-3 gap-3">
              <ReadField label="Cấu trúc tiêu chí" value={k.parentId ? 'KPI con' : k.structure === 'CHA_CON' ? 'KPI cha – con' : 'KPI đơn lẻ'} />
              <ReadField label="Mã tiêu chí" value={k.code} />
              <ReadField label="Mã KPI cha" value={k.parentCode} />
              <ReadField label="Tên tiêu chí" value={k.name} className="col-span-3" />
              <ReadField label="Cách tính kết quả KPI Tập đoàn" value={labelOf(GROUP_AGG, k.groupAggregation) + (k.groupExpression ? `: ${k.groupExpression}` : '')} />
              <ReadField label="Viễn cảnh" value={k.perspectiveName} />
              <ReadField label="Link với KPI tập đoàn" value={k.groupKpiCode ? `${k.groupKpiCode} – ${k.groupKpiName}` : ''} />
              <ReadField label="Loại số liệu giao" value={labelOf(TARGET_DATA_TYPES, k.targetDataType)} />
              <ReadField label="Công thức tỷ lệ hoàn thành chỉ tiêu" value={labelOf(COMPLETION, k.completionFormula) + (k.completionExpression ? `: ${k.completionExpression}` : '')} />
              <ReadField label="Phương pháp tính điểm" value={k.scoringMethodName} />
              <ReadField label="Tính điểm theo kết quả thực hiện" value={k.scoreByResult ? 'Có' : 'Không'} />
              <ReadField label="Mục tiêu trọng tâm" value={`${k.objectiveCode} – ${k.objectiveName}`} />
              <ReadField label="Tỷ trọng (1–100)" value={k.weight} />
              <ReadField label="Đơn vị giao" value={k.assigningUnitName} />
              <ReadField label="Cán bộ giao" value={k.assigningOfficerName} />
              <ReadField label="Đơn vị đánh giá" value={k.evaluatingUnitName} />
              <ReadField label="Cán bộ đánh giá" value={k.evaluatingOfficerName} />
              <ReadField label="Nguồn dữ liệu" value={labelOf(DATA_SOURCES, k.dataSource)} />
              <ReadField label="Đơn vị đo" value={k.unitOfMeasureName} />
              <ReadField label="Thuộc vùng chỉ đạo trọng tâm" value={k.isFocus ? 'Có' : 'Không'} />
              <ReadField label="Biểu thức kết quả" value={k.resultExpression} />
              <ReadField label="Người tạo" value={k.createdBy} />
              <ReadField label="Ngày tạo" value={fmtDateTime(k.createdAt)} />
              <ReadField label="Ngày cập nhật" value={fmtDateTime(k.updatedAt)} />
            </div>
          </Section>
          <Section title="Thành phần KPI">
            <table className="w-full text-[13px]" aria-label="Danh sách thành phần">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-2 py-1 text-left">Mã biến</th>
                  <th className="px-2 py-1 text-left">Tên thành phần</th>
                  <th className="px-2 py-1 text-left">Định nghĩa KPI công thức</th>
                  <th className="px-2 py-1 text-left">Nguồn</th>
                </tr>
              </thead>
              <tbody>
                {k.components.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-2 py-1">{c.code}</td>
                    <td className="px-2 py-1">{c.name}</td>
                    <td className="px-2 py-1">{c.formulaCode ? `${c.formulaCode} – ${c.formulaName}` : ''}</td>
                    <td className="px-2 py-1">{labelOf(COMPONENT_SOURCES, c.source)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          {!k.parentId && (
            <Section title="Danh sách KPI con">
              <table className="w-full text-[13px]" aria-label="Danh sách KPI con">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-2 py-1 text-left">Mã – Tên tiêu chí KPI</th>
                    <th className="px-2 py-1 text-left">Đơn vị đo</th>
                    <th className="px-2 py-1 text-right">Tỷ trọng</th>
                  </tr>
                </thead>
                <tbody>
                  {k.children.map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="px-2 py-1">
                        {c.code} – {c.name}
                      </td>
                      <td className="px-2 py-1">{c.unitOfMeasureName}</td>
                      <td className="px-2 py-1 text-right">{c.weight}</td>
                    </tr>
                  ))}
                  {!k.children.length && (
                    <tr>
                      <td colSpan={3} className="py-3 text-center text-muted">
                        Không có KPI con
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Section>
          )}
        </>
      )}
    </Drawer>
  );
}
