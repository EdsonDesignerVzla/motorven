import React from 'react';
import { Calendar, X } from 'lucide-react';
import { createDefaultDatePeriodFilter, isDatePeriodFilterActive, SYSTEM_START_DATE } from '../utils/dateRangeFilterUtils';

/**
 * Control reutilizable de filtro por Fecha Exacta o Período (Desde / Hasta).
 * Respeta variables de tema claro/oscuro (--bg-surface, --bg-card, --border-glass, --text-primary, --text-muted).
 */
export default function DatePeriodFilter({
  value,
  onChange,
  label = '',
  compact = false,
  stacked = false,
  minDate = SYSTEM_START_DATE,
  style = {}
}) {
  const safeVal = value && typeof value === 'object' ? value : createDefaultDatePeriodFilter('EXACT');
  const activeMode = safeVal.mode === 'RANGE' ? 'RANGE' : 'EXACT';
  const hasActive = isDatePeriodFilterActive(safeVal);

  const emit = (patch) => {
    if (typeof onChange === 'function') {
      onChange({ ...safeVal, ...patch });
    }
  };

  const handleModeSwitch = (nextMode) => {
    if (nextMode === activeMode) return;
    if (nextMode === 'RANGE') {
      emit({
        mode: 'RANGE',
        fromDate: safeVal.fromDate || safeVal.exactDate || '',
        toDate: safeVal.toDate || safeVal.exactDate || ''
      });
    } else {
      emit({
        mode: 'EXACT',
        exactDate: safeVal.exactDate || safeVal.fromDate || safeVal.toDate || ''
      });
    }
  };

  const handleClear = () => {
    emit({
      mode: activeMode,
      exactDate: '',
      fromDate: '',
      toDate: ''
    });
  };

  const pillContainerStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
    padding: '2px',
    borderRadius: '6px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-glass)'
  };

  const pillBtnStyle = (selected) => ({
    border: selected ? '1px solid var(--neon-cyan, #0284c7)' : '1px solid transparent',
    background: selected ? 'rgba(56, 189, 248, 0.16)' : 'transparent',
    color: selected ? 'var(--neon-cyan, #0284c7)' : 'var(--text-muted)',
    borderRadius: '4px',
    padding: stacked ? '1px 6px' : (compact ? '2px 6px' : '3px 8px'),
    fontSize: stacked ? '0.66rem' : '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
    lineHeight: 1.3,
    whiteSpace: 'nowrap'
  });

  const dateInputStyle = {
    padding: stacked ? '4px 8px' : (compact ? '4px 7px' : '5px 8px'),
    fontSize: stacked ? '0.76rem' : '0.78rem',
    borderRadius: '6px',
    border: '1px solid var(--border-glass)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    outline: 'none',
    minWidth: activeMode === 'RANGE' ? '122px' : '132px',
    height: stacked ? '30px' : (compact ? '32px' : '34px')
  };

  const clearBtnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: stacked ? '26px' : '28px',
    height: stacked ? '28px' : '30px',
    borderRadius: '6px',
    border: '1px solid rgba(239, 68, 68, 0.35)',
    background: 'rgba(239, 68, 68, 0.12)',
    color: '#ef4444',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0
  };

  if (stacked) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', ...style }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            {label || (activeMode === 'RANGE' ? 'Fecha (Período)' : 'Fecha Exacta')}
          </span>
          <div style={pillContainerStyle}>
            <button type="button" onClick={() => handleModeSwitch('EXACT')} style={pillBtnStyle(activeMode === 'EXACT')}>
              Exacta
            </button>
            <button type="button" onClick={() => handleModeSwitch('RANGE')} style={pillBtnStyle(activeMode === 'RANGE')}>
              Período
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'nowrap' }}>
          {activeMode === 'EXACT' ? (
            <input
              type="date"
              min={minDate || undefined}
              value={safeVal.exactDate || ''}
              onChange={(e) => emit({ exactDate: e.target.value })}
              style={{ ...dateInputStyle, flex: 1, minWidth: 0 }}
              title="Filtrar por fecha exacta"
            />
          ) : (
            <>
              <input
                type="date"
                min={minDate || undefined}
                value={safeVal.fromDate || ''}
                onChange={(e) => emit({ fromDate: e.target.value })}
                style={{ ...dateInputStyle, flex: 1, minWidth: 0 }}
                title="Fecha inicial (Desde)"
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>a</span>
              <input
                type="date"
                min={minDate || undefined}
                value={safeVal.toDate || ''}
                onChange={(e) => emit({ toDate: e.target.value })}
                style={{ ...dateInputStyle, flex: 1, minWidth: 0 }}
                title="Fecha final (Hasta)"
              />
            </>
          )}
          {hasActive && (
            <button type="button" onClick={handleClear} style={clearBtnStyle} title="Limpiar filtro de fecha/período">
              <X size={12} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', ...style }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>
        <Calendar size={13} color="var(--neon-cyan, #0284c7)" />
        {label ? <span>{label}:</span> : null}
      </div>

      <div style={pillContainerStyle}>
        <button type="button" onClick={() => handleModeSwitch('EXACT')} style={pillBtnStyle(activeMode === 'EXACT')}>
          Exacta
        </button>
        <button type="button" onClick={() => handleModeSwitch('RANGE')} style={pillBtnStyle(activeMode === 'RANGE')}>
          Período
        </button>
      </div>

      {activeMode === 'EXACT' ? (
        <input
          type="date"
          min={minDate || undefined}
          value={safeVal.exactDate || ''}
          onChange={(e) => emit({ exactDate: e.target.value })}
          style={dateInputStyle}
          title="Filtrar por fecha exacta"
        />
      ) : (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
          <input
            type="date"
            min={minDate || undefined}
            value={safeVal.fromDate || ''}
            onChange={(e) => emit({ fromDate: e.target.value })}
            style={dateInputStyle}
            title="Fecha inicial (Desde)"
          />
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>a</span>
          <input
            type="date"
            min={minDate || undefined}
            value={safeVal.toDate || ''}
            onChange={(e) => emit({ toDate: e.target.value })}
            style={dateInputStyle}
            title="Fecha final (Hasta)"
          />
        </div>
      )}

      {hasActive && (
        <button type="button" onClick={handleClear} style={clearBtnStyle} title="Limpiar filtro de fecha/período">
          <X size={12} />
        </button>
      )}
    </div>
  );
}
