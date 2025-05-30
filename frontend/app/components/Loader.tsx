import React from 'react';
import '../styles/loader.css';

interface LoaderProps {
  className?: string;
}

export function Loader({ className = '' }: LoaderProps) {
  return (
    <div className={`loader ${className}`}>
      <div className="intern"></div>
      <div className="external-shadow">
        <div className="central"></div>
      </div>
    </div>
  );
}

export default Loader;