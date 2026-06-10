import React from 'react';

interface BrandMarkProps {
  compact?: boolean;
}

export default function BrandMark({ compact = false }: BrandMarkProps) {
  if (compact) {
    return (
      <img
        src="/logo-tkf.png"
        className="h-8 w-auto object-contain"
        alt="Logo TKF"
      />
    );
  }

  return (
    <img
      src="/logo-tkf.png"
      className="h-24 md:h-28 w-auto mx-auto object-contain"
      alt="Logo TKF"
    />
  );
}
