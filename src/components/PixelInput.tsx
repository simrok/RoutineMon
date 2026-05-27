'use client';

interface PixelInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: 'text' | 'password' | 'number';
  className?: string;
}

export default function PixelInput({
  value,
  onChange,
  placeholder,
  maxLength,
  type = 'text',
  className = '',
}: PixelInputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className={`
        font-galmuri text-black bg-white
        border-2 border-black
        px-3 py-2 text-center
        focus:outline-none focus:ring-2 focus:ring-cyan
        ${className}
      `}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}