'use client';

import { useState, useEffect } from 'react';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

export function useScreenSize() {
  const [screenSize, setScreenSize] = useState({ isMobile: false, width: 1024 });

  useEffect(() => {
    const updateSize = () => {
      setScreenSize({
        isMobile: window.innerWidth < 640,
        width: window.innerWidth,
      });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return screenSize;
}
