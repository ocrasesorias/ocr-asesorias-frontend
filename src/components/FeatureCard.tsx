import React from 'react';
import { Card } from './Card';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  iconColor?: 'primary' | 'secondary';
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  iconColor = 'primary'
}) => {
  const iconBgColor = iconColor === 'primary' ? 'bg-primary' : 'bg-secondary';
  
  return (
    <Card className="text-center p-6 hover:shadow-lg transition-shadow">
      <div className={`w-16 h-16 ${iconBgColor} rounded-full flex items-center justify-center mx-auto mb-4`}>
        <div className="w-8 h-8 text-white">
          {icon}
        </div>
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-foreground-secondary">{description}</p>
    </Card>
  );
};
