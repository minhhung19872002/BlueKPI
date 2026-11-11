import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Select } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Misc';
import { useKpiOptions, usePerspectives, type KpiOpt } from '@/features/catalog/hooks';

/** Dialog “Chọn tiêu chí KPI”: chọn KPI gốc; KPI cha kéo theo KPI con */
export function KpiPickerDialog({ open, onOpenChange, existing, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; existing: Set<number>; onPick: (kpis: KpiOpt[]) => void }) {
  const [kw, setKw] = useState('');
  const [perspectiveId, setPerspectiveId] = useState('');
  const [sel, setSel] = useState<Set<number>>(new Set());
  const perspectives = usePerspectives();
  const all = useKpiOptions({});
  const { roots, kids } = useMemo(() => {
    const data = all.data ?? [];
    const kids = new Map<number, KpiOpt[]>();
    data.forEach((k) => {
      if (k.parentId != null) kids.set(k.parentId, [...(kids.get(k.parentId) ?? []), k]);
    });
    const q = kw.trim().toLowerCase();
    const m = (k: KpiOpt) => !q || k.code.toLowerCase().includes(q) || k.name.toLowerCase().includes(q);
    const roots = data
      .filter((k) => k.parentId == null)
      .filter((k) => !perspectiveId || String(k.perspectiveId) === perspectiveId)
      .filter((k) => m(k) || (kids.get(k.id) ?? []).some(m));
    return { roots, kids };
  }, [all.data, kw, perspectiveId]);

  const confirmPick = () => {
    const out: KpiOpt[] = [];
    for (const r of all.data ?? []) {
      if (r.parentId == null && sel.has(r.id)) {
        out.push(r);
        out.push(...(kids.get(r.id) ?? []));
      }
    }
    onPick(out);
    setSel(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Chọn tiêu chí KPI"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={confirmPick} disabled={!sel.size}>
            Xác nhận
          </Button>
        </>
      }
    >
      <div className="mb-3 flex gap-2">
        <Input placeholder="Tìm theo mã hoặc tên tiêu chí" aria-label="Tìm tiêu chí KPI" value={kw} onChange={(e) => setKw(e.target.value)} />
        <Select
          aria-label="Lọc viễn cảnh"
          className="w-56"
          placeholder="Tất cả viễn cảnh"
          options={(perspectives.data ?? []).map((p) => ({ value: p.id, label: `${p.code} – ${p.name}` }))}
          value={perspectiveId}
          onChange={(e) => setPerspectiveId(e.target.value)}
        />
      </div>
      <div className="max-h-[55vh] overflow-auto rounded border border-border" role="list" aria-label="Danh sách tiêu chí KPI">
        {roots.map((k) => {
          const done = existing.has(k.id);
          return (
            <div key={k.id} role="listitem" className="border-b border-border px-3 py-1.5 last:border-0">
              <Checkbox
                checked={done || sel.has(k.id)}
                disabled={done}
                aria-label={`${k.code} – ${k.name}`}
                onCheckedChange={(v) => {
                  const n = new Set(sel);
                  if (v) n.add(k.id);
                  else n.delete(k.id);
                  setSel(n);
                }}
                label={
                  <span className="text-[13px]">
                    <b>{k.code}</b> – {k.name} <span className="text-xs text-muted">({k.perspectiveName})</span>
                  </span>
                }
              />
              {(kids.get(k.id) ?? []).map((c) => (
                <div key={c.id} className="ml-7 text-[12px] text-slate-600">
                  ↳ {c.code} – {c.name}
                </div>
              ))}
            </div>
          );
        })}
        {!roots.length && <div className="py-6 text-center text-sm text-muted">Không có dữ liệu</div>}
      </div>
    </Dialog>
  );
}
