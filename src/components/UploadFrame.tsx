'use client';

import { useState } from 'react';
import { GhostColor } from '@/lib/types';
import { GHOST_COLORS } from '@/lib/constants';

interface UploadFrameProps {
  color: GhostColor;
  disabled?: boolean;
  isMe?: boolean;
  photoUrl?: string;
  uploadedAt?: string;
  onUpload?: (file: File) => void;
}

export default function UploadFrame({
  color,
  disabled = false,
  isMe = false,
  photoUrl,
  uploadedAt,
  onUpload,
}: UploadFrameProps) {
  const borderColor = GHOST_COLORS[color];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpload) {
      onUpload(file);
    }
  };

  return (
    <div className="relative">
      <label
        className={`
          block w-20 h-20 border-[3px] relative
          ${disabled ? 'bg-gray-300 cursor-not-allowed' : 'bg-white'}
          ${isMe && !disabled ? 'cursor-pointer hover:scale-105 transition-transform' : ''}
        `}
        style={{
          borderColor: borderColor,
          boxShadow: '2px 2px 0 #000',
        }}
      >
        {photoUrl ? (
          <>
            <img
              src={photoUrl}
              alt="upload"
              className="w-full h-full object-cover"
            />
            {uploadedAt && (
              <span
                className="absolute top-1 left-1 font-pixel text-[8px]"
                style={{ color: '#5B35FF', textShadow: '0 0 2px white' }}
              >
                {uploadedAt}
              </span>
            )}
            <span
              className="absolute bottom-1 right-1 text-lg"
              style={{ color: '#1FF4E1' }}
            >
              ✦
            </span>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {disabled ? (
              <span className="text-gray-500 text-xs">🔒</span>
            ) : isMe ? (
              <span className="text-2xl text-gray-400">+</span>
            ) : (
              <span className="text-gray-400 text-xs">···</span>
            )}
          </div>
        )}

        {isMe && !disabled && (
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        )}
      </label>
    </div>
  );
}