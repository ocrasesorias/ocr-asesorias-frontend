import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'outlined';
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default'
}) => {
  const baseClasses = 'bg-white rounded-lg';
  
  const variantClasses = {
    default: 'shadow-sm',
    elevated: 'shadow-2xl',
    outlined: 'border border-gray-200'
  };
  
  const classes = `${baseClasses} ${variantClasses[variant]} ${className}`;
  
  return (
    <div className={classes}>
      {children}
    </div>
  );
};
