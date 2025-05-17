import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import logger from '../utils/logger';

interface HiddenModeContextType {
  isHiddenModeActive: boolean;
  activateHiddenMode: () => void;
  // Future: deactivateHiddenMode: () => void;
}

const HiddenModeContext = createContext<HiddenModeContextType | undefined>(undefined);

export const HiddenModeProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [isHiddenModeActive, setIsHiddenModeActive] = useState(false);

  const activateHiddenMode = useCallback(() => {
    logger.info('[HiddenModeContext] Hidden Mode Activated.');
    setIsHiddenModeActive(true);
  }, []);

  // const deactivateHiddenMode = useCallback(() => {
  //   logger.info('[HiddenModeContext] Hidden Mode Deactivated.');
  //   setIsHiddenModeActive(false);
  // }, []);

  return (
    <HiddenModeContext.Provider value={{ isHiddenModeActive, activateHiddenMode }}>
      {children}
    </HiddenModeContext.Provider>
  );
};

export const useHiddenMode = () => {
  const context = useContext(HiddenModeContext);
  if (context === undefined) {
    throw new Error('useHiddenMode must be used within a HiddenModeProvider');
  }
  return context;
}; 