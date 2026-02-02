import React from 'react';

interface StepCardProps {
  stepNumber: number;
  title: string;
  description: string;
  stepColor?: 'primary' | 'secondary';
}

export const StepCard: React.FC<StepCardProps> = ({
  stepNumber,
  title,
  description,
  stepColor = 'primary'
}) => {
  const stepBgColor = stepColor === 'primary' ? 'bg-primary' : 'bg-secondary';
  
  return (
    <div className="text-center">
      <div className={`w-20 h-20 ${stepBgColor} rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold`}>
        {stepNumber}
      </div>
      <h3 className="text-2xl font-semibold text-foreground mb-4">{title}</h3>
      <p className="text-foreground-secondary">{description}</p>
    </div>
  );
};
