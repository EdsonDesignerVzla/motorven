import React, { useState, useMemo } from 'react';
import {
  X,
  TrendingUp,
  DollarSign,
  Package,
  Droplet,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Sliders,
  Users,
  ShoppingCart,
  Calendar,
  AlertCircle,
  Building2,
  Tag,
  Printer
} from 'lucide-react';
import { formatUsd, formatBs, formatUnitVe } from '../services/formatService';
import { generateProfitabilityPDF } from '../services/pdfReportService';

export default function SkuProfitabilityModal({
  product,
  profitInvoices = [],
  profitPurchases = [],
  clients = [],
  config,
  onClose
}) {
  const tasa = config?.tasaDolar || 827.73;

  // Costo y Precios base
  const costoUsd = Number(product?.costoUsd || product?.costo_usd || 0);
  const precioA = Number(product?.precioA || product?.precio_a || 0);
  const precioB = Number(product?.precioB || product?.precio_b || 0);
  const precioC = Number(product?.precioC || product?.precio_c || 0);
  const stock = Number(product?.stock || 0);
  const litrosPorUnidad = Number(product?.litrosPorUnidad || product?.litros_por_unidad || 12);

  // Simulador de sensibilidad de precios
  const [simulatedPrice, setSimulatedPrice] = useState(precioA || (costoUsd * 1.3));

  // Ventas reales en facturas de Profit para este producto
  const productSales = useMemo(() => {
    if (!product) return [];
    const list = [];
    profitInvoices.forEach((fac) => {
      if (fac.anulado) return;
      const items = Array.isArray(fac.items) ? fac.items : [];
      items.forEach((item) => {
        const itemCode = (item.articuloId || item.codigo || '').trim();
        const prodCode = (product.codigo || product.id || '').trim();
        if (itemCode === prodCode || (item.descripcion && item.descripcion.toLowerCase().includes((product.descripcion || '').toLowerCase().slice(0, 15)))) {
          list.push({
            factNum: fac.factNum || fac.id,
            fecha: fac.fechaEmision || fac.fec_emis,
            clienteNombre: fac.clienteNombre || fac.cli_des,
            clienteRif: fac.clienteRif || fac.rif,
            cantidad: Number(item.cantidad || 0),
            precioUnitario: Number(item.precioUnitario || 0),
            totalNetoBs: Number(item.totalNeto || 0),
            totalNetoUsd: fac.tasa && fac.tasa > 0 ? Number(item.totalNeto || 0) / fac.tasa : (fac.totNetoUsd || 0),
            litrosTotales: Number(item.litrosTotales || (Number(item.cantidad || 0) * litrosPorUnidad))
          });
        }
      });
    });
    return list;
  }, [profitInvoices, product, litrosPorUnidad]);

  // Compras reales en facturas de compra Profit para este producto
  const productPurchases = useMemo(() => {
    if (!product) return [];
    const list = [];
    profitPurchases.forEach((pur) => {
      if (pur.anulado) return;
      const items = Array.isArray(pur.items) ? pur.items : [];
      items.forEach((item) => {
        const itemCode = (item.coArt || item.co_art || item.articuloId || '').trim();
        const prodCode = (product.codigo || product.id || '').trim();
        if (itemCode === prodCode || (item.artDes && item.artDes.toLowerCase().includes((product.descripcion || '').toLowerCase().slice(0, 15)))) {
          list.push({
            factNum: pur.factNum,
            fecha: pur.fechaEmision,
            proveedor: pur.provNombre,
            cantidad: Number(item.totalArt || item.cantidad || 0),
            costoUnitarioBs: Number(item.costoUnit || item.costo_unit || 0),
            costoUnitarioUsd: pur.tasa && pur.tasa > 0 ? Number(item.costoUnit || item.costo_unit || 0) / pur.tasa : 0
          });
        }
      });
    });
    return list;
  }, [profitPurchases, product]);

  // Clientes que más compran este producto
  const topClients = useMemo(() => {
    if (!product) return [];
    const map = {};
    productSales.forEach((s) => {
      const cli = s.clienteNombre || 'Cliente General';
      if (!map[cli]) {
        map[cli] = { cliente: cli, rif: s.clienteRif, totalCant: 0, totalUsd: 0, totalLitros: 0, comprasCount: 0 };
      }
      map[cli].totalCant += s.cantidad;
      map[cli].totalUsd += s.totalNetoUsd;
      map[cli].totalLitros += s.litrosTotales;
      map[cli].comprasCount += 1;
    });
    return Object.values(map).sort((a, b) => b.totalUsd - a.totalUsd).slice(0, 5);
  }, [productSales, product]);

  if (!product) return null;

  // Métricas agregadas
  const totalVendidas = productSales.reduce((acc, s) => acc + s.cantidad, 0);
  const totalLitrosVendidos = productSales.reduce((acc, s) => acc + s.litrosTotales, 0);
  const totalFacturadoUsd = productSales.reduce((acc, s) => acc + s.totalNetoUsd, 0);
  const totalCmvUsd = totalVendidas * costoUsd;
  const totalUtilidadBrutaUsd = totalFacturadoUsd - totalCmvUsd;
  const margenPromedioReal = totalFacturadoUsd > 0 ? (totalUtilidadBrutaUsd / totalFacturadoUsd) * 100 : 0;

  // Métricas de lista A
  const margenUnitarioAUsd = precioA - costoUsd;
  const margenUnitarioAPct = precioA > 0 ? (margenUnitarioAUsd / precioA) * 100 : 0;

  // Métricas simuladas
  const simMargenUnitarioUsd = simulatedPrice - costoUsd;
  const simMargenPct = simulatedPrice > 0 ? (simMargenUnitarioUsd / simulatedPrice) * 100 : 0;
  const simUtilidadTotal = totalVendidas > 0 ? totalVendidas * simMargenUnitarioUsd : stock * simMargenUnitarioUsd;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '950px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.3) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981'
            }}>
              <TrendingUp size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {product.descripcion}
                </h3>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '6px',
                  background: 'var(--bg-glass-accent)',
                  color: 'var(--accent-primary)',
                  border: '1px solid var(--border-glass)'
                }}>
                  {product.codigo}
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '6px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#3b82f6',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}>
                  {product.categoria || 'Lubricantes'} • {product.viscosidad || 'SAE'}
                </span>
              </div>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Ficha Analítica 360° • Márgenes de Ganancia, Contribución y Simulación
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-icon"
            style={{ color: 'var(--text-muted)', background: 'transparent' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ overflowY: 'auto', padding: '1.25rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Top KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem' }}>
            <div className="card" style={{ padding: '0.85rem', margin: 0, background: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                <span>COSTO REPOSICIÓN</span>
                <DollarSign size={14} color="#64748b" />
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                {formatUsd(costoUsd)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {formatBs(costoUsd * tasa)}
              </div>
            </div>

            <div className="card" style={{ padding: '0.85rem', margin: 0, background: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                <span>PRECIO LISTA (A)</span>
                <Tag size={14} color="#3b82f6" />
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#3b82f6', marginTop: '0.25rem' }}>
                {formatUsd(precioA)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {formatBs(precioA * tasa)}
              </div>
            </div>

            <div className="card" style={{ padding: '0.85rem', margin: 0, background: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                <span>MARGEN UNITARIO (A)</span>
                <Percent size={14} color="#10b981" />
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>
                {formatUsd(margenUnitarioAUsd)}
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: margenUnitarioAPct >= 20 ? '#10b981' : '#f59e0b' }}>
                {margenUnitarioAPct.toFixed(1)}% Margen Bruto
              </div>
            </div>

            <div className="card" style={{ padding: '0.85rem', margin: 0, background: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                <span>STOCK DISPONIBLE</span>
                <Package size={14} color="#f59e0b" />
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                {formatUnitVe(stock, 0)} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>cajas / unid</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {formatUnitVe(stock * litrosPorUnidad)} Litros en Almacén
              </div>
            </div>
          </div>

          {/* Simulated Sensitivity Box */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(16, 185, 129, 0.08) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: '12px',
            padding: '1.15rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sliders size={18} color="#3b82f6" />
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  Simulador de Sensibilidad de Precios & Margen
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Ajuste el precio para proyectar la rentabilidad
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', alignItems: 'center' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                  Precio de Venta Simulado ($)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="number"
                    step="0.01"
                    min={costoUsd}
                    value={simulatedPrice}
                    onChange={(e) => setSimulatedPrice(parseFloat(e.target.value) || 0)}
                    className="input-field"
                    style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', width: '130px' }}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {formatBs(simulatedPrice * tasa)}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ background: 'var(--bg-surface)', padding: '0.65rem 1rem', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>MARGEN SIMULADO</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: simMargenPct >= 20 ? '#10b981' : simMargenPct > 0 ? '#f59e0b' : '#ef4444' }}>
                    {simMargenPct.toFixed(1)}% <span style={{ fontSize: '0.8rem' }}>({formatUsd(simMargenUnitarioUsd)})</span>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: '0.65rem 1rem', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>UTILIDAD ESTIMADA</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#3b82f6' }}>
                    {formatUsd(simUtilidadTotal)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Real Historical Sales & Margin Performance */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {/* Sales Summary Card */}
            <div className="card" style={{ padding: '1rem', margin: 0, background: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <ShoppingCart size={16} color="#3b82f6" />
                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  Rendimiento Histórico en Ventas (Profit)
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Unidades Vendidas:</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{totalVendidas} unid</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Volumen Colocado:</span>
                  <span style={{ fontWeight: 700, color: '#3b82f6' }}>{formatUnitVe(totalLitrosVendidos)} Litros</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Facturación Neta:</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatUsd(totalFacturadoUsd)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Costo Total (CMV):</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{formatUsd(totalCmvUsd)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.5rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Utilidad Bruta Total:</span>
                  <span style={{ fontWeight: 800, color: totalUtilidadBrutaUsd >= 0 ? '#10b981' : '#ef4444' }}>
                    {formatUsd(totalUtilidadBrutaUsd)} ({margenPromedioReal.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Top Clients for this SKU */}
            <div className="card" style={{ padding: '1rem', margin: 0, background: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Users size={16} color="#10b981" />
                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  Top Clientes Compradores
                </span>
              </div>
              {topClients.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No hay ventas registradas para este producto aún.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {topClients.map((cli, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '6px',
                        background: 'var(--bg-glass-accent)',
                        fontSize: '0.8rem'
                      }}
                    >
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{cli.cliente}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatUnitVe(cli.totalCant, 0)} cajas • {formatUnitVe(cli.totalLitros)} L</div>
                      </div>
                      <div style={{ fontWeight: 800, color: '#10b981' }}>
                        {formatUsd(cli.totalUsd)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Purchases History (Profit Compras) */}
          {productPurchases.length > 0 && (
            <div className="card" style={{ padding: '1rem', margin: 0, background: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Building2 size={16} color="#f59e0b" />
                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  Historial de Compras & Costos en Profit Plus ({productPurchases.length})
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '0.4rem' }}>Factura / Doc</th>
                      <th style={{ padding: '0.4rem' }}>Fecha</th>
                      <th style={{ padding: '0.4rem' }}>Proveedor</th>
                      <th style={{ padding: '0.4rem', textAlign: 'right' }}>Cantidad</th>
                      <th style={{ padding: '0.4rem', textAlign: 'right' }}>Costo USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productPurchases.slice(0, 5).map((pur, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                        <td style={{ padding: '0.4rem', fontWeight: 600, color: 'var(--text-primary)' }}>#{pur.factNum}</td>
                        <td style={{ padding: '0.4rem', color: 'var(--text-muted)' }}>
                          {pur.fecha ? new Date(pur.fecha).toLocaleDateString('es-VE') : 'N/A'}
                        </td>
                        <td style={{ padding: '0.4rem', color: 'var(--text-secondary)' }}>{pur.proveedor || 'Proveedor'}</td>
                        <td style={{ padding: '0.4rem', textAlign: 'right', fontWeight: 600 }}>{pur.cantidad}</td>
                        <td style={{ padding: '0.4rem', textAlign: 'right', fontWeight: 700, color: '#f59e0b' }}>
                          {formatUsd(pur.costoUnitarioUsd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center' }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ fontSize: '0.82rem' }}>
            Cerrar Ficha
          </button>
          <button
            onClick={() => {
              generateProfitabilityPDF({
                products: [product],
                sales: productSales,
                config,
                currentUser: null
              });
            }}
            className="btn btn-print-report"
            style={{ fontSize: '0.82rem' }}
            title="Descargar análisis de rentabilidad y margen de este producto en PDF"
          >
            <Printer size={15} color="#ffffff" /> Imprimir Reporte
          </button>
        </div>
      </div>
    </div>
  );
}
