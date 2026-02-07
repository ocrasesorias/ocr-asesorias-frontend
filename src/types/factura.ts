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
    porcentaje: '7%' | '15%' | '19%' | '';
    tipo: 'PROFESIONAL' | 'ALQUILERES' | '';
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

  /** Inversión del sujeto pasivo (Art. 196): IVA repercutido por el destinatario; cuota IVA = 0 */
  inversion_sujeto_pasivo?: boolean;

  /** Clasificación del documento: factura, albarán, nota de entrega u otro */
  tipo_documento?: 'factura' | 'albaran' | 'nota_entrega' | 'otro';
}

