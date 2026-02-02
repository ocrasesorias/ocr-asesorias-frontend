export interface FacturaData {
  // Empresa
  empresa: {
    cif: string;
    trimestre: string;
    actividad: string;
  };
  
  // Proveedor/Acreedor
  proveedor: {
    nombre: string;
    cif: string;
    direccion: string;
    codigoPostal: string;
    provincia: string;
  };
  
  // Datos de la factura
  factura: {
    numero: string;
    fecha: string;
    fechaVencimiento: string;
  };
  
  // Gastos
  subcuentaGasto: string;
  retencion: {
    aplica: boolean;
    porcentaje: '15%' | '17%' | '19%' | '';
    tipo: 'AUTÓNOMO' | 'PROFESIONAL' | '';
    cantidad: string;
  };
  
  // Desglose de líneas
  lineas: Array<{
    base: string;
    porcentajeIva: string;
    cuotaIva: string;
    porcentajeRecargo: string;
    cuotaRecargo: string;
  }>;
  
  // Observaciones y total
  anexosObservaciones: string;
  total: string;
  
  // Archivo
  archivo?: {
    url: string;
    tipo: 'imagen' | 'pdf';
    nombre: string;
    invoiceId?: string;
    bucket?: string;
    storagePath?: string;
  };
}

