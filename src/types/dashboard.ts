export interface Cliente {
  id: string;
  org_id: string;
  name: string;
  tax_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubidaFacturas {
  id: string;
  clienteId: string;
  nombre: string;
  fechaCreacion: string;
  estado: 'pendiente' | 'procesando' | 'completada';
  archivos: ArchivoSubido[];
}

export interface ArchivoSubido {
  id: string;
  nombre: string;
  tamaño: number;
  tipo: string;
  url: string;
  bucket?: string;
  storagePath?: string;
  fechaSubida: string;
  estado: 'pendiente' | 'procesando' | 'procesado' | 'error';
}

