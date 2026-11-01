import React from 'react';

export default function OilstoneProductImage({ productId, product, imagen, codigo, descripcion, width = "100%", height = "100%", style = {} }) {
  // 1. Si existe imagen real cargada (URL de Supabase Storage o Base64), mostrarla directamente
  const imgUrl = imagen || product?.imagen;
  if (imgUrl && typeof imgUrl === 'string' && (imgUrl.startsWith('http') || imgUrl.startsWith('data:'))) {
    return (
      <img 
        src={imgUrl} 
        alt={descripcion || product?.descripcion || 'Envase Oficial OILSTONE ®'} 
        style={{ width, height, objectFit: 'contain', ...style }} 
      />
    );
  }

  const pid = String(productId || codigo || product?.id || product?.codigo || '').toUpperCase();
  const desc = String(descripcion || product?.descripcion || '').toUpperCase();

  // Render 4 & 5: Linea R500 Semisintético 15W-40 / 20W-50 (Envase Blanco + Etiqueta Holográfica R500)
  if (pid.includes('R500') || desc.includes('R500')) {
    const viscosidad = (pid.includes('20W50') || desc.includes('20W-50') || desc.includes('20W50')) ? '20W-50' : '15W-40';
    return (
      <svg viewBox="0 0 200 220" width={width} height={height} style={{ background: '#ffffff', borderRadius: '8px', ...style }}>
        <ellipse cx="100" cy="205" rx="50" ry="8" fill="rgba(0,0,0,0.12)" />
        <rect x="85" y="15" width="30" height="18" rx="3" fill="#0f172a" />
        <path d="M 88 33 L 112 33 L 116 50 L 84 50 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M 60 50 Q 100 45 140 50 L 148 70 Q 154 120 148 195 C 148 200 140 202 100 202 C 60 202 52 200 52 195 Q 46 120 52 70 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2.5" />

        {/* Etiqueta Negra Holográfica R500 */}
        <rect x="62" y="70" width="76" height="115" rx="6" fill="#090d16" stroke="#1e293b" strokeWidth="1.5" />
        
        {/* Insignia R500 Gradiente */}
        <defs>
          <linearGradient id="r500Grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffb703" />
            <stop offset="50%" stopColor="#e60012" />
            <stop offset="100%" stopColor="#00f2fe" />
          </linearGradient>
        </defs>

        <text x="100" y="86" fontFamily="sans-serif" fontWeight="900" fontSize="10" fill="#ffffff" textAnchor="middle" fontStyle="italic">oilSTONE®</text>
        <text x="100" y="103" fontFamily="sans-serif" fontWeight="900" fontSize="17" fill="url(#r500Grad)" textAnchor="middle" fontStyle="italic">R500</text>
        
        <rect x="62" y="112" width="76" height="15" fill="#ffb703" />
        <text x="100" y="122" fontFamily="sans-serif" fontWeight="900" fontSize="7.5" fill="#000000" textAnchor="middle">SAE {viscosidad} API SL</text>
        <text x="100" y="134" fontFamily="sans-serif" fontWeight="800" fontSize="6" fill="#00f2fe" textAnchor="middle">SEMISINTÉTICO</text>

        <rect x="67" y="166" width="34" height="12" rx="3" fill="#ffffff" />
        <text x="84" y="174" fontFamily="sans-serif" fontWeight="800" fontSize="5.5" fill="#000" textAnchor="middle">946 ml</text>
      </svg>
    );
  }

  // Render 1 & 2: Gasolina 15W-40 / 20W-50 (Envase Blanco + Etiqueta Azul + Auto)
  if (pid === 'OIL-15W40-SL' || pid === 'OIL-20W50-SL' || pid.includes('15W40') || pid.includes('20W50') || desc.includes('15W-40') || desc.includes('20W-50')) {
    const viscosidad = (pid.includes('20W50') || desc.includes('20W-50') || desc.includes('20W50')) ? '20W-50' : '15W-40';
    return (
      <svg viewBox="0 0 200 220" width={width} height={height} style={{ background: '#ffffff', borderRadius: '8px', ...style }}>
        {/* Sombra suave */}
        <ellipse cx="100" cy="205" rx="50" ry="8" fill="rgba(0,0,0,0.12)" />
        {/* Tapa negra estriada */}
        <rect x="85" y="15" width="30" height="18" rx="3" fill="#1e293b" />
        <line x1="90" y1="15" x2="90" y2="33" stroke="#475569" strokeWidth="1.5" />
        <line x1="95" y1="15" x2="95" y2="33" stroke="#475569" strokeWidth="1.5" />
        <line x1="100" y1="15" x2="100" y2="33" stroke="#475569" strokeWidth="1.5" />
        <line x1="105" y1="15" x2="105" y2="33" stroke="#475569" strokeWidth="1.5" />
        <line x1="110" y1="15" x2="110" y2="33" stroke="#475569" strokeWidth="1.5" />
        
        {/* Cuello del envase */}
        <path d="M 88 33 L 112 33 L 116 50 L 84 50 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
        
        {/* Cuerpo del Envase Blanco Ergológico con Agarre */}
        <path d="M 60 50 Q 100 45 140 50 L 148 70 Q 154 120 148 195 C 148 200 140 202 100 202 C 60 202 52 200 52 195 Q 46 120 52 70 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2.5" />
        
        {/* Textura de agarre lateral ergonómico */}
        <line x1="144" y1="80" x2="148" y2="80" stroke="#94a3b8" strokeWidth="2" />
        <line x1="145" y1="95" x2="149" y2="95" stroke="#94a3b8" strokeWidth="2" />
        <line x1="145" y1="110" x2="149" y2="110" stroke="#94a3b8" strokeWidth="2" />
        <line x1="144" y1="125" x2="148" y2="125" stroke="#94a3b8" strokeWidth="2" />

        {/* Etiqueta Azul Oficial OILSTONE */}
        <rect x="62" y="70" width="76" height="115" rx="6" fill="#002b7a" stroke="#001a4d" strokeWidth="1.5" />
        
        {/* Logo Oilstone en Etiqueta */}
        <text x="100" y="88" fontFamily="sans-serif" fontWeight="900" fontSize="11" fill="#ffb703" textAnchor="middle" fontStyle="italic">oilSTONE®</text>
        <text x="100" y="98" fontFamily="sans-serif" fontWeight="700" fontSize="5.5" fill="#ffffff" textAnchor="middle">ACEITE LUBRICANTE GASOLINA</text>

        {/* Franja de Viscosidad Amarilla */}
        <rect x="62" y="104" width="76" height="15" fill="#ffb703" />
        <text x="100" y="115" fontFamily="sans-serif" fontWeight="900" fontSize="8.5" fill="#001a4d" textAnchor="middle">SAE {viscosidad} API SL</text>

        {/* Silueta de Auto en Etiqueta */}
        <path d="M 72 145 C 80 135 120 135 128 145 C 130 150 125 155 100 155 C 75 155 70 150 72 145 Z" fill="none" stroke="#60a5fa" strokeWidth="1.5" />
        <circle cx="82" cy="150" r="4" fill="#002b7a" stroke="#60a5fa" strokeWidth="1.5" />
        <circle cx="118" cy="150" r="4" fill="#002b7a" stroke="#60a5fa" strokeWidth="1.5" />

        {/* Badge Contenido 946 ml */}
        <rect x="67" y="166" width="34" height="12" rx="3" fill="#ffffff" />
        <text x="84" y="174" fontFamily="sans-serif" fontWeight="800" fontSize="5.5" fill="#002b7a" textAnchor="middle">946 ml</text>
      </svg>
    );
  }

  // Render 3: Gasolina Alto Kilometraje 25W-60 (Envase Blanco + Etiqueta Naranja/Roja)
  if (pid === 'OIL-25W60-SL' || pid.includes('25W60') || desc.includes('25W-60') || desc.includes('25W60') || desc.includes('ALTO KILOMETRAJE')) {
    return (
      <svg viewBox="0 0 200 220" width={width} height={height} style={{ background: '#ffffff', borderRadius: '8px', ...style }}>
        <ellipse cx="100" cy="205" rx="50" ry="8" fill="rgba(0,0,0,0.12)" />
        <rect x="85" y="15" width="30" height="18" rx="3" fill="#1e293b" />
        <path d="M 88 33 L 112 33 L 116 50 L 84 50 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M 60 50 Q 100 45 140 50 L 148 70 Q 154 120 148 195 C 148 200 140 202 100 202 C 60 202 52 200 52 195 Q 46 120 52 70 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2.5" />
        
        <rect x="62" y="70" width="76" height="115" rx="6" fill="#002b7a" stroke="#001a4d" strokeWidth="1.5" />
        <text x="100" y="88" fontFamily="sans-serif" fontWeight="900" fontSize="11" fill="#ffb703" textAnchor="middle" fontStyle="italic">oilSTONE®</text>
        <text x="100" y="98" fontFamily="sans-serif" fontWeight="700" fontSize="5.5" fill="#ffffff" textAnchor="middle">ALTO KILOMETRAJE</text>

        {/* Franja Naranja / Roja */}
        <rect x="62" y="104" width="76" height="16" fill="#e60012" />
        <text x="100" y="115" fontFamily="sans-serif" fontWeight="900" fontSize="7.5" fill="#ffffff" textAnchor="middle">SAE 25W-60 API SL</text>

        <rect x="67" y="166" width="34" height="12" rx="3" fill="#ffffff" />
        <text x="84" y="174" fontFamily="sans-serif" fontWeight="800" fontSize="5.5" fill="#e60012" textAnchor="middle">946 ml</text>
      </svg>
    );
  }

  // Render 6 & 12: Tambores y Cuñetes Industriales (Diesel SAE 50 / Hidráulico AW 68)
  if (productId === 'OIL-DIESEL-SAE50' || productId === 'OIL-HIDRA-AW68') {
    const isDiesel = productId === 'OIL-DIESEL-SAE50';
    const titulo = isDiesel ? 'DIESEL SAE 50' : 'HIDRÁULICO AW68';
    const colorLabel = isDiesel ? '#e60012' : '#ff9f00';
    return (
      <svg viewBox="0 0 200 220" width={width} height={height} style={{ background: '#ffffff', borderRadius: '8px' }}>
        <ellipse cx="100" cy="205" rx="55" ry="10" fill="rgba(0,0,0,0.15)" />
        
        {/* Cuñete Negro Industrial 19L */}
        <path d="M 60 70 L 140 70 L 146 195 C 146 200 135 203 100 203 C 65 203 54 200 54 195 Z" fill="#0f172a" stroke="#334155" strokeWidth="2" />
        
        {/* Asa metálica plateada */}
        <path d="M 52 85 Q 100 35 148 85" fill="none" stroke="#94a3b8" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="53" cy="85" r="4" fill="#64748b" />
        <circle cx="147" cy="85" r="4" fill="#64748b" />

        {/* Tapa Blanca */}
        <ellipse cx="100" cy="70" rx="40" ry="8" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" />

        {/* Etiqueta Frontal */}
        <rect x="70" y="95" width="60" height="85" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
        <rect x="70" y="95" width="60" height="22" fill={colorLabel} />
        <text x="100" y="109" fontFamily="sans-serif" fontWeight="900" fontSize="7" fill="#ffffff" textAnchor="middle">oilSTONE®</text>
        
        <text x="100" y="130" fontFamily="sans-serif" fontWeight="900" fontSize="7.5" fill="#0f172a" textAnchor="middle">{titulo}</text>
        <text x="100" y="142" fontFamily="sans-serif" fontWeight="700" fontSize="5.5" fill="#64748b" textAnchor="middle">{isDiesel ? 'API CF/CF-2' : 'ISO AW 68'}</text>

        <rect x="80" y="160" width="40" height="14" fill="#0f172a" rx="3" />
        <text x="100" y="170" fontFamily="sans-serif" fontWeight="800" fontSize="6.5" fill="#ffffff" textAnchor="middle">19 LITROS</text>
      </svg>
    );
  }

  // Render 7 & 8: Motos 2T / 4T (Envase Blanco + Icono Moto)
  if (productId === 'OIL-MOTOS-2T' || productId === 'OIL-MOTOS-4T') {
    const is2T = productId === 'OIL-MOTOS-2T';
    const titulo = is2T ? 'API TC JASO FB' : '20W-50 JASO MA2';
    const sub = is2T ? 'DOS TIEMPOS' : 'CUATRO TIEMPOS';
    const colorTag = is2T ? '#00f2fe' : '#ffb703';

    return (
      <svg viewBox="0 0 200 220" width={width} height={height} style={{ background: '#ffffff', borderRadius: '8px' }}>
        <ellipse cx="100" cy="205" rx="50" ry="8" fill="rgba(0,0,0,0.12)" />
        <rect x="85" y="15" width="30" height="18" rx="3" fill="#1e293b" />
        <path d="M 88 33 L 112 33 L 116 50 L 84 50 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M 60 50 Q 100 45 140 50 L 148 70 Q 154 120 148 195 C 148 200 140 202 100 202 C 60 202 52 200 52 195 Q 46 120 52 70 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2.5" />

        <rect x="62" y="70" width="76" height="115" rx="6" fill="#002b7a" stroke="#001a4d" strokeWidth="1.5" />
        <text x="100" y="88" fontFamily="sans-serif" fontWeight="900" fontSize="11" fill="#ffb703" textAnchor="middle" fontStyle="italic">oilSTONE®</text>
        <text x="100" y="98" fontFamily="sans-serif" fontWeight="800" fontSize="6" fill="#ffffff" textAnchor="middle">{sub}</text>

        <rect x="62" y="104" width="76" height="15" fill={colorTag} />
        <text x="100" y="115" fontFamily="sans-serif" fontWeight="900" fontSize="7.5" fill="#001a4d" textAnchor="middle">{titulo}</text>

        {/* Silueta de Motocicleta */}
        <circle cx="82" cy="146" r="8" fill="none" stroke="#60a5fa" strokeWidth="1.5" />
        <circle cx="118" cy="146" r="8" fill="none" stroke="#60a5fa" strokeWidth="1.5" />
        <path d="M 82 146 L 96 135 L 108 140 L 118 146" fill="none" stroke="#60a5fa" strokeWidth="1.5" />

        <rect x="67" y="166" width="34" height="12" rx="3" fill="#ffffff" />
        <text x="84" y="174" fontFamily="sans-serif" fontWeight="800" fontSize="5.5" fill="#002b7a" textAnchor="middle">946 ml</text>
      </svg>
    );
  }

  // Render 9: Fuera de Borda TC-W3 Marítimo (Envase Blanco + Lancha + Etiqueta Azul Agua)
  if (productId === 'OIL-OUTBOARD-TCW3') {
    return (
      <svg viewBox="0 0 200 220" width={width} height={height} style={{ background: '#ffffff', borderRadius: '8px' }}>
        <ellipse cx="100" cy="205" rx="50" ry="8" fill="rgba(0,0,0,0.12)" />
        <rect x="85" y="15" width="30" height="18" rx="3" fill="#1e293b" />
        <path d="M 88 33 L 112 33 L 116 50 L 84 50 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M 60 50 Q 100 45 140 50 L 148 70 Q 154 120 148 195 C 148 200 140 202 100 202 C 60 202 52 200 52 195 Q 46 120 52 70 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2.5" />

        <rect x="62" y="70" width="76" height="115" rx="6" fill="#0284c7" stroke="#0369a1" strokeWidth="1.5" />
        <text x="100" y="88" fontFamily="sans-serif" fontWeight="900" fontSize="11" fill="#ffb703" textAnchor="middle" fontStyle="italic">oilSTONE®</text>
        <text x="100" y="98" fontFamily="sans-serif" fontWeight="800" fontSize="6" fill="#ffffff" textAnchor="middle">FUERA DE BORDA</text>

        <rect x="62" y="104" width="76" height="15" fill="#ffb703" />
        <text x="100" y="115" fontFamily="sans-serif" fontWeight="900" fontSize="8" fill="#0369a1" textAnchor="middle">API TC-W3</text>

        {/* Lancha / Bote en olas */}
        <path d="M 75 145 C 90 140 110 140 125 145 L 120 152 C 105 152 90 152 78 152 Z" fill="#ffffff" />
        <path d="M 70 154 Q 100 158 130 154" fill="none" stroke="#e0f2fe" strokeWidth="2" />

        <rect x="67" y="166" width="34" height="12" rx="3" fill="#ffffff" />
        <text x="84" y="174" fontFamily="sans-serif" fontWeight="800" fontSize="5.5" fill="#0284c7" textAnchor="middle">946 ml</text>
      </svg>
    );
  }

  // Render 10: ATF Mercon Dexron II (Envase Blanco + Etiqueta ROJA Transmisión)
  if (productId === 'OIL-ATF-DEX2') {
    return (
      <svg viewBox="0 0 200 220" width={width} height={height} style={{ background: '#ffffff', borderRadius: '8px' }}>
        <ellipse cx="100" cy="205" rx="50" ry="8" fill="rgba(0,0,0,0.12)" />
        <rect x="85" y="15" width="30" height="18" rx="3" fill="#1e293b" />
        <path d="M 88 33 L 112 33 L 116 50 L 84 50 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M 60 50 Q 100 45 140 50 L 148 70 Q 154 120 148 195 C 148 200 140 202 100 202 C 60 202 52 200 52 195 Q 46 120 52 70 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2.5" />

        <rect x="62" y="70" width="76" height="115" rx="6" fill="#dc2626" stroke="#b91c1c" strokeWidth="1.5" />
        <text x="100" y="88" fontFamily="sans-serif" fontWeight="900" fontSize="11" fill="#ffb703" textAnchor="middle" fontStyle="italic">oilSTONE®</text>
        <text x="100" y="98" fontFamily="sans-serif" fontWeight="800" fontSize="5.5" fill="#ffffff" textAnchor="middle">TRANSMISIONES AUTOMÁTICAS</text>

        <rect x="62" y="104" width="76" height="15" fill="#ffb703" />
        <text x="100" y="115" fontFamily="sans-serif" fontWeight="900" fontSize="7" fill="#b91c1c" textAnchor="middle">MERCON - DEXRON II</text>

        {/* Engranajes Redondos en Etiqueta */}
        <circle cx="88" cy="144" r="10" fill="none" stroke="#fca5a5" strokeWidth="1.5" />
        <circle cx="110" cy="148" r="7" fill="none" stroke="#fca5a5" strokeWidth="1.5" />

        <rect x="67" y="166" width="34" height="12" rx="3" fill="#ffffff" />
        <text x="84" y="174" fontFamily="sans-serif" fontWeight="800" fontSize="5.5" fill="#dc2626" textAnchor="middle">946 ml</text>
      </svg>
    );
  }

  // Render 11: Transmisiones Manuales SAE 140 GL-4 (Envase Blanco + Etiqueta Verde + Patrón de Cambios H)
  if (productId === 'OIL-TRANS-SAE140') {
    return (
      <svg viewBox="0 0 200 220" width={width} height={height} style={{ background: '#ffffff', borderRadius: '8px' }}>
        <ellipse cx="100" cy="205" rx="50" ry="8" fill="rgba(0,0,0,0.12)" />
        <rect x="85" y="15" width="30" height="18" rx="3" fill="#1e293b" />
        <path d="M 88 33 L 112 33 L 116 50 L 84 50 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M 60 50 Q 100 45 140 50 L 148 70 Q 154 120 148 195 C 148 200 140 202 100 202 C 60 202 52 200 52 195 Q 46 120 52 70 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2.5" />

        <rect x="62" y="70" width="76" height="115" rx="6" fill="#047857" stroke="#065f46" strokeWidth="1.5" />
        <text x="100" y="88" fontFamily="sans-serif" fontWeight="900" fontSize="11" fill="#ffb703" textAnchor="middle" fontStyle="italic">oilSTONE®</text>
        <text x="100" y="98" fontFamily="sans-serif" fontWeight="800" fontSize="5.5" fill="#ffffff" textAnchor="middle">MANUALES Y DIFERENCIALES</text>

        <rect x="62" y="104" width="76" height="15" fill="#ffb703" />
        <text x="100" y="115" fontFamily="sans-serif" fontWeight="900" fontSize="7.5" fill="#065f46" textAnchor="middle">SAE 140 API GL-4</text>

        {/* Palanca de Cambios H */}
        <path d="M 90 136 L 90 154 M 110 136 L 110 154 M 90 145 L 110 145" stroke="#a7f3d0" strokeWidth="2" strokeLinecap="round" />

        <rect x="67" y="166" width="34" height="12" rx="3" fill="#ffffff" />
        <text x="84" y="174" fontFamily="sans-serif" fontWeight="800" fontSize="5.5" fill="#047857" textAnchor="middle">946 ml</text>
      </svg>
    );
  }

  // Render genérico de seguridad para productos nuevos cargados por el usuario
  return (
    <svg viewBox="0 0 200 220" width={width} height={height} style={{ background: '#ffffff', borderRadius: '8px' }}>
      <ellipse cx="100" cy="205" rx="50" ry="8" fill="rgba(0,0,0,0.12)" />
      <rect x="85" y="15" width="30" height="18" rx="3" fill="#1e293b" />
      <path d="M 60 50 Q 100 45 140 50 L 148 70 Q 154 120 148 195 C 148 200 140 202 100 202 C 60 202 52 200 52 195 Q 46 120 52 70 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2.5" />
      <rect x="62" y="70" width="76" height="115" rx="6" fill="#002b7a" />
      <text x="100" y="95" fontFamily="sans-serif" fontWeight="900" fontSize="12" fill="#ffb703" textAnchor="middle">oilSTONE®</text>
      <rect x="62" y="110" width="76" height="16" fill="#ffb703" />
      <text x="100" y="122" fontFamily="sans-serif" fontWeight="900" fontSize="8" fill="#002b7a" textAnchor="middle">LUBRICANTE</text>
    </svg>
  );
}
