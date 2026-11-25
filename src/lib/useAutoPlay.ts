import { useEffect, type RefObject } from 'react';

// Plays a muted video while at least a quarter of it is on screen and pauses it once it leaves (or the tab is hidden).
// A visitor's own pause is kept until they press play again.
// To keep the page light the video should start with preload="none": nothing is fetched until it comes within about
// a screen of the viewport, when only its metadata is asked for, so the first frame is ready by the time it plays.
export function useAutoPlay(videoRef: RefObject<HTMLVideoElement | null>, key: string) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false, userPaused = false, automaticPause = false;
    const sync = () => {
      if (visible && !motion.matches && !userPaused && !document.hidden) {
        video.play().catch(() => { /* Native controls remain available if autoplay is blocked. */ });
      } else if (!video.paused) {
        automaticPause = true; video.pause();
      }
    };
    const onPause = () => {
      if (!automaticPause && visible && !document.hidden) userPaused = true;
      automaticPause = false;
    };
    const onPlay = () => { userPaused = false; };
    const warm = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      if (video.preload === 'none') video.preload = 'metadata';
      warm.disconnect();
    }, { rootMargin: '100% 0px' });
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= .25; sync();
    }, { threshold: [0, .25] });
    warm.observe(video); observer.observe(video);
    video.addEventListener('pause', onPause); video.addEventListener('play', onPlay);
    motion.addEventListener('change', sync); document.addEventListener('visibilitychange', sync);
    return () => {
      warm.disconnect(); observer.disconnect(); motion.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
      video.removeEventListener('pause', onPause); video.removeEventListener('play', onPlay);
      video.pause();
    };
  }, [key]);
}
