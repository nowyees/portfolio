import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import SiteShell from './SiteShell';
import AstroTail from './AstroTail';
import DualArmIK from './DualArmIK';
import HorseMotion from './HorseMotion';
import MiroInteraction from './MiroInteraction';

// Rigged pieces you can move, one at a time; the arrows (or ← →) step through them.
type Guide = { pointer: [string, string]; touch: [string, string] };   // [Korean, English]
const pieces: Array<{ id: string; title: string; note: string; guide?: Guide; Piece: React.ComponentType<{ className?: string }> }> = [
  // MIRO carries its own step-by-step hint under the video, so no guide line on top.
  { id: 'miro', title: 'Interactive web', note: 'MIRO', Piece: MiroInteraction },
  { id: 'astronaut-tail', title: 'Graduation work', note: 'Robotic tail', Piece: AstroTail, guide: {
    pointer: ['마우스를 움직여 꼬리를 흔들어 보세요', 'Move your cursor to swing the tail'],
    touch: ['화면을 쓸어 꼬리를 흔들어 보세요', 'Drag across the screen to swing the tail'] } },
  { id: 'dual-arm-ik', title: 'Motion study', note: 'Dual-arm IK', Piece: DualArmIK, guide: {
    pointer: ['선이 굵어지는 부분을 끌어서 움직여 보세요', 'Drag a part whose lines turn bold to move it'],
    touch: ['로봇의 부분을 끌어서 움직여 보세요', 'Drag a part of the robot to move it'] } },
  { id: 'horse', title: 'Motion study', note: 'HORSE', Piece: HorseMotion, guide: {
    pointer: ['클릭하면 준비 자세를 취해요', 'Click to make it crouch ready'],
    touch: ['탭하면 준비 자세를 취해요', 'Tap to make it crouch ready'] } },
];

export default function MotionGallery() {
  const { id } = useParams(), navigate = useNavigate();
  const index = Math.max(0, pieces.findIndex(piece => piece.id === id));
  const { title, note, guide, Piece } = pieces[index];
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

  const count = (n: number) => String(n).padStart(2, '0');
  return (
    <SiteShell active="motion">
      <main className="motion-gallery">
        <Piece key={pieces[index].id} className="motion-stage" />
        {/* How to play with it: Korean first, English smaller and grey beneath (touch wording on touch screens). */}
        {guide && <p className="motion-guide">
          <span className="is-pointer">{guide.pointer[0]}</span>
          <span className="is-touch">{guide.touch[0]}</span>
          <small className="is-pointer">{guide.pointer[1]}</small>
          <small className="is-touch">{guide.touch[1]}</small>
        </p>}
        <button type="button" className="motion-arrow is-prev" aria-label="Previous piece" disabled={single} onClick={() => go(-1)}><span aria-hidden="true" /></button>
        <button type="button" className="motion-arrow is-next" aria-label="Next piece" disabled={single} onClick={() => go(1)}><span aria-hidden="true" /></button>
        <p className="motion-caption"><em>{title}</em> — {note}<span className="motion-count">{count(index + 1)} / {count(pieces.length)}</span></p>
      </main>
    </SiteShell>
  );
}
