import React, { useState, useMemo } from 'react';
import {
  Search,
  MessageCircle,
  AlertTriangle,
  CheckCircle2,
  Phone,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
  DollarSign
} from 'lucide-react';
import { formatUsd, formatBs } from '../../services/formatService';

export default function MobileCxCView({
  clients = [],
  sales = [],
  profitInvoices = [],
  config = {}
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'MORA' | 'VIGENTE'
  const [expandedClientId, setExpandedClientId] = useState(null);

  const tasaBcv = Number(config?.tasaDolar || 827.73);
  const nombreEmpresa = config?.nombreEmpresa || 'GRUPO MOTORVEN, C.A.';

  // Extraer clientes con saldo
  const clientsWithDebt = useMemo(() => {
    return clients
      .map(cli => {
        const saldoUsd = Number(cli.saldoUsd || cli.saldo_usd || 0);
        const saldoBs = saldoUsd * tasaBcv;
        const diasCredito = Number(cli.diasCredito || cli.dias_credito || cli.plazo || 0);
        const diasMora = Number(cli.diasMora || cli.dias_mora || 0);
        const isMora = diasMora > 0 || diasCredito < diasMora;
        return {
          ...cli,
          saldoUsd,
          saldoBs,
          diasCredito,
          diasMora,
          isMora
        };
      })
      .filter(cli => cli.saldoUsd > 0.01);
  }, [clients, tasaBcv]);

  // Filtrado
  const filteredClients = useMemo(() => {
    return clientsWithDebt.filter(cli => {
      const matchSearch =
        String(cli.nombre || cli.razonSocial || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(cli.rif || cli.ci || '').toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      if (filterMode === 'MORA') return cli.isMora;
      if (filterMode === 'VIGENTE') return !cli.isMora;
      return true;
    });
  }, [clientsWithDebt, searchTerm, filterMode]);

  // Totales
  const totalCobrarUsd = clientsWithDebt.reduce((acc, c) => acc + c.saldoUsd, 0);
  const totalCobrarBs = totalCobrarUsd * tasaBcv;
  const totalMoraCount = clientsWithDebt.filter(c => c.isMora).length;

  const handleSendWhatsApp = (cli) => {
    const cleanPhone = String(cli.telefono || cli.phone || cli.celular || '584120000000').replace(/[^0-9]/g, '');
    const phoneToUse = cleanPhone.startsWith('0') ? '58' + cleanPhone.slice(1) : (cleanPhone.startsWith('58') ? cleanPhone : '58' + cleanPhone);
    const fechaHoy = new Date().toLocaleDateString('es-VE');

    const msg = `Estimado(a) *${cli.nombre || cli.razonSocial}* (RIF: ${cli.rif || 'V-00000000'}), le saludamos cordialmente de *${nombreEmpresa}*.\n\nLe recordamos su saldo pendiente a la fecha *${fechaHoy}*:\n💵 *Monto en Divisas:* $ ${cli.saldoUsd.toFixed(2)} USD\n🇻🇪 *Equivalente Oficial:* ${formatBs(cli.saldoBs)} (Tasa Oficial BCV: Bs. ${tasaBcv.toFixed(2)}/USD).\n\nAgradecemos remitir su comprobante de pago por este canal para conciliar su estado de cuenta.\n\n¡Muchas gracias por su preferencia!`;

    const url = `https://wa.me/${phoneToUse}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      
      {/* 1. Header Resumen */}
      <div
        className="mobile-card"
        style={{
          background: 'linear-gradient(135deg, rgba(6, 78, 59, 0.45) 0%, rgba(2, 44, 34, 0.6) 100%)',
          borderColor: 'rgba(16, 185, 129, 0.35)',
          padding: '0.85rem 1rem'
        }}
      >
        <div style={{ fontSize: '0.68rem', color: '#6ee7b7', fontWeight: 800, textTransform: 'uppercase' }}>
          Gestión de Cobranzas Móvil
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '4px' }}>
          <div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#10b981', fontFamily: 'monospace' }}>
              {formatUsd(totalCobrarUsd)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>
              Equivalente: <strong style={{ color: '#f59e0b' }}>{formatBs(totalCobrarBs)}</strong>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                background: totalMoraCount > 0 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.2)',
                border: totalMoraCount > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
                color: totalMoraCount > 0 ? '#fca5a5' : '#86efac',
                padding: '3px 8px',
                borderRadius: '12px',
                fontSize: '0.66rem',
                fontWeight: 800
              }}
            >
              {totalMoraCount} en mora
            </span>
          </div>
        </div>
      </div>

      {/* 2. Buscador */}
      <div className="mobile-search-bar" style={{ margin: 0 }}>
        <Search size={16} color="#94a3b8" />
        <input
          type="text"
          className="mobile-search-input"
          placeholder="Buscar cliente por nombre o RIF..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* 3. Filtros Rápidos */}
      <div className="mobile-chips-row" style={{ margin: 0 }}>
        <button
          type="button"
          className={`mobile-chip ${filterMode === 'ALL' ? 'active' : ''}`}
          onClick={() => setFilterMode('ALL')}
        >
          Todos ({clientsWithDebt.length})
        </button>
        <button
          type="button"
          className={`mobile-chip ${filterMode === 'MORA' ? 'active' : ''}`}
          onClick={() => setFilterMode('MORA')}
          style={{ borderColor: filterMode === 'MORA' ? '#ef4444' : undefined, color: filterMode === 'MORA' ? '#fca5a5' : undefined }}
        >
          ⚠️ En Mora ({totalMoraCount})
        </button>
        <button
          type="button"
          className={`mobile-chip ${filterMode === 'VIGENTE' ? 'active' : ''}`}
          onClick={() => setFilterMode('VIGENTE')}
        >
          ✅ Al Día ({clientsWithDebt.length - totalMoraCount})
        </button>
      </div>

      {/* 4. Lista de Tarjetas de Clientes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredClients.length === 0 ? (
          <div className="mobile-card" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
            No se encontraron clientes con cuentas por cobrar en este filtro.
          </div>
        ) : (
          filteredClients.map((cli) => {
            const isExpanded = expandedClientId === cli.id;
            return (
              <div
                key={cli.id}
                className="mobile-card"
                style={{
                  borderLeft: cli.isMora ? '4px solid #ef4444' : '4px solid #10b981',
                  padding: '0.85rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, paddingRight: '8px' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#f8fafc' }}>
                      {cli.nombre || cli.razonSocial}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>
                      <code>{cli.rif || 'V-00000000'}</code> • {cli.vendedorNombre || cli.vendedor || 'Vendedor Asignado'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 900, color: '#10b981', fontSize: '1rem', fontFamily: 'monospace' }}>
                      {formatUsd(cli.saldoUsd)}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#f59e0b', fontWeight: 700, fontFamily: 'monospace' }}>
                      {formatBs(cli.saldoBs)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                    {cli.isMora ? (
                      <span style={{ color: '#ef4444', fontWeight: 800 }}>⚠️ Mora: {cli.diasMora} días</span>
                    ) : (
                      <span style={{ color: '#10b981', fontWeight: 700 }}>✅ Crédito: {cli.diasCredito} días</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSendWhatsApp(cli)}
                    style={{
                      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#ffffff',
                      padding: '5px 12px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    <MessageCircle size={13} /> Cobrar WhatsApp
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
