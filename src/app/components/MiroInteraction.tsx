import React, { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/i18n';

// The DDP booth piece runs as its own site (webcam + gesture recognition). It is embedded here in its
// `?embed` mode, which waits for the host: the buttons below stand in for the gestures, and the camera
// only starts if the visitor asks for it. Messages: see the embed section of miro-interaction/app.js.
const ORIGIN = 'https://nowyees.github.io';
// Bump `v` after updating the Miro site so the embed never shows a cached older page.
const SRC = `${ORIGIN}/miro-interaction/?embed&v=39`;
const ICON = (name: string) => `${ORIGIN}/miro-interaction/guide/${name}.png`;

const GESTURES = [
  { name: 'RSP', icon: 'point', label: 'Rock paper scissors', ko: '가위바위보' },
  { name: 'HI', icon: 'wave', label: 'Wave', ko: '인사' },
  { name: 'PICTURE', icon: 'v', label: 'Photo', ko: '사진' },
  { name: 'TOMATO', icon: 'finger-heart', label: 'Heart', ko: '하트' },
] as const;

type MiroState = { state: string; camera: boolean; status: string };
const PLAYING = new Set(['RSP', 'HI', 'PICTURE', 'TOMATO']);

export default function MiroInteraction({ className }: { className?: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null), t = useT();
  const [miro, setMiro] = useState<MiroState>({ state: 'LOADING', camera: false, status: '' });

  const send = (message: object) => frameRef.current?.contentWindow?.postMessage(message, ORIGIN);
  useEffect(() => {
    const receive = ({ origin, source, data }: MessageEvent) => {
      if (origin !== ORIGIN || source !== frameRef.current?.contentWindow || data?.miro !== 'state') return;
      setMiro({ state: data.state, camera: !!data.camera, status: data.status || '' });
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);

  const { state } = miro;
  // One step at a time: only the buttons that work right now are shown. What to do is told by the
  // guide on the video itself, so the panel has no hint text of its own.
  const step = state === 'IDLE' ? 'call' : state === 'DEFAULT' ? 'choose' : PLAYING.has(state) ? 'playing' : 'wait';

  return (
    <div className={`${className ?? ''} miro-piece`}>
      <button type="button" className="miro-camera" disabled={miro.camera} onClick={() => send({ miro: 'camera' })}>
        {miro.camera ? t('카메라 켜짐 · 손동작으로도 반응해요', 'Camera on · Miro answers your hands too') : t('웹캠으로 해보기', 'Try it with your webcam')}
      </button>
      <iframe ref={frameRef} className="miro-frame" src={SRC} title="MIRO interactive web" allow="camera; fullscreen"
        onLoad={() => send({ miro: 'hello' })} />
      <div className="miro-panel">
        <div className="miro-buttons">
          {step === 'call' && (
            <button type="button" className="miro-button is-call" onClick={() => send({ miro: 'wake' })}>{t('Miro 부르기', 'Call Miro')}</button>
          )}
          {(step === 'choose' || step === 'playing') && GESTURES.map(g => (
            <button key={g.name} type="button" className="miro-button" disabled={step !== 'choose'}
              onClick={() => send({ miro: 'gesture', name: g.name })}>
              <img src={ICON(g.icon)} alt="" />{t(g.ko, g.label)}
            </button>
          ))}
        </div>
        <p className="miro-links">
          {state !== 'IDLE' && state !== 'LOADING' && (
            <button type="button" onClick={() => send({ miro: 'reset' })}>{t('처음으로', 'Start over')}</button>
          )}
        </p>
      </div>
    </div>
  );
}
