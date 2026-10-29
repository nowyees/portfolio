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
  const busy = state === 'WAKING' || state === 'ONBOARD';
  const note = state === 'LOADING' ? '불러오는 중…'
    : state === 'IDLE' ? 'Miro를 불러 보세요'
    : busy ? 'Miro가 다가오는 중…'
    : state === 'DEFAULT' ? '동작을 골라 보세요'
    : state === 'BACK' ? '' : 'Miro가 반응하는 중…';

  return (
    <div className={`${className ?? ''} miro-piece`}>
      <iframe ref={frameRef} className="miro-frame" src={SRC} title="MIRO interactive web" allow="camera; fullscreen"
        onLoad={() => send({ miro: 'hello' })} />
      <div className="miro-panel">
        <p className="miro-note" aria-live="polite">{miro.status || note}</p>
        <div className="miro-buttons">
          <button type="button" className="miro-button is-wake" disabled={state !== 'IDLE'} onClick={() => send({ miro: 'wake' })}>Miro 부르기</button>
          {GESTURES.map(g => (
            <button key={g.name} type="button" className="miro-button" disabled={state !== 'DEFAULT'}
              onClick={() => send({ miro: 'gesture', name: g.name })}>
              <img src={ICON(g.icon)} alt="" />{g.label}
            </button>
          ))}
          <button type="button" className="miro-button is-reset" disabled={state === 'IDLE' || state === 'LOADING'} onClick={() => send({ miro: 'reset' })}>처음으로</button>
        </div>
        <button type="button" className="miro-camera" disabled={miro.camera} onClick={() => send({ miro: 'camera' })}>
          {miro.camera ? '카메라 켜짐 · 손동작으로도 반응해요' : '웹캠이 있다면 카메라로 해보기'}
        </button>
      </div>
    </div>
  );
}
