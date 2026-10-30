import React, { useEffect, useRef, useState } from 'react';

// The DDP booth piece runs as its own site (webcam + gesture recognition). It is embedded here in its
// `?embed` mode, which waits for the host: the buttons below stand in for the gestures, and the camera
// only starts if the visitor asks for it. Messages: see the embed section of miro-interaction/app.js.
const ORIGIN = 'https://nowyees.github.io';
const SRC = `${ORIGIN}/miro-interaction/?embed`;
const ICON = (name: string) => `${ORIGIN}/miro-interaction/guide/${name}.png`;

const GESTURES = [
  { name: 'RSP', icon: 'point', label: '가위바위보' },
  { name: 'HI', icon: 'wave', label: '인사' },
  { name: 'PICTURE', icon: 'v', label: '사진' },
  { name: 'TOMATO', icon: 'finger-heart', label: '하트' },
] as const;

type MiroState = { state: string; camera: boolean; status: string };
const PLAYING = new Set(['RSP', 'HI', 'PICTURE', 'TOMATO']);

export default function MiroInteraction({ className }: { className?: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
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
  // One step at a time: only the buttons that work right now are shown.
  const step = state === 'IDLE' ? 'call' : state === 'DEFAULT' ? 'choose' : PLAYING.has(state) ? 'playing' : 'wait';
  const note = state === 'LOADING' ? '불러오는 중…'
    : step === 'call' ? '버튼을 눌러 Miro를 불러 보세요'
    : step === 'choose' ? '동작을 골라 보세요'
    : step === 'playing' ? 'Miro가 반응하고 있어요'
    : 'Miro가 다가오고 있어요';

  return (
    <div className={`${className ?? ''} miro-piece`}>
      <iframe ref={frameRef} className="miro-frame" src={SRC} title="MIRO interactive web" allow="camera; fullscreen"
        onLoad={() => send({ miro: 'hello' })} />
      <div className="miro-panel">
        <p className="miro-note" aria-live="polite">{miro.status || note}</p>
        <div className="miro-buttons">
          {step === 'call' && (
            <button type="button" className="miro-button is-call" onClick={() => send({ miro: 'wake' })}>Miro 부르기</button>
          )}
          {(step === 'choose' || step === 'playing') && GESTURES.map(g => (
            <button key={g.name} type="button" className="miro-button" disabled={step !== 'choose'}
              onClick={() => send({ miro: 'gesture', name: g.name })}>
              <img src={ICON(g.icon)} alt="" />{g.label}
            </button>
          ))}
        </div>
        <p className="miro-links">
          {state !== 'IDLE' && state !== 'LOADING' && (
            <button type="button" onClick={() => send({ miro: 'reset' })}>처음으로</button>
          )}
          <button type="button" disabled={miro.camera} onClick={() => send({ miro: 'camera' })}>
            {miro.camera ? '카메라 켜짐 · 손동작으로도 반응해요' : '웹캠으로 해보기'}
          </button>
        </p>
      </div>
    </div>
  );
}
