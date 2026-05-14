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
    poblacion: string;
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
    tipoExencion?: string;
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

  // ---------------------------------------------------------------------------
  // M1: Enlace a factura rectificada (Contasol IVS cols AA-AC / IVR cols Y-AA)
  // Se rellenan cuando la factura actual es rectificativa.
  // ---------------------------------------------------------------------------
  numero_rectificado?: string;
  fecha_rectificada?: string;       // ISO YYYY-MM-DD o DD/MM/AAAA
  total_rectificado?: string;       // numérico en string (igual que `total`)

  // ---------------------------------------------------------------------------
  // M5: Bien de inversión (Contasol IVS cols Z, BF, BG)
  // ---------------------------------------------------------------------------
  es_bien_inversion?: boolean;
  fecha_inicio_uso?: string;        // fecha de puesta en uso del bien
  prorrata_definitiva?: string;     // % 0-100 (numérico en string)
}

