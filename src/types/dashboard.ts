export interface Cliente {
  id: string;
  org_id: string;
  name: string;
  tax_id: string | null;
  preferred_income_account?: string | null;
  preferred_expense_account?: string | null;
  activity_description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubidaFacturas {
  id: string;
  uploadId?: string; // uuid real en DB (tabla uploads)
  clienteId: string;
  tipo: 'gasto' | 'ingreso';
  nombre: string;
  fechaCreacion: string;
  estado: 'pendiente' | 'procesando' | 'completada';
  archivos: ArchivoSubido[];
}

export interface ArchivoSubido {
  id: string;
  invoiceId?: string;
  nombre: string;
  tamaño: number;
  tipo: string;
  url: string;
  bucket?: string;
  storagePath?: string;
  fechaSubida: string;
  estado: 'pendiente' | 'procesando' | 'procesado' | 'error';
  // Estado real en BD (tabla invoices)
  dbStatus?: 'uploaded' | 'processing' | 'needs_review' | 'ready' | 'error' | null;
  dbErrorMessage?: string | null;
}

