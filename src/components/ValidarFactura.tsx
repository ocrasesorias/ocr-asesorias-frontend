'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { FacturaData } from '@/types/factura';
import { Card } from './Card';
import { Button } from './Button';

interface ValidarFacturaProps {
  factura: FacturaData;
  onValidar: (factura: FacturaData) => void;
  onSiguiente: () => void;
}

export const ValidarFactura: React.FC<ValidarFacturaProps> = ({
  factura: facturaInicial,
  onValidar,
  onSiguiente
}) => {
  const facturaInicialCon3Lineas = useMemo(() => {
    // Asegurar que siempre haya al menos 3 líneas con IVA 21%, 10% y 4%
    const lineasBase = facturaInicial.lineas.length >= 3 
      ? [...facturaInicial.lineas]
      : [
          ...facturaInicial.lineas,
          ...Array(3 - facturaInicial.lineas.length).fill(null).map((_, index) => {
            // Asignar IVA según la posición: primera línea 21%, segunda 10%, tercera 4%
            const ivas = ['21', '10', '4'];
            const ivaIndex = facturaInicial.lineas.length + index;
            return {
              base: '',
              porcentajeIva: ivas[ivaIndex] || '',
              cuotaIva: '',
              porcentajeRecargo: '0',
              cuotaRecargo: '0.00'
            };
          })
        ];
    
    // Asegurar que las 3 líneas tengan IVA 21%, 10% y 4% respectivamente
    const lineas = lineasBase.length >= 3
      ? [
          { ...lineasBase[0], porcentajeIva: lineasBase[0].porcentajeIva || '21' },
          { ...lineasBase[1], porcentajeIva: lineasBase[1].porcentajeIva || '10' },
          { ...lineasBase[2], porcentajeIva: lineasBase[2].porcentajeIva || '4' }
        ]
      : lineasBase;
    
    return { ...facturaInicial, lineas };
  }, [facturaInicial]);

  const [factura, setFactura] = useState<FacturaData>(facturaInicialCon3Lineas);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setFactura(facturaInicialCon3Lineas);
  }, [facturaInicialCon3Lineas]);

  const handleChange = (path: string, value: string | boolean) => {
    setFactura(prev => {
      const keys = path.split('.');
      const newFactura = { ...prev };
      let current: Record<string, unknown> = newFactura;
      
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        const nextValue = current[key];
        current = current[key] = { ...(nextValue as Record<string, unknown>) };
      }
      
      current[keys[keys.length - 1]] = value;
      return newFactura;
    });
  };

  const handleLineaChange = (index: number, field: string, value: string) => {
    // Remover el símbolo € si está presente
    const valorLimpio = value.replace('€', '').trim();
    setFactura(prev => {
      const newLineas = [...prev.lineas];
      newLineas[index] = { ...newLineas[index], [field]: valorLimpio };
      return { ...prev, lineas: newLineas };
    });
  };

  const formatearMoneda = (valor: string) => {
    if (!valor || valor.trim() === '') return '';
    return valor + '€';
  };

  const agregarLinea = () => {
    setFactura(prev => ({
      ...prev,
      lineas: [
        ...prev.lineas,
        {
          base: '',
          porcentajeIva: '',
          cuotaIva: '',
          porcentajeRecargo: '',
          cuotaRecargo: ''
        }
      ]
    }));
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onValidar(factura);
    onSiguiente();
  };

  // El formulario manejará automáticamente el Enter en los campos
  // Solo necesitamos prevenir el submit en textareas

  const trimestres = ['Q1', 'Q2', 'Q3', 'Q4'];
  const porcentajesRetencion = ['15%', '17%', '19%'];
  const tiposRetencion = ['AUTÓNOMO', 'PROFESIONAL'];

  return (
    <div className="bg-background p-1 flex flex-col min-h-0">
      <form ref={formRef} onSubmit={handleSubmit} className="grid grid-cols-2 gap-1 min-h-0">
        {/* Columna izquierda: Imagen/PDF de la factura */}
        <div className="overflow-hidden">
          <Card variant="elevated" className="p-1 h-full flex flex-col">
            <h2 className="text-[10px] font-semibold text-foreground mb-0.5">
              Factura
            </h2>
            <div className="flex-1 overflow-hidden">
              {factura.archivo?.tipo === 'pdf' ? (
                <div className="w-full h-full border border-gray-200 rounded flex items-center justify-center bg-gray-50">
                  <iframe
                    src={factura.archivo.url}
                    className="w-full h-full rounded"
                    title="Vista previa PDF"
                  />
                </div>
              ) : (
                <div className="w-full h-full border border-gray-200 rounded overflow-hidden bg-gray-50 relative">
                  {factura.archivo?.url ? (
                    <Image
                      src={factura.archivo.url}
                      alt="Factura"
                      fill
                      className="object-contain"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  ) : (
                    <Image
                      src="/img/placeholder-invoice.png"
                      alt="Placeholder factura"
                      fill
                      className="object-contain"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Columna derecha: Campos editables */}
        <div className="overflow-hidden flex flex-col space-y-0.5">
          {/* Empresa */}
          <Card variant="outlined" className="p-1">
            <h3 className="text-[10px] font-semibold text-foreground mb-0.5">
              EMPRESA
            </h3>
            <div className="grid grid-cols-[2fr_2fr_0.5fr] gap-0.5">
              <div>
                <label className="block text-[10px] font-medium text-foreground mb-0.5">
                  CIF
                </label>
                <input
                  type="text"
                  value={factura.empresa.cif}
                  onChange={(e) => handleChange('empresa.cif', e.target.value)}
                  className="w-full px-1 py-0.5 text-[10px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-foreground mb-0.5">
                  ACTIVIDAD
                </label>
                <input
                  type="text"
                  value={factura.empresa.actividad}
                  onChange={(e) => handleChange('empresa.actividad', e.target.value)}
                  className="w-full px-1 py-0.5 text-[10px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-foreground mb-0.5">
                  TRIMESTRE
                </label>
                <select
                  value={factura.empresa.trimestre}
                  onChange={(e) => handleChange('empresa.trimestre', e.target.value)}
                  className="w-full px-1 py-0.5 text-[10px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                >
                  <option value="">-</option>
                  {trimestres.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Proveedor/Acreedor */}
          <Card variant="outlined" className="p-1">
            <h3 className="text-[10px] font-semibold text-foreground mb-0.5">
              PROVEEDOR
            </h3>
            <div className="space-y-0.5">
              <div>
                <label className="block text-[10px] font-medium text-foreground mb-0.5">
                  NOMBRE
                </label>
                <input
                  type="text"
                  value={factura.proveedor.nombre}
                  onChange={(e) => handleChange('proveedor.nombre', e.target.value)}
                  className="w-full px-1 py-0.5 text-[10px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-3 gap-0.5">
                <div>
                  <label className="block text-[10px] font-medium text-foreground mb-0.5">
                    CIF
                  </label>
                  <input
                    type="text"
                    value={factura.proveedor.cif}
                    onChange={(e) => handleChange('proveedor.cif', e.target.value)}
                    className="w-full px-1 py-0.5 text-[10px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-foreground mb-0.5">
                    C. POSTAL
                  </label>
                  <input
                    type="text"
                    value={factura.proveedor.codigoPostal}
                    onChange={(e) => handleChange('proveedor.codigoPostal', e.target.value)}
                    className="w-full px-1 py-0.5 text-[10px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-foreground mb-0.5">
                    PROVINCIA
                  </label>
                  <input
                    type="text"
                    value={factura.proveedor.provincia}
                    onChange={(e) => handleChange('proveedor.provincia', e.target.value)}
                    className="w-full px-1 py-0.5 text-[10px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-foreground mb-0.5">
                  DIRECCIÓN
                </label>
                <input
                  type="text"
                  value={factura.proveedor.direccion}
                  onChange={(e) => handleChange('proveedor.direccion', e.target.value)}
                  className="w-full px-1 py-0.5 text-[10px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
          </Card>

          {/* Datos de la factura */}
          <Card variant="outlined" className="p-1">
            <h3 className="text-[10px] font-semibold text-foreground mb-0.5">
              DATOS FACTURA
            </h3>
            <div className="grid grid-cols-3 gap-0.5">
              <div>
                <label className="block text-[10px] font-medium text-foreground mb-0.5">
                  Nº
                </label>
                <input
                  type="text"
                  value={factura.factura.numero}
                  onChange={(e) => handleChange('factura.numero', e.target.value)}
                  className="w-full px-1 py-0.5 text-[10px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-foreground mb-0.5">
                  FECHA
                </label>
                <input
                  type="date"
                  value={factura.factura.fecha}
                  onChange={(e) => handleChange('factura.fecha', e.target.value)}
                  className="w-full px-1 py-0.5 text-[10px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-foreground mb-0.5">
                  VENC.
                </label>
                <input
                  type="date"
                  value={factura.factura.fechaVencimiento}
                  onChange={(e) => handleChange('factura.fechaVencimiento', e.target.value)}
                  className="w-full px-1 py-0.5 text-[10px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
          </Card>

          {/* Subcuenta de gasto */}
          <Card variant="outlined" className="p-1">
            <label className="block text-[10px] font-medium text-foreground mb-0.5">
              SUBCUENTA DE GASTO
            </label>
            <select
              value={factura.subcuentaGasto}
              onChange={(e) => handleChange('subcuentaGasto', e.target.value)}
              className="w-full px-1 py-0.5 text-[10px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
            >
              <option value="">-</option>
              <option value="600">600</option>
              <option value="620">620</option>
              <option value="621">621</option>
              <option value="628">628</option>
            </select>
          </Card>

          {/* Tabla de desglose */}
          <Card variant="outlined" className="p-1">
            <div className="flex justify-between items-center mb-0.5">
              <h3 className="text-[10px] font-semibold text-foreground">
                DESGLOSE
              </h3>
              <button
                type="button"
                onClick={agregarLinea}
                className="text-[9px] px-1 py-0.5 border border-gray-200 rounded hover:bg-gray-50"
              >
                + Línea
              </button>
            </div>
            <div className="overflow-hidden">
              <table className="w-full border-collapse text-[9px]">
                <colgroup>
                  <col className="w-auto" />
                  <col className="w-12" />
                  <col className="w-auto" />
                  <col className="w-12" />
                  <col className="w-auto" />
                </colgroup>
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-200 px-0.5 py-0.5 text-left font-semibold">BASE</th>
                    <th className="border border-gray-200 px-0.5 py-0.5 text-left font-semibold">% IVA</th>
                    <th className="border border-gray-200 px-0.5 py-0.5 text-left font-semibold">CUOTA</th>
                    <th className="border border-gray-200 px-0.5 py-0.5 text-left font-semibold">% REC</th>
                    <th className="border border-gray-200 px-0.5 py-0.5 text-left font-semibold">CUOTA REC</th>
                  </tr>
                </thead>
                <tbody>
                  {factura.lineas.map((linea, index) => (
                    <tr key={index}>
                      <td className="border border-gray-200 px-0.5 py-0.5">
                        <input
                          type="text"
                          value={formatearMoneda(linea.base)}
                          onChange={(e) => handleLineaChange(index, 'base', e.target.value)}
                          className="w-full px-0.5 py-0.5 border-0 focus:ring-1 focus:ring-primary rounded text-[9px]"
                        />
                      </td>
                      <td className="border border-gray-200 px-0.5 py-0.5">
                        <input
                          type="text"
                          value={linea.porcentajeIva}
                          onChange={(e) => handleLineaChange(index, 'porcentajeIva', e.target.value)}
                          className="w-full px-0.5 py-0.5 border-0 focus:ring-1 focus:ring-primary rounded text-[9px]"
                        />
                      </td>
                      <td className="border border-gray-200 px-0.5 py-0.5">
                        <input
                          type="text"
                          value={formatearMoneda(linea.cuotaIva)}
                          onChange={(e) => handleLineaChange(index, 'cuotaIva', e.target.value)}
                          className="w-full px-0.5 py-0.5 border-0 focus:ring-1 focus:ring-primary rounded text-[9px]"
                        />
                      </td>
                      <td className="border border-gray-200 px-0.5 py-0.5">
                        <input
                          type="text"
                          value={linea.porcentajeRecargo}
                          onChange={(e) => handleLineaChange(index, 'porcentajeRecargo', e.target.value)}
                          className="w-full px-0.5 py-0.5 border-0 focus:ring-1 focus:ring-primary rounded text-[9px]"
                        />
                      </td>
                      <td className="border border-gray-200 px-0.5 py-0.5">
                        <input
                          type="text"
                          value={formatearMoneda(linea.cuotaRecargo)}
                          onChange={(e) => handleLineaChange(index, 'cuotaRecargo', e.target.value)}
                          className="w-full px-0.5 py-0.5 border-0 focus:ring-1 focus:ring-primary rounded text-[9px]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Retención */}
          <Card variant="outlined" className="p-1">
            <div className="grid grid-cols-5 gap-1">
              <div>
                <label className="block text-[10px] font-medium text-foreground mb-0.5">
                  RETENCIÓN
                </label>
                <label className="flex items-center h-[22px]">
                  <input
                    type="checkbox"
                    checked={factura.retencion.aplica}
                    onChange={(e) => handleChange('retencion.aplica', e.target.checked)}
                    className="mr-0.5"
                  />
                  <span className="text-[10px]">SI</span>
                </label>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-foreground mb-0.5">
                  TIPO
                </label>
                <select
                  value={factura.retencion.tipo}
                  onChange={(e) => handleChange('retencion.tipo', e.target.value)}
                  disabled={!factura.retencion.aplica}
                  className="w-full px-1 py-0.5 text-[10px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">-</option>
                  {tiposRetencion.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-foreground mb-0.5">
                  %
                </label>
                <select
                  value={factura.retencion.porcentaje}
                  onChange={(e) => handleChange('retencion.porcentaje', e.target.value)}
                  disabled={!factura.retencion.aplica}
                  className="w-full px-1 py-0.5 text-[10px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">-</option>
                  {porcentajesRetencion.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-foreground mb-0.5">
                  CANTIDAD
                </label>
                <input
                  type="text"
                  value={formatearMoneda(factura.retencion.cantidad)}
                  onChange={(e) => {
                    const valorLimpio = e.target.value.replace('€', '').trim();
                    handleChange('retencion.cantidad', valorLimpio);
                  }}
                  disabled={!factura.retencion.aplica}
                  className="w-full px-1 py-0.5 text-[10px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="0.00€"
                />
              </div>
              <div></div>
            </div>
          </Card>

          {/* Anexos/Observaciones y Total */}
          <Card variant="outlined" className="p-1">
            <div className="grid grid-cols-2 gap-1 mb-1">
              <div>
                <label className="block text-[10px] font-medium text-foreground mb-0.5">
                  OBSERVACIONES
                </label>
                <textarea
                  value={factura.anexosObservaciones}
                  onChange={(e) => handleChange('anexosObservaciones', e.target.value)}
                  onKeyDown={(e) => {
                    // Permitir Enter en textarea, pero Ctrl+Enter o Cmd+Enter para submit
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleSubmit(e as unknown as React.FormEvent);
                    }
                  }}
                  rows={5}
                  className="w-full px-1 py-0.5 text-[9px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent resize-none"
                  placeholder="Albarán, ticket..."
                />
              </div>
              <div className="flex flex-col">
                <label className="block text-[10px] font-medium text-foreground mb-0.5">
                  TOTAL
                </label>
                <input
                  type="text"
                  value={formatearMoneda(factura.total)}
                  onChange={(e) => {
                    const valorLimpio = e.target.value.replace('€', '').trim();
                    handleChange('total', valorLimpio);
                  }}
                  className="w-full px-1 py-0.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent font-semibold mb-1"
                />
                <Button
                  variant="secondary"
                  size="md"
                  type="submit"
                  className="w-full text-sm py-2 font-bold ml-auto"
                >
                  VALIDAR
                </Button>
              </div>
            </div>
            {/* Botón oculto para permitir submit con Enter desde cualquier campo */}
            <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
          </Card>
        </div>
      </form>
    </div>
  );
};

