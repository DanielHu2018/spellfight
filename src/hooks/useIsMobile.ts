import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    const handle = () => setIsMobile(mql.matches);
    mql.addEventListener('change', handle);
    return () => mql.removeEventListener('change', handle);
  }, []);

  return isMobile;
}
