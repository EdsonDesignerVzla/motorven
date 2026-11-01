import React, { useState } from 'react';
import {
  X,
  Truck,
  MapPin,
  Calendar,
  User,
  Phone,
  Package,
  Droplet,
  DollarSign,
  Printer,
  CheckCircle2,
  AlertCircle,
  Building2,
  Navigation,
  Weight
} from 'lucide-react';
import { formatUsd, formatBs } from '../services/formatService';
import { generateOrdersPDF } from '../services/pdfReportService';
import MotorvenLogo from './MotorvenLogo';

export default function DispatchRouteModal({
  zone,
  orders = [],
  transport,
  profitZones = [],
  profitTransports = [],
  config,
  currentUser = null,
  onClose
}) {
  const tasa = config?.tasaDolar || 827.73;

  const [selectedTransport, setSelectedTransport] = useState(
    transport?.coTran || '01'
  );
  const [driverName, setDriverName] = useState('Despachador Asignado');
  const [vehiclePlate, setVehiclePlate] = useState('CAMIÓN 01 (MOTORVEN)');
  const [dispatchDate, setDispatchDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  if (!zone && (!orders || orders.length === 0)) return null;

  const activeZoneObj = profitZones.find(z => z.coZon === (zone?.coZon || zone)) || {
    coZon: zone?.coZon || zone || '01',
    zonDes: zone?.zonDes || 'Circuito de Distribución'
  };

  const activeTransportObj = profitTransports.find(t => t.coTran === selectedTransport) || {
    coTran: '01',
    desTran: 'Flota Propia Motorven'
  };

  // Resumen de carga
  let totalCajas = 0;
  let totalLitros = 0;
  let totalMontoUsd = 0;

  const stops = orders.map((ord, idx) => {
    const items = Array.isArray(ord.items) ? ord.items : [];
    let ordLitros = 0;
    let ordCajas = 0;

    items.forEach(item => {
      const cant = Number(item.cantidad || 0);
      const ltsUnit = Number(item.litrosUnitarios || 12);
      const ltsTot = Number(item.litrosTotales || (cant * ltsUnit));
      ordLitros += ltsTot;
      ordCajas += cant;
    });

    totalLitros += ordLitros;
    totalCajas += ordCajas;
    totalMontoUsd += Number(ord.totalUsd || 0);

    return {
      paradaNum: idx + 1,
      orderId: ord.id || ord.orderNum,
      factNum: ord.factNum || ord.facturaNumero,
      cliente: ord.clienteNombre || ord.clientName || 'Cliente',
      rif: ord.clienteRif || ord.rif,
      direccion: ord.clienteDireccion || ord.direccion || 'Dirección de Entrega',
      telefono: ord.clienteTelefono || ord.telefono || 'Sin teléfono',
      vendedor: ord.vendedor || ord.seller || 'Asesor Comercial',
      formaPago: ord.formaPago || ord.paymentMethod || 'Contado',
      montoUsd: Number(ord.totalUsd || 0),
      cajas: ordCajas,
      litros: ordLitros,
      items: items
    };
  });

  // Estimación de peso en Kg (~0.88 kg por litro de lubricante + 0.5kg por empaque de cartón)
  const pesoEstimadoKg = Math.round((totalLitros * 0.88) + (totalCajas * 0.5));

  const handlePrint = () => {
    generateOrdersPDF({
      orders: orders.length > 0 ? orders : stops,
      config,
      currentUser
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content print-area"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '950px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.3) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6'
            }}>
              <Truck size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Hoja de Ruta & Guía de Despacho
                </h3>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '6px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#3b82f6',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}>
                  Zona {activeZoneObj.coZon}
                </span>
              </div>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {activeZoneObj.zonDes} • {stops.length} Paradas Programadas
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={handlePrint}
              className="btn btn-print-report btn-sm"
            >
              <Printer size={15} color="#ffffff" />
              <span>Imprimir Reporte</span>
            </button>
            <button
              onClick={onClose}
              className="btn btn-icon"
              style={{ color: 'var(--text-muted)', background: 'transparent' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ overflowY: 'auto', padding: '1.25rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Dispatch Controls (Configurable before print) */}
          <div style={{
            background: 'var(--bg-glass-accent)',
            border: '1px solid var(--border-glass)',
            borderRadius: '10px',
            padding: '1rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.85rem'
          }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                Transportista / Modalidad:
              </label>
              <select
                value={selectedTransport}
                onChange={(e) => setSelectedTransport(e.target.value)}
                className="input-field filter-select"
                style={{ fontSize: '0.85rem', width: '100%', height: '38px' }}
              >
                {profitTransports.map((t) => (
                  <option key={t.coTran} value={t.coTran}>
                    {t.desTran}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                Conductor / Chofer:
              </label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="input-field"
                style={{ fontSize: '0.85rem', width: '100%' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                Unidad / Placa:
              </label>
              <input
                type="text"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                className="input-field"
                style={{ fontSize: '0.85rem', width: '100%' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                Fecha de Salida:
              </label>
              <input
                type="date"
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
                className="input-field"
                style={{ fontSize: '0.85rem', width: '100%' }}
              />
            </div>
          </div>

          {/* Cargo Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <div className="card" style={{ padding: '0.75rem 1rem', margin: 0, background: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600 }}>
                <span>VOLUMEN TOTAL</span>
                <Droplet size={14} color="#3b82f6" />
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#3b82f6', marginTop: '0.2rem' }}>
                {totalLitros.toFixed(1)} <span style={{ fontSize: '0.8rem' }}>Litros</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {totalCajas} Cajas / Bultos
              </div>
            </div>

            <div className="card" style={{ padding: '0.75rem 1rem', margin: 0, background: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600 }}>
                <span>PESO ESTIMADO</span>
                <Weight size={14} color="#f59e0b" />
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.2rem' }}>
                {pesoEstimadoKg.toLocaleString('es-VE')} <span style={{ fontSize: '0.8rem' }}>Kg</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Carga útil calculada
              </div>
            </div>

            <div className="card" style={{ padding: '0.75rem 1rem', margin: 0, background: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600 }}>
                <span>TOTAL A COBRAR EN RUTA</span>
                <DollarSign size={14} color="#10b981" />
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', marginTop: '0.2rem' }}>
                {formatUsd(totalMontoUsd)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {formatBs(totalMontoUsd * tasa)}
              </div>
            </div>

            <div className="card" style={{ padding: '0.75rem 1rem', margin: 0, background: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600 }}>
                <span>PARADAS DE ENTREGA</span>
                <MapPin size={14} color="#7c3aed" />
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#7c3aed', marginTop: '0.2rem' }}>
                {stops.length} <span style={{ fontSize: '0.8rem' }}>Clientes</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Circuito {activeZoneObj.coZon}
              </div>
            </div>
          </div>

          {/* Delivery Stops Manifest */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', margin: 0, background: 'var(--bg-surface)' }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-glass-accent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                Secuencia de Paradas & Detalle de Despacho
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Tasa BCV: Bs. {tasa.toFixed(2)}
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-glass-accent)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '0.6rem 0.8rem', width: '40px', textAlign: 'center' }}>#</th>
                    <th style={{ padding: '0.6rem 0.8rem' }}>Cliente & Contacto</th>
                    <th style={{ padding: '0.6rem 0.8rem' }}>Dirección de Entrega</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>Carga</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>Monto a Cobrar</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>Firma Recepción</th>
                  </tr>
                </thead>
                <tbody>
                  {stops.map((stop) => (
                    <tr key={stop.orderId} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                      <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center', fontWeight: 800, color: 'var(--accent-primary)' }}>
                        {stop.paradaNum}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{stop.cliente}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          RIF: {stop.rif} • Telf: {stop.telefono}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          Asesor: {stop.vendedor} • Doc: #{stop.factNum || stop.orderId}
                        </div>
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', color: 'var(--text-secondary)', maxWidth: '240px' }}>
                        <div style={{ fontSize: '0.8rem' }}>{stop.direccion}</div>
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {stop.cajas} cajas
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: 600 }}>
                          {stop.litros.toFixed(1)} L
                        </div>
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: '#10b981' }}>
                          {formatUsd(stop.montoUsd)}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {formatBs(stop.montoUsd * tasa)}
                        </div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'var(--bg-glass-accent)', color: 'var(--text-secondary)' }}>
                          {stop.formaPago}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>
                        <div style={{ width: '120px', height: '35px', border: '1px dashed var(--border-glass)', borderRadius: '4px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          Sello / Firma
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Signatures for Official Manifest */}
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
            <div>
              <div style={{ width: '160px', borderBottom: '1px solid var(--border-glass)', marginBottom: '0.3rem' }} />
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{driverName}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Chofer / Despachador</div>
            </div>
            <div>
              <div style={{ width: '160px', borderBottom: '1px solid var(--border-glass)', marginBottom: '0.3rem' }} />
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Almacén & Despacho</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Control de Salida MOTORVEN</div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Manifiesto logístico generado con datos de Supabase
          </span>
          <button onClick={onClose} className="btn btn-secondary">
            Cerrar Hoja de Ruta
          </button>
        </div>
      </div>
    </div>
  );
}
