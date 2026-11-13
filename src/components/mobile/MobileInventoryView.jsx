import React, { useState, useMemo } from 'react';
import {
  Search,
  Package,
  Layers,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  ShoppingCart
} from 'lucide-react';
import OilstoneProductImage from '../OilstoneProductImage';
import { formatUsd, formatBs, formatUnitVe, getProductWarehouseStocks, resolveProductUnit } from '../../services/formatService';

export default function MobileInventoryView({
  products = [],
  config = {},
  onSelectProductForOrder
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedViscosity, setSelectedViscosity] = useState('TODOS');

  const tasaBcv = Number(config?.tasaDolar || 827.73);

  // Extraer viscosidades únicas para los chips
  const viscosities = useMemo(() => {
    const list = new Set();
    products.forEach(p => {
      const desc = String(p.descripcion || p.name || '').toUpperCase();
      if (desc.includes('15W-40')) list.add('15W-40');
      else if (desc.includes('20W-50')) list.add('20W-50');
      else if (desc.includes('50') || desc.includes('SAE 50')) list.add('SAE 50');
      else if (desc.includes('4 TIEMPOS') || desc.includes('4T') || desc.includes('2 TIEMPOS')) list.add('MOTOS 4T/2T');
      else if (desc.includes('HIDRAULICO') || desc.includes('AW68')) list.add('HIDRÁULICOS');
      else if (desc.includes('85W-140') || desc.includes('TRANSMISION') || desc.includes('VALVULINA')) list.add('VALVULINA');
      else list.add('OTROS');
    });
    return ['TODOS', ...Array.from(list)];
  }, [products]);

  // Filtrado de productos
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const desc = String(p.descripcion || p.name || '').toLowerCase();
      const cod = String(p.codigo || p.id || '').toLowerCase();
      const matchSearch = desc.includes(searchTerm.toLowerCase()) || cod.includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      if (selectedViscosity === 'TODOS') return true;

      const upperDesc = desc.toUpperCase();
      if (selectedViscosity === '15W-40') return upperDesc.includes('15W-40');
      if (selectedViscosity === '20W-50') return upperDesc.includes('20W-50');
      if (selectedViscosity === 'SAE 50') return upperDesc.includes('50') || upperDesc.includes('SAE 50');
      if (selectedViscosity === 'MOTOS 4T/2T') return upperDesc.includes('4 TIEMPOS') || upperDesc.includes('4T') || upperDesc.includes('2 TIEMPOS');
      if (selectedViscosity === 'HIDRÁULICOS') return upperDesc.includes('HIDRAULICO') || upperDesc.includes('AW68');
      if (selectedViscosity === 'VALVULINA') return upperDesc.includes('85W-140') || upperDesc.includes('TRANSMISION');
      return true;
    });
  }, [products, searchTerm, selectedViscosity]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      
      {/* 1. Barra de Búsqueda */}
      <div className="mobile-search-bar" style={{ margin: 0 }}>
        <Search size={16} color="#94a3b8" />
        <input
          type="text"
          className="mobile-search-input"
          placeholder="Buscar lubricante Oilstone por viscosidad o código..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* 2. Chips Horizontales de Viscosidad */}
      <div className="mobile-chips-row" style={{ margin: 0 }}>
        {viscosities.map(visc => (
          <button
            key={visc}
            type="button"
            className={`mobile-chip ${selectedViscosity === visc ? 'active' : ''}`}
            onClick={() => setSelectedViscosity(visc)}
          >
            {visc}
          </button>
        ))}
      </div>

      {/* 3. Cantidad de resultados */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: '#94a3b8', padding: '0 4px' }}>
        <span>Catálogo Oficial Oilstone</span>
        <span>Mostrando <strong>{filteredProducts.length}</strong> de {products.length}</span>
      </div>

      {/* 4. Lista de Productos en Tarjetas Táctiles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredProducts.map(prod => {
          const precioUsd = Number(prod.precioUsdDetal || prod.precio_usd_detal || prod.precio || 0);
          const precioBs = precioUsd * tasaBcv;
          const wStocks = getProductWarehouseStocks(prod);
          const stock = wStocks.total > 0 ? wStocks.total : (Number(prod.stockActual || prod.stock_actual || prod.stock || 0) || 0);
          const unit = resolveProductUnit(prod);

          const isAgotado = stock <= 0;
          const isBajo = stock > 0 && stock <= 10;

          return (
            <div
              key={prod.id || prod.codigo}
              className="mobile-card"
              style={{
                display: 'flex',
                gap: '12px',
                padding: '0.85rem',
                alignItems: 'center'
              }}
            >
              {/* Imagen del Producto */}
              <div
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  overflow: 'hidden',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                <OilstoneProductImage
                  product={prod}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>

              {/* Información */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {prod.descripcion || prod.name}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>
                  Código: <code>{prod.codigo || prod.id}</code> • {unit}
                </div>

                {/* Precios USD / Bs */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
                  <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#10b981', fontFamily: 'monospace' }}>
                    {formatUsd(precioUsd)}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', fontFamily: 'monospace' }}>
                    {formatBs(precioBs)}
                  </span>
                </div>

                {/* Desglose por Almacén 01 (Fiscal) y 02 (N.E.) */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '5px' }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 6px', borderRadius: '5px', background: 'rgba(59, 130, 246, 0.14)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                    Alm 01: {formatUnitVe(wStocks.stock01, 0)}
                  </span>
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 6px', borderRadius: '5px', background: 'rgba(168, 85, 247, 0.14)', color: '#d8b4fe', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                    Alm 02: {formatUnitVe(wStocks.stock02, 0)}
                  </span>
                  <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '2px 6px', borderRadius: '5px', background: 'rgba(15, 23, 42, 0.45)', color: '#e2e8f0' }}>
                    Total: {formatUnitVe(stock, 0)}
                  </span>
                </div>

                {/* Badge de Stock */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <span
                    style={{
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: '6px',
                      background: isAgotado ? 'rgba(239, 68, 68, 0.2)' : (isBajo ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)'),
                      color: isAgotado ? '#fca5a5' : (isBajo ? '#fde68a' : '#86efac'),
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}
                  >
                    {isAgotado ? <XCircle size={10} /> : (isBajo ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />)}
                    {isAgotado ? 'Agotado' : 'Disponible'}
                  </span>

                  {onSelectProductForOrder && (
                    <button
                      type="button"
                      onClick={() => onSelectProductForOrder(prod)}
                      style={{
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        color: '#38bdf8',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      <Plus size={12} /> Pedir
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
