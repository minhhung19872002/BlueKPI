export interface ApiResponse<T> {
  success: boolean;
  code: string;
  message?: string;
  data?: T;
  errors?: { field: string; message: string }[];
  traceId?: string;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface PageParams {
  page?: number;
  size?: number;
  sort?: string;
  [k: string]: unknown;
}

export interface MenuNode {
  code: string;
  name: string;
  route: string | null;
  icon?: string | null;
  permission?: string | null;
  children: MenuNode[];
}

export interface Me {
  user: {
    id: number;
    username: string;
    fullName: string;
    email: string;
    orgUnitId: number;
    orgUnitName: string;
    authMethod?: string;
  };
  roles: { code: string; name: string; dataScope: string; orgUnitId: number | null }[];
  permissions: string[];
  menu: MenuNode[];
  orgScope: { all: boolean; unitIds: number[] };
}

export interface Audited {
  id: number;
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
  version?: number;
}

export interface OrgTreeNode {
  id: number;
  code: string;
  name: string;
  shortName?: string;
  unitType: string;
  parentId: number | null;
  isKpiAssignable?: boolean;
  children?: OrgTreeNode[];
}

export interface ImportPreview {
  importToken: string;
  total: number;
  valid: number;
  invalid: number;
  columns: { key: string; header: string }[];
  rows: { row: number; data: Record<string, string | null>; status: string; errorMessage: string; valid: boolean }[];
}

export interface ImportCommitResult {
  imported: number;
  total: number;
  failed: number;
  errorFileId: number | null;
  message: string;
}
