import React, { useMemo, useState } from 'react';
import {
  DollarSign,
  Users,
  Receipt,
  Plus,
  Trash2,
  Building2,
  CheckCircle2,
  Wallet,
  Printer,
  FileText
} from 'lucide-react';
import { formatUsd, formatBs, round2 } from '../services/formatService';
import { generatePayrollSlipPDF } from '../services/pdfReportService';
import {
  EXPENSE_STANDARD_CATEGORIES,
  buildExpenseAccountOptions,
  classifyExpenseBucket
} from '../utils/profitabilityUtils';

/**
 * Panel operativo integrado para gestionar Gastos Operativos Clasificados,
 * Directorio de Empleados y Corridas de Nómina conectados al P&L y Caja/Banco.
 */
export default function ExpensesPayrollPanel({
  expenses = [],
  employees = [],
  payroll = [],
  profitIncomeExpenseAccounts = [],
  profitCashDesks = [],
  profitBankAccounts = [],
  config = {},
  currentUser = null,
  onSaveExpense,
  onDeleteExpense,
  onSaveEmployee,
  onDeleteEmployee,
  onSavePayroll,
  onDeletePayroll,
  onAddCashMovement
}) {
  const [subView, setSubView] = useState('expenses'); // 'expenses' | 'employees' | 'payroll'
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  const tasaBcv = Number(config?.tasaDolar || 0);
  const todayIso = new Date().toISOString().split('T')[0];

  const { standardCategories, profitAccounts } = useMemo(
    () => buildExpenseAccountOptions(profitIncomeExpenseAccounts),
    [profitIncomeExpenseAccounts]
  );

  const cajaBancoOptions = useMemo(() => {
    const desks = (Array.isArray(profitCashDesks) ? profitCashDesks : []).map((c) => ({
      id: c.co_caja || c.coCaja || c.id || '',
      label: `[CAJA] ${c.descrip || c.co_caja || c.id}`,
      moneda: c.moneda || 'USD'
    }));
    const banks = (Array.isArray(profitBankAccounts) ? profitBankAccounts : []).map((b) => ({
      id: b.cod_cta || b.codCta || b.id || '',
      label: `[BANCO] ${b.nom_ban || b.descrip || b.cod_cta || b.id} (${b.num_cta || ''})`,
      moneda: b.moneda || 'BS'
    }));
    return [...desks, ...banks].filter((x) => x.id);
  }, [profitCashDesks, profitBankAccounts]);

  // Estado formulario Gasto Operativo
  const [expFecha, setExpFecha] = useState(todayIso);
  const [expConcepto, setExpConcepto] = useState('');
  const [expCategoria, setExpCategoria] = useState('GASTO_OPERATIVO');
  const [expCuentaProfit, setExpCuentaProfit] = useState('');
  const [expProveedor, setExpProveedor] = useState('');
  const [expMontoUsd, setExpMontoUsd] = useState('');
  const [expMetodoPago, setExpMetodoPago] = useState('TRANSFERENCIA');
  const [expCajaId, setExpCajaId] = useState('');
  const [expRef, setExpRef] = useState('');
  const [expRegistrarCaja, setExpRegistrarCaja] = useState(true);

  // Estado formulario Empleado
  const [empCedula, setEmpCedula] = useState('');
  const [empNombre, setEmpNombre] = useState('');
  const [empCargo, setEmpCargo] = useState('');
  const [empDepto, setEmpDepto] = useState('OPERACIONES');
  const [empSalarioUsd, setEmpSalarioUsd] = useState('');
  const [empBonoUsd, setEmpBonoUsd] = useState('');
  const [empFrecuencia, setEmpFrecuencia] = useState('QUINCENAL');

  // Estado formulario Nómina
  const [payPeriodo, setPayPeriodo] = useState(`Nómina ${todayIso.slice(0, 7)}`);
  const [payFecha, setPayFecha] = useState(todayIso);
  const [payFrecuencia, setPayFrecuencia] = useState('QUINCENAL');
  const [payDeduccionesUsd, setPayDeduccionesUsd] = useState('0');
  const [payBonosExtraUsd, setPayBonosExtraUsd] = useState('0');
  const [payCajaId, setPayCajaId] = useState('');
  const [payRef, setPayRef] = useState('');
  const [payRegistrarCaja, setPayRegistrarCaja] = useState(true);

  const notify = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3500);
  };

  const handlePrintEmployeePaySlip = (emp) => {
    if (!emp) return;
    try {
      generatePayrollSlipPDF({
        employee: emp,
        payrollItem: {
          periodo: `Nómina ${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
          frecuencia: emp.frecuencia || 'QUINCENAL',
          salarioUsd: Number(emp.salarioBaseUsd || 0) * (emp.frecuencia === 'MENSUAL' ? 1 : 0.5),
          bonoUsd: Number(emp.bonoFijoUsd || 0) * (emp.frecuencia === 'MENSUAL' ? 1 : 0.5),
          fechaPago: new Date().toISOString().split('T')[0]
        },
        config,
        currentUser
      });
      notify(`Recibo LOTTT de ${emp.nombre} generado en PDF`);
    } catch (err) {
      console.error('Error generando recibo LOTTT:', err);
      notify('Error al generar recibo individual LOTTT');
    }
  };

  const handlePrintPayrollRunSlips = (run) => {
    if (!run) return;
    try {
      const detalles = Array.isArray(run.detalles) && run.detalles.length > 0 ? run.detalles : employees;
      if (!detalles || detalles.length === 0) {
        notify('No hay trabajadores vinculados a esta nómina');
        return;
      }
      detalles.forEach((det, idx) => {
        const empMatch = employees.find(e => e.id === det.employeeId || e.id === det.empleadoId || e.cedula === det.cedula || e.cedula === det.empleadoCedula) || det;
        setTimeout(() => {
          generatePayrollSlipPDF({
            employee: empMatch,
            payrollItem: {
              ...det,
              periodo: run.periodo,
              frecuencia: run.frecuencia,
              fechaPago: run.fechaPago
            },
            config,
            currentUser
          });
        }, idx * 250);
      });
      notify(`Generando ${detalles.length} recibos individuales LOTTT...`);
    } catch (err) {
      console.error('Error generando recibos de nómina:', err);
      notify('Error al generar recibos de la corrida');
    }
  };

  const activeEmployees = useMemo(
    () => (Array.isArray(employees) ? employees : []).filter((e) => e && e.activo !== false),
    [employees]
  );

  const payrollPreview = useMemo(() => {
    const divisor = payFrecuencia === 'QUINCENAL' ? 2 : 1;
    let totalSalarios = 0;
    let totalBonosFijos = 0;
    const detalles = activeEmployees.map((emp) => {
      const sal = round2(Number(emp.salarioBaseUsd || 0) / divisor);
      const bon = round2(Number(emp.bonoFijoUsd || 0) / divisor);
      totalSalarios += sal;
      totalBonosFijos += bon;
      return {
        employeeId: emp.id,
        cedula: emp.cedula,
        nombre: emp.nombre,
        cargo: emp.cargo,
        salarioUsd: sal,
        bonoUsd: bon,
        netoUsd: round2(sal + bon)
      };
    });
    const totalBonos = round2(totalBonosFijos + Number(payBonosExtraUsd || 0));
    const totalDeducciones = round2(Number(payDeduccionesUsd || 0));
    const totalNetoUsd = round2(Math.max(0, totalSalarios + totalBonos - totalDeducciones));
    return {
      detalles,
      totalSalariosUsd: round2(totalSalarios),
      totalBonosUsd: totalBonos,
      totalDeduccionesUsd: totalDeducciones,
      totalNetoUsd,
      totalNetoBs: round2(totalNetoUsd * tasaBcv)
    };
  }, [activeEmployees, payFrecuencia, payBonosExtraUsd, payDeduccionesUsd, tasaBcv]);

  const handleSelectProfitAccount = (code) => {
    setExpCuentaProfit(code);
    const acc = profitAccounts.find((a) => a.code === code);
    if (acc && ['NOMINA', 'COMISIONES', 'FLETES', 'IMPUESTOS'].includes(acc.pnlBucket)) {
      setExpCategoria(acc.pnlBucket);
    }
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    const montoUsd = round2(Number(expMontoUsd || 0));
    if (!expConcepto.trim() || montoUsd <= 0 || !onSaveExpense) return;
    setSaving(true);
    try {
      const selectedAcc = profitAccounts.find((a) => a.code === expCuentaProfit);
      const selectedCaja = cajaBancoOptions.find((c) => c.id === expCajaId);
      const montoBs = round2(montoUsd * tasaBcv);
      const saved = await onSaveExpense({
        fecha: expFecha,
        concepto: expConcepto.trim(),
        categoria: expCategoria,
        cuentaGasto: selectedAcc?.code || null,
        cuentaGastoDesc: selectedAcc?.descrip || '',
        proveedor: expProveedor.trim(),
        montoUsd,
        montoBs,
        tasaPago: tasaBcv,
        tipoTasa: 'BCV',
        metodoPago: expMetodoPago,
        cajaBancoId: selectedCaja?.id || null,
        cajaBancoNombre: selectedCaja?.label || expMetodoPago,
        referencia: expRef.trim() || 'S/R',
        estado: 'PAGADA',
        createdBy: currentUser?.username || currentUser?.nombre || 'Sistema'
      });

      if (expRegistrarCaja && onAddCashMovement && saved?.id) {
        await onAddCashMovement({
          fecha: new Date(`${expFecha}T12:00:00`).toISOString(),
          tipo: 'EGRESO',
          categoria: expCategoria,
          concepto: `[Gasto P&L] ${expConcepto.trim()}${selectedAcc ? ` (${selectedAcc.descrip})` : ''}`,
          montoUsd,
          montoBs,
          tasa: tasaBcv,
          tasaPago: tasaBcv,
          tipoTasa: 'BCV',
          metodo: expMetodoPago,
          cuentaId: selectedCaja?.id || null,
          cuentaNombre: selectedCaja?.label || expMetodoPago,
          cuentaGasto: selectedAcc?.code || null,
          cuentaGastoDesc: selectedAcc?.descrip || '',
          referencia: saved.id,
          referenciaTipo: 'EXPENSE',
          referenciaId: saved.id,
          usuario: currentUser?.username || 'Sistema'
        });
      }

      setExpConcepto('');
      setExpProveedor('');
      setExpMontoUsd('');
      setExpRef('');
      notify('Gasto operativo registrado y sincronizado en el P&L.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    if (!empCedula.trim() || !empNombre.trim() || !onSaveEmployee) return;
    setSaving(true);
    try {
      await onSaveEmployee({
        cedula: empCedula.trim(),
        nombre: empNombre.trim(),
        cargo: empCargo.trim() || 'Operador',
        departamento: empDepto,
        salarioBaseUsd: round2(Number(empSalarioUsd || 0)),
        bonoFijoUsd: round2(Number(empBonoUsd || 0)),
        frecuenciaPago: empFrecuencia,
        activo: true
      });
      setEmpCedula('');
      setEmpNombre('');
      setEmpCargo('');
      setEmpSalarioUsd('');
      setEmpBonoUsd('');
      notify('Empleado guardado en el directorio de nómina.');
    } finally {
      setSaving(false);
    }
  };

  const handleRunPayroll = async (e) => {
    e.preventDefault();
    if (!payPeriodo.trim() || payrollPreview.totalNetoUsd <= 0 || !onSavePayroll) return;
    setSaving(true);
    try {
      const selectedCaja = cajaBancoOptions.find((c) => c.id === payCajaId);
      const saved = await onSavePayroll({
        periodo: payPeriodo.trim(),
        fechaPago: payFecha,
        frecuencia: payFrecuencia,
        totalSalariosUsd: payrollPreview.totalSalariosUsd,
        totalBonosUsd: payrollPreview.totalBonosUsd,
        totalDeduccionesUsd: payrollPreview.totalDeduccionesUsd,
        totalNetoUsd: payrollPreview.totalNetoUsd,
        totalNetoBs: payrollPreview.totalNetoBs,
        tasaBcv,
        tipoTasa: 'BCV',
        metodoPago: selectedCaja?.label || 'TRANSFERENCIA',
        cajaBancoId: selectedCaja?.id || null,
        cuentaDestino: selectedCaja?.label || 'Nómina Bancaria',
        referencia: payRef.trim() || 'NOM-DIRECTA',
        estado: 'PAGADA',
        detalles: payrollPreview.detalles,
        createdBy: currentUser?.username || currentUser?.nombre || 'Sistema'
      });

      if (payRegistrarCaja && onAddCashMovement && saved?.id) {
        await onAddCashMovement({
          fecha: new Date(`${payFecha}T12:00:00`).toISOString(),
          tipo: 'EGRESO',
          categoria: 'NOMINA',
          concepto: `[Nómina] ${payPeriodo.trim()} (${payrollPreview.detalles.length} empleados)`,
          montoUsd: payrollPreview.totalNetoUsd,
          montoBs: payrollPreview.totalNetoBs,
          tasa: tasaBcv,
          tasaPago: tasaBcv,
          tipoTasa: 'BCV',
          metodo: 'TRANSFERENCIA',
          cuentaId: selectedCaja?.id || null,
          cuentaNombre: selectedCaja?.label || 'Nómina Bancaria',
          referencia: saved.id,
          referenciaTipo: 'PAYROLL',
          referenciaId: saved.id,
          usuario: currentUser?.username || 'Sistema'
        });
      }

      setPayRef('');
      notify('Corrida de nómina contabilizada en el P&L.');
    } finally {
      setSaving(false);
    }
  };

  const totalsSummary = useMemo(() => {
    const expTotal = (Array.isArray(expenses) ? expenses : []).reduce((a, x) => a + Number(x.montoUsd || 0), 0);
    const payTotal = (Array.isArray(payroll) ? payroll : []).reduce((a, p) => a + Number(p.totalNetoUsd || 0), 0);
    const mensualNominaEst = activeEmployees.reduce(
      (a, e) => a + Number(e.salarioBaseUsd || 0) + Number(e.bonoFijoUsd || 0),
      0
    );
    return { expTotal, payTotal, mensualNominaEst };
  }, [expenses, payroll, activeEmployees]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* KPIs resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem' }}>
        <div className="card" style={{ padding: '0.9rem', margin: 0, background: 'var(--bg-surface)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>GASTOS OPERATIVOS ({expenses.length})</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.2rem' }}>{formatUsd(totalsSummary.expTotal)}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Cuentas Profit disponibles: {profitAccounts.length}</div>
        </div>
        <div className="card" style={{ padding: '0.9rem', margin: 0, background: 'var(--bg-surface)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>PERSONAL ACTIVO ({activeEmployees.length})</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.2rem' }}>{formatUsd(totalsSummary.mensualNominaEst)} / mes</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Nómina base + bonos fijos</div>
        </div>
        <div className="card" style={{ padding: '0.9rem', margin: 0, background: 'var(--bg-surface)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>NÓMINA EJECUTADA ({payroll.length})</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', marginTop: '0.2rem' }}>{formatUsd(totalsSummary.payTotal)}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatBs(totalsSummary.payTotal * tasaBcv)}</div>
        </div>
      </div>

      {feedback && (
        <div style={{ padding: '0.65rem 1rem', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <CheckCircle2 size={16} />
          <span>{feedback}</span>
        </div>
      )}

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button onClick={() => setSubView('expenses')} className={`btn btn-sm ${subView === 'expenses' ? 'btn-primary' : 'btn-secondary'}`}>
          <Receipt size={14} /> Gastos Operativos ({expenses.length})
        </button>
        <button onClick={() => setSubView('employees')} className={`btn btn-sm ${subView === 'employees' ? 'btn-primary' : 'btn-secondary'}`}>
          <Users size={14} /> Directorio de Personal ({employees.length})
        </button>
        <button onClick={() => setSubView('payroll')} className={`btn btn-sm ${subView === 'payroll' ? 'btn-primary' : 'btn-secondary'}`}>
          <Wallet size={14} /> Corridas de Nómina ({payroll.length})
        </button>
      </div>

      {/* VISTA 1: GASTOS OPERATIVOS */}
      {subView === 'expenses' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) 1fr', gap: '1rem', alignItems: 'start' }}>
          <form onSubmit={handleCreateExpense} className="card" style={{ padding: '1rem', margin: 0, background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <div style={{ fontWeight: 800, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Plus size={16} color="#f59e0b" /> Registrar Gasto Operativo
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Fecha</label>
                <input type="date" value={expFecha} onChange={(e) => setExpFecha(e.target.value)} className="input-field" style={{ width: '100%' }} required />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Monto USD</label>
                <input type="number" step="0.01" min="0.01" placeholder="0.00" value={expMontoUsd} onChange={(e) => setExpMontoUsd(e.target.value)} className="input-field" style={{ width: '100%' }} required />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Concepto / Descripción</label>
              <input type="text" placeholder="Ej: Flete ruta Valencia, Alquiler Galpón..." value={expConcepto} onChange={(e) => setExpConcepto(e.target.value)} className="input-field" style={{ width: '100%' }} required />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Categoría P&L</label>
              <select value={expCategoria} onChange={(e) => setExpCategoria(e.target.value)} className="input-field" style={{ width: '100%' }}>
                {standardCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Cuenta Profit Plus (Ingresos/Egresos)</label>
              <select value={expCuentaProfit} onChange={(e) => handleSelectProfitAccount(e.target.value)} className="input-field" style={{ width: '100%' }}>
                <option value="">-- Sin cuenta contable Profit --</option>
                {profitAccounts.map((acc) => (
                  <option key={acc.id} value={acc.code}>{acc.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Proveedor / Beneficiario</label>
                <input type="text" placeholder="Opcional" value={expProveedor} onChange={(e) => setExpProveedor(e.target.value)} className="input-field" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>N° Referencia</label>
                <input type="text" placeholder="Ref / Factura" value={expRef} onChange={(e) => setExpRef(e.target.value)} className="input-field" style={{ width: '100%' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Método</label>
                <select value={expMetodoPago} onChange={(e) => setExpMetodoPago(e.target.value)} className="input-field" style={{ width: '100%' }}>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="EFECTIVO USD">Efectivo USD</option>
                  <option value="PAGO MOVIL">Pago Móvil</option>
                  <option value="ZELLE">Zelle / Divisa</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Caja / Banco</label>
                <select value={expCajaId} onChange={(e) => setExpCajaId(e.target.value)} className="input-field" style={{ width: '100%' }}>
                  <option value="">Tesorería General</option>
                  {cajaBancoOptions.map((cb) => (
                    <option key={cb.id} value={cb.id}>{cb.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={expRegistrarCaja} onChange={(e) => setExpRegistrarCaja(e.target.checked)} />
              Registrar egreso automático en Caja Chica / Bancos
            </label>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ width: '100%' }}>
              <DollarSign size={15} /> {saving ? 'Guardando...' : 'Guardar Gasto'}
            </button>
          </form>

          <div className="card" style={{ padding: '0.75rem', margin: 0, background: 'var(--bg-surface)', overflowX: 'auto' }}>
            <table className="custom-table" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto & Cuenta</th>
                  <th>Categoría P&L</th>
                  <th style={{ textAlign: 'right' }}>Monto USD</th>
                  <th style={{ textAlign: 'right' }}>Equiv. Bs</th>
                  <th style={{ textAlign: 'center' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                      No hay gastos operativos registrados aún. Registre el primero a la izquierda para alimentarlo en el P&L real.
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp) => (
                    <tr key={exp.id}>
                      <td>{exp.fecha}</td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{exp.concepto}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {exp.cuentaGasto ? `[${exp.cuentaGasto}] ${exp.cuentaGastoDesc}` : (exp.proveedor || exp.referencia || 'Directo')}
                        </div>
                      </td>
                      <td><span className="badge badge-secondary" style={{ fontSize: '0.68rem' }}>{classifyExpenseBucket(exp.categoria, exp.cuentaGastoDesc)} · {exp.categoria}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatUsd(exp.montoUsd)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{formatBs(exp.montoBs || (exp.montoUsd * tasaBcv))}</td>
                      <td style={{ textAlign: 'center' }}>
                        {onDeleteExpense && (
                          <button type="button" onClick={() => onDeleteExpense(exp.id)} className="btn btn-sm btn-secondary" title="Eliminar gasto">
                            <Trash2 size={13} color="#ef4444" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISTA 2: DIRECTORIO DE EMPLEADOS */}
      {subView === 'employees' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 360px) 1fr', gap: '1rem', alignItems: 'start' }}>
          <form onSubmit={handleCreateEmployee} className="card" style={{ padding: '1rem', margin: 0, background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <div style={{ fontWeight: 800, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Users size={16} color="#38bdf8" /> Agregar Empleado
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Cédula / RIF</label>
                <input type="text" placeholder="V-12345678" value={empCedula} onChange={(e) => setEmpCedula(e.target.value)} className="input-field" style={{ width: '100%' }} required />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Departamento</label>
                <select value={empDepto} onChange={(e) => setEmpDepto(e.target.value)} className="input-field" style={{ width: '100%' }}>
                  <option value="OPERACIONES">Operaciones / Almacén</option>
                  <option value="VENTAS">Ventas</option>
                  <option value="ADMINISTRACION">Administración</option>
                  <option value="LOGISTICA">Logística & Choferes</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Nombre Completo</label>
              <input type="text" placeholder="Nombre y Apellido" value={empNombre} onChange={(e) => setEmpNombre(e.target.value)} className="input-field" style={{ width: '100%' }} required />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Cargo</label>
              <input type="text" placeholder="Ej: Almacenista, Chofer, Asistente..." value={empCargo} onChange={(e) => setEmpCargo(e.target.value)} className="input-field" style={{ width: '100%' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Salario Mensual USD</label>
                <input type="number" step="0.01" min="0" placeholder="0.00" value={empSalarioUsd} onChange={(e) => setEmpSalarioUsd(e.target.value)} className="input-field" style={{ width: '100%' }} required />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Bono Mensual USD</label>
                <input type="number" step="0.01" min="0" placeholder="0.00" value={empBonoUsd} onChange={(e) => setEmpBonoUsd(e.target.value)} className="input-field" style={{ width: '100%' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Frecuencia Base</label>
              <select value={empFrecuencia} onChange={(e) => setEmpFrecuencia(e.target.value)} className="input-field" style={{ width: '100%' }}>
                <option value="QUINCENAL">Quincenal</option>
                <option value="MENSUAL">Mensual</option>
                <option value="SEMANAL">Semanal</option>
              </select>
            </div>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ width: '100%' }}>
              <Plus size={15} /> {saving ? 'Guardando...' : 'Guardar Empleado'}
            </button>
          </form>

          <div className="card" style={{ padding: '0.75rem', margin: 0, background: 'var(--bg-surface)', overflowX: 'auto' }}>
            <table className="custom-table" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th>Cédula</th>
                  <th>Empleado / Cargo</th>
                  <th>Departamento</th>
                  <th style={{ textAlign: 'right' }}>Salario USD</th>
                  <th style={{ textAlign: 'right' }}>Bono USD</th>
                  <th style={{ textAlign: 'right' }}>Total Mensual</th>
                  <th style={{ textAlign: 'center' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                      No hay empleados registrados. Agregue el personal para generar corridas de nómina reales.
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr key={emp.id}>
                      <td>{emp.cedula}</td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{emp.nombre}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{emp.cargo}</div>
                      </td>
                      <td><span className="badge badge-info" style={{ fontSize: '0.68rem' }}>{emp.departamento}</span></td>
                      <td style={{ textAlign: 'right' }}>{formatUsd(emp.salarioBaseUsd)}</td>
                      <td style={{ textAlign: 'right' }}>{formatUsd(emp.bonoFijoUsd)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatUsd(Number(emp.salarioBaseUsd || 0) + Number(emp.bonoFijoUsd || 0))}</td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => handlePrintEmployeePaySlip(emp)}
                          className="btn btn-sm btn-secondary"
                          style={{ marginRight: '6px', fontSize: '0.7rem', padding: '3px 8px' }}
                          title="Generar Recibo Individual de Pago LOTTT (Art. 106)"
                        >
                          <Printer size={13} style={{ marginRight: '4px' }} /> Recibo
                        </button>
                        {onDeleteEmployee && (
                          <button type="button" onClick={() => onDeleteEmployee(emp.id)} className="btn btn-sm btn-secondary" title="Eliminar empleado">
                            <Trash2 size={13} color="#ef4444" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISTA 3: CORRIDAS DE NÓMINA */}
      {subView === 'payroll' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) 1fr', gap: '1rem', alignItems: 'start' }}>
          <form onSubmit={handleRunPayroll} className="card" style={{ padding: '1rem', margin: 0, background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <div style={{ fontWeight: 800, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Building2 size={16} color="#10b981" /> Procesar Corrida de Nómina
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Descripción del Período</label>
              <input type="text" value={payPeriodo} onChange={(e) => setPayPeriodo(e.target.value)} className="input-field" style={{ width: '100%' }} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Fecha Pago</label>
                <input type="date" value={payFecha} onChange={(e) => setPayFecha(e.target.value)} className="input-field" style={{ width: '100%' }} required />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Modalidad</label>
                <select value={payFrecuencia} onChange={(e) => setPayFrecuencia(e.target.value)} className="input-field" style={{ width: '100%' }}>
                  <option value="QUINCENAL">Quincenal (50% mensual)</option>
                  <option value="MENSUAL">Mensual (100%)</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Bonos Extra USD</label>
                <input type="number" step="0.01" min="0" value={payBonosExtraUsd} onChange={(e) => setPayBonosExtraUsd(e.target.value)} className="input-field" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Deducciones (IVSS/FAOV) USD</label>
                <input type="number" step="0.01" min="0" value={payDeduccionesUsd} onChange={(e) => setPayDeduccionesUsd(e.target.value)} className="input-field" style={{ width: '100%' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Caja / Banco Pagador</label>
                <select value={payCajaId} onChange={(e) => setPayCajaId(e.target.value)} className="input-field" style={{ width: '100%' }}>
                  <option value="">Cuenta Nómina</option>
                  {cajaBancoOptions.map((cb) => (
                    <option key={cb.id} value={cb.id}>{cb.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Referencia Bancaria</label>
                <input type="text" placeholder="Ref transferencia" value={payRef} onChange={(e) => setPayRef(e.target.value)} className="input-field" style={{ width: '100%' }} />
              </div>
            </div>
            <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Empleados incluidos:</span>
                <strong>{payrollPreview.detalles.length}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Neto a Pagar USD:</span>
                <strong style={{ color: '#10b981' }}>{formatUsd(payrollPreview.totalNetoUsd)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <span>Equivalente BCV:</span>
                <span>{formatBs(payrollPreview.totalNetoBs)}</span>
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={payRegistrarCaja} onChange={(e) => setPayRegistrarCaja(e.target.checked)} />
              Registrar salida automática en Caja / Banco
            </label>
            <button type="submit" disabled={saving || payrollPreview.totalNetoUsd <= 0} className="btn btn-primary" style={{ width: '100%' }}>
              <CheckCircle2 size={15} /> {saving ? 'Procesando...' : 'Emitir & Contabilizar Nómina'}
            </button>
          </form>

          <div className="card" style={{ padding: '0.75rem', margin: 0, background: 'var(--bg-surface)', overflowX: 'auto' }}>
            <table className="custom-table" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Período & Modalidad</th>
                  <th style={{ textAlign: 'right' }}>Salarios</th>
                  <th style={{ textAlign: 'right' }}>Bonos</th>
                  <th style={{ textAlign: 'right' }}>Neto USD</th>
                  <th style={{ textAlign: 'right' }}>Equiv. Bs</th>
                  <th style={{ textAlign: 'center' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {payroll.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                      Sin corridas de nómina emitidas aún. Registre empleados y emita la corrida a la izquierda.
                    </td>
                  </tr>
                ) : (
                  payroll.map((p) => (
                    <tr key={p.id}>
                      <td>{p.fechaPago}</td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{p.periodo}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.frecuencia} · {Array.isArray(p.detalles) ? p.detalles.length : 0} pers.</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>{formatUsd(p.totalSalariosUsd)}</td>
                      <td style={{ textAlign: 'right' }}>{formatUsd(p.totalBonosUsd)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{formatUsd(p.totalNetoUsd)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{formatBs(p.totalNetoBs || (p.totalNetoUsd * tasaBcv))}</td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => handlePrintPayrollRunSlips(p)}
                          className="btn btn-sm btn-secondary"
                          style={{ marginRight: '6px', fontSize: '0.7rem', padding: '3px 8px' }}
                          title="Descargar Recibos Individuales LOTTT de esta corrida"
                        >
                          <Printer size={13} style={{ marginRight: '4px' }} /> Recibos LOTTT
                        </button>
                        {onDeletePayroll && (
                          <button type="button" onClick={() => onDeletePayroll(p.id)} className="btn btn-sm btn-secondary" title="Eliminar nómina">
                            <Trash2 size={13} color="#ef4444" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
