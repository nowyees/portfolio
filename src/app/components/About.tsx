import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import SiteShell from './SiteShell';
import ContactDialog from './ContactDialog';
import { useT } from '../../lib/i18n';

export default function About() {
  const [contactOpen, setContactOpen] = useState(false);
  const t = useT();
  const location = useLocation();
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [location.hash]);

  return <SiteShell active="about">
    <main className="about-page">
      <section className="about-opening">
        {t('ko', 'en') === 'ko' ? <h1>사물과 사람, 그리고<br />그 둘을 잇는 이야기<br />사이의 공간을 탐구합니다.</h1> : <h1>Exploring the space between<br />objects, people and the<br />stories that connect them.</h1>}
        <p>{t('이재웅 — 디자인 엔지니어', 'Lee Jae Woong — Design Engineer')}</p>
      </section>
      <section className="about-disciplines" aria-label="Design disciplines">
        <div><h2>{t('제품 디자인', 'Product Design')}</h2><p>{t('오브제', 'Objects')}<br />{t('로보틱스', 'Robotics')}<br />{t('웨어러블 디바이스', 'Wearable Devices')}<br />{t('디자인 엔지니어링', 'Design Engineering')}</p></div>
        <div><h2>{t('비주얼 탐구', 'Visual Exploration')}</h2><p>{t('이미지 메이킹', 'Image Making')}<br />{t('3D 디자인', '3D Design')}<br />{t('스페큘러티브 디자인', 'Speculative Design')}<br />{t('패션 & 공간', 'Fashion & Space')}</p></div>
      </section>
      <section id="contact" className="about-contact-section">
        <div className="about-press"><h2>{t('언론 보도', 'Selected Press')}</h2><a href="https://www.dezeen.com/2025/12/15/wearable-device-for-sensory-problems-among-projects-from-hongik-university/" target="_blank" rel="noopener noreferrer">Dezeen <sup>2025</sup></a><p>LUNARIS</p></div>
        <div className="about-contact"><h2>{t('연락처', 'Contact')}</h2><a href="mailto:ljwoong1104@gmail.com">ljwoong1104@gmail.com</a><a href="https://instagram.com/now_y_es" target="_blank" rel="noopener noreferrer">Instagram ↗︎</a><a href="tel:010-2380-9280">010-2380-9280</a><button type="button" onClick={() => setContactOpen(true)}>Contact / Admin ↗︎</button></div>
      </section>
      <footer className="about-bottom"><Link to="/">LJ .W</Link><span>{t('이재웅', 'Lee Jae Woong')}</span><button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>{t('맨 위로', 'Back to top')} ↑︎</button></footer>
    </main>
    <ContactDialog open={contactOpen} onClose={() => setContactOpen(false)} dark={false} />
  </SiteShell>;
}

