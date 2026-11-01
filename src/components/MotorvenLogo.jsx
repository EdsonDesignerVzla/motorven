import React from 'react';
import motorvenLogoImg from '../assets/logo_motorven_limpio.png';

export default function MotorvenLogo({ width = 220, height = 'auto', className = '' }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <img
        src={motorvenLogoImg}
        alt="Logo Motorven"
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
          objectFit: 'contain',
          filter: 'var(--logo-filter, drop-shadow(0 4px 14px rgba(0, 0, 0, 0.45)))'
        }}
        className={className}
      />
    </div>
  );
}

