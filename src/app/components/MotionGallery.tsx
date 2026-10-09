import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import SiteShell from './SiteShell';
import AstroTail from './AstroTail';

// Rigged pieces you can move, one at a time; the arrows (or ← →) step through them.
// Old /motion/astronaut-tail links still open the same piece (unknown ids fall back to the first).
const pieces: Array<{ id: string; title: string; Piece: React.ComponentType<{ className?: string }> }> = [
  { id: 'lunaris', title: 'Lunaris', Piece: AstroTail },
];

const count = (n: number) => String(n).padStart(2, '0');

export default function MotionGallery() {
  const { id } = useParams(), navigate = useNavigate();
  const index = Math.max(0, pieces.findIndex(piece => piece.id === id));
  const { title, Piece } = pieces[index];
  const single = pieces.length < 2;
  const go = (step: number) => {
    if (single) return;
    navigate('/motion/' + pieces[(index + step + pieces.length) % pieces.length].id, { replace: true });
  };

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'ArrowLeft') go(-1); else if (event.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });

  return (
    <SiteShell active="motion">
      <main className="motion-gallery">
        {/* A specimen frame: the piece inside, a tab on its corner, and its number and name beside it. */}
        <figure className="motion-frame">
          <Piece key={pieces[index].id} className="motion-stage" />
          <span className="motion-frame-tab" aria-hidden="true" />
          <figcaption className="motion-label"><span>{count(index + 1)}</span>{title}</figcaption>
        </figure>
        <button type="button" className="motion-arrow is-prev" aria-label="Previous piece" disabled={single} onClick={() => go(-1)}><span aria-hidden="true" /></button>
        <button type="button" className="motion-arrow is-next" aria-label="Next piece" disabled={single} onClick={() => go(1)}><span aria-hidden="true" /></button>
      </main>
    </SiteShell>
  );
}
