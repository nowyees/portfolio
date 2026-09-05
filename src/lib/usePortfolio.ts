import { useEffect, useState } from 'react';
import { getAllProjects, getInitialProjects } from './portfolioService';

export function usePortfolio() {
  const [projects, setProjects] = useState(getInitialProjects);
  useEffect(() => {
    let mounted = true;
    getAllProjects().then(items => { if (mounted) setProjects(items); });
    return () => { mounted = false; };
  }, []);
  return projects;
}

export function imageUrl(url: string, width = 1200) {
  if (!url?.includes('res.cloudinary.com/') || !url.includes('/image/upload/')) return url;
  return url.replace('/image/upload/', '/image/upload/f_auto,q_auto,w_' + width + ',c_limit/');
}
