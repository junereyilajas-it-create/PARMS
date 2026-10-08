import React from 'react';
import { useNavigate } from 'react-router-dom';

export const SYSTEM_LOGO_SRC = '/logo.png';

interface SystemLogoProps {
  className?: string;
  onClick?: () => void;
  clickable?: boolean;
  navigateTo?: string;
}

export const SystemLogo: React.FC<SystemLogoProps> = ({ 
  className = "w-8 h-8 object-contain", 
  onClick,
  clickable = true,
  navigateTo
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (!clickable) return;
    if (onClick) {
      onClick();
    } else if (navigateTo) {
      navigate(navigateTo);
    } else {
      navigate('/');
    }
  };

  return (
    <img 
      src={SYSTEM_LOGO_SRC} 
      alt="System Logo" 
      className={`${className} ${clickable ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
    />
  );
};
