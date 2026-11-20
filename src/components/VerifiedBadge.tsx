import React from 'react';

export const VerifiedBadge: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    aria-label="Подтверждённый аккаунт"
    title="Подтверждённый аккаунт (галочка)"
    className={`inline-block shrink-0 ${className}`}
  >
    <path
      d="M12 2L14.3 3.7L17.1 3.3L18.2 5.9L20.7 7.1L20.3 9.9L22 12L20.3 14.1L20.7 16.9L18.2 18.1L17.1 20.7L14.3 20.3L12 22L9.7 20.3L6.9 20.7L5.8 18.1L3.3 16.9L3.7 14.1L2 12L3.7 9.9L3.3 7.1L5.8 5.9L6.9 3.3L9.7 3.7L12 2Z"
      fill="#2AABEE"
    />
    <path
      d="M8.8 12.3L10.9 14.4L15.4 9.7"
      stroke="#FFFFFF"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
