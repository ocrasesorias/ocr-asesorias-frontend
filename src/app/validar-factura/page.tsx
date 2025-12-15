'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ValidarFactura } from '@/components/ValidarFactura';
import { FacturaData } from '@/types/factura';
import { ArchivoSubido } from '@/types/dashboard';
import { Button } from '@/components/Button';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/contexts/ToastContext';

// Función para convertir archivos en facturas
const convertirArchivosAFacturas = (archivos: ArchivoSubido[], clienteCif?: string): FacturaData[] => {
  return archivos.map((archivo) => ({
    empresa: {
      cif: clienteCif || 'B12345678',
      trimestre: 'Q1',
      actividad: ''
    },
    proveedor: {
      nombre: '',
      cif: '',
      direccion: '',
      codigoPostal: '',
      provincia: ''
    },
    factura: {
      numero: '',
      fecha: '',
      fechaVencimiento: ''
    },
    subcuentaGasto: '',
    retencion: {
      aplica: false,
      porcentaje: '',
      tipo: '',
      cantidad: ''
    },
    lineas: [
      {
        base: '',
        porcentajeIva: '21',
        cuotaIva: '',
        porcentajeRecargo: '0',
        cuotaRecargo: '0.00'
      },
      {
        base: '',
        porcentajeIva: '10',
        cuotaIva: '',
        porcentajeRecargo: '0',
        cuotaRecargo: '0.00'
      },
      {
        base: '',
        porcentajeIva: '4',
        cuotaIva: '',
        porcentajeRecargo: '0',
        cuotaRecargo: '0.00'
      }
    ],
    anexosObservaciones: '',
    total: '',
    archivo: {
      url: archivo.url,
      tipo: archivo.tipo === 'application/pdf' ? 'pdf' : 'imagen',
      nombre: archivo.nombre
    }
  }));
};

export default function ValidarFacturaPage() {
  const router = useRouter();
  const { showSuccess } = useToast();
  const [facturaActual, setFacturaActual] = useState(0);
  const [facturas, setFacturas] = useState<FacturaData[]>([]);
  const [clienteNombre, setClienteNombre] = useState<string>('');
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    const init = async () => {
      // 1) Proteger: requiere sesión
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login?redirect=/validar-factura');
        return;
      }

      // 2) Cargar datos desde sessionStorage
      const archivosStr = sessionStorage.getItem('archivosSubidos');
      const clienteStr = sessionStorage.getItem('clienteSeleccionado');

      if (archivosStr) {
        try {
          const archivosRaw: ArchivoSubido[] = JSON.parse(archivosStr);
          const cliente = clienteStr ? JSON.parse(clienteStr) : null;
          // MVP sin backend: usamos las URLs tal cual vienen del dashboard (blob/local)
          const archivos: ArchivoSubido[] = archivosRaw;

          if (archivos.length > 0) {
            const facturasConvertidas = convertirArchivosAFacturas(
              archivos,
              cliente?.tax_id || undefined
            );
            setFacturas(facturasConvertidas);
            setClienteNombre(cliente?.name || '');
          }
        } catch (error) {
          console.error('Error al cargar archivos:', error);
        }
      }

      setIsCheckingSession(false);
    };

    init();
  }, [router]);

  const handleValidar = (factura: FacturaData) => {
    // Aquí se guardaría la factura validada en el backend o estado global
    // Por ahora, actualizamos la factura en el array
    setFacturas(prev => {
      const nuevas = [...prev];
      nuevas[facturaActual] = factura;
      return nuevas;
    });

    const isLast = facturaActual === facturas.length - 1;
    showSuccess(isLast ? 'Factura validada. Has completado todas.' : 'Factura validada');
  };

  const handleSiguiente = () => {
    if (facturaActual < facturas.length - 1) {
      setFacturaActual(facturaActual + 1);
    } else {
      // Todas las facturas validadas
      // Opcional: redirigir al dashboard
      // router.push('/dashboard');
    }
  };

  const handleAnterior = () => {
    if (facturaActual > 0) {
      setFacturaActual(facturaActual - 1);
    }
  };

  const handleVolverDashboard = () => {
    router.push('/dashboard');
  };

  if (isCheckingSession) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-foreground-secondary">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (facturas.length === 0) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            No hay facturas para validar
          </h2>
          <p className="text-foreground-secondary mb-6">
            Sube facturas desde el dashboard para comenzar el proceso de validación
          </p>
          <Button variant="primary" onClick={handleVolverDashboard}>
            Volver al Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen h-screen bg-background flex flex-col">
      {/* Header con navegación */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className="text-primary hover:text-primary-hover">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-sm font-semibold text-foreground">
              {clienteNombre ? `${clienteNombre} · ` : ''}Validar facturas
            </h1>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-xs text-foreground-secondary">
            {facturaActual + 1} de {facturas.length}
          </span>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAnterior}
              disabled={facturaActual === 0}
              className="py-2"
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSiguiente}
              disabled={facturaActual === facturas.length - 1}
              className="py-2"
            >
              Siguiente
            </Button>
          </div>
        </div>
      </div>

      {/* Componente de validación */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <ValidarFactura
          factura={facturas[facturaActual]}
          onValidar={handleValidar}
          onSiguiente={handleSiguiente}
        />
      </div>
    </div>
  );
}

