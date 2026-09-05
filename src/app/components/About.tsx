import React, { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';

const chapters = [
  {
    title: 'Intention',
    left: '디자인은 단순히 보여지는 것 이상이라고 믿습니다. 각 프로젝트는 명확한 의도에서 시작됩니다. 누구를 위한 것인지, 어떤 경험을 만들어야 하는지, 그리고 그것이 왜 존재해야 하는지를 먼저 이해하는 것이 좋은 결과물의 출발점입니다.',
    right: '그래서 모든 결정에는 맥락과 방향이 함께합니다. 형태, 기능, 그리고 목적이 하나로 정렬될 때, 비로소 설득력 있는 결과물이 만들어집니다.',
  },
  {
    title: 'Craft',
    left: '좋은 디자인과 훌륭한 디자인의 차이는 가장 작은 디테일에서 결정됩니다. 자간 하나, 여백의 밀도, 눈에 띄지 않는 전환 효과 — 이런 순간들이 전체 품질을 조용히 정의합니다.',
    right: '디테일에 대한 집착은 과도한 것이 아니라 필수적인 것입니다. 모든 요소가 불가피하게 느껴질 때까지, 다른 방식으로는 존재할 수 없다고 느껴질 때까지 다듬는 과정입니다.',
  },
  {
    title: 'Experience',
    left: '디자인은 표면적인 아름다움만이 아닙니다. 손에 어떻게 느껴지는지, 시선을 어떻게 이끄는지, 인터랙션에 얼마나 자연스럽게 반응하는지 — 경험 그 자체가 디자인의 핵심입니다.',
    right: '심미성과 기능성은 대립하는 것이 아닌 같은 대화의 일부입니다. 이 둘이 매끄럽게 결합될 때 직관적이고 몰입감 있는 결과물이 완성됩니다.',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function About() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#fafaf8] text-[#111] font-['Pretendard',sans-serif] selection:bg-[#111] selection:text-[#fafaf8]">

      {/* ── Floating Navigation ── */}
      <nav className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-1">
        <button
          onClick={() => navigate('/')}
          className="py-1.5 px-3 text-[13px] font-medium bg-[#ededed]/60 backdrop-blur-2xl rounded-[4px] hover:bg-[#e0e0e0]/70 transition-colors cursor-pointer"
        >
          Work<sup className="text-[10px] ml-0.5 opacity-50">1</sup>
        </button>
        <button
          onClick={() => navigate('/about')}
          className="py-1.5 px-3 text-[13px] font-medium bg-[#111] text-white rounded-[4px] cursor-default"
        >
          About<sup className="text-[10px] ml-0.5 opacity-50">2</sup>
        </button>
      </nav>

      {/* ── Logo ── */}
      <div className="fixed top-3 left-4 z-[100]">
        <span
          className="text-sm font-bold tracking-tight cursor-pointer hover:opacity-60 transition-opacity"
          onClick={() => navigate('/')}
        >
          LJW
        </span>
      </div>

      {/* ── Hero Section ── */}
      <section className="w-full pt-32 md:pt-44 pb-20 md:pb-32 px-6 md:px-16 lg:px-24">
        <div className="max-w-[1200px] mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="text-[11px] uppercase tracking-[0.2em] text-[#111]/40 font-medium mb-6"
          >
            About
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-[32px] md:text-[48px] lg:text-[56px] font-bold tracking-[-0.03em] leading-[1.1] max-w-[800px]"
          >
            이재웅
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="text-[15px] md:text-[17px] text-[#111]/50 font-normal leading-[1.7] mt-5 max-w-[600px]"
          >
            제품과 경험을 디자인합니다. 의도에서 시작하여 디테일로 완성하는 과정을 추구합니다.
          </motion.p>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="max-w-[1200px] mx-auto px-6 md:px-16 lg:px-24">
        <div className="h-px bg-[#111]/[0.08]" />
      </div>

      {/* ── Philosophy Chapters ── */}
      <section className="w-full py-20 md:py-32 px-6 md:px-16 lg:px-24">
        <div className="max-w-[1200px] mx-auto space-y-24 md:space-y-36">
          {chapters.map((ch, i) => (
            <motion.div
              key={ch.title}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={fadeUp}
              className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-8 md:gap-16"
            >
              {/* Left column */}
              <div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#111]/30 font-bold mb-4 block">
                  {String(i + 1).padStart(2, '0')} — {ch.title}
                </span>
                <p className="text-[14px] md:text-[15px] text-[#111]/75 leading-[1.85] font-normal">
                  {ch.left}
                </p>
              </div>
              {/* Right column */}
              <div className="md:pt-8">
                <p className="text-[14px] md:text-[15px] text-[#111]/55 leading-[1.85] font-normal">
                  {ch.right}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="max-w-[1200px] mx-auto px-6 md:px-16 lg:px-24">
        <div className="h-px bg-[#111]/[0.08]" />
      </div>

      {/* ── Experience & Skills ── */}
      <section className="w-full py-20 md:py-28 px-6 md:px-16 lg:px-24">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-16">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            custom={0}
          >
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-[#111]/30 font-bold mb-6">
              Experience
            </h2>
            <div className="space-y-4">
              {[
                { role: 'Product Designer', place: 'Personal Projects', period: '2023 — Present' },
                { role: 'Industrial Design', place: 'University Studies', period: '2020 — Present' },
              ].map((exp, i) => (
                <div key={i} className="flex justify-between items-baseline border-b border-[#111]/[0.06] pb-3">
                  <div>
                    <p className="text-[14px] font-medium tracking-tight">{exp.role}</p>
                    <p className="text-[12px] text-[#111]/40 mt-0.5">{exp.place}</p>
                  </div>
                  <span className="text-[11px] text-[#111]/30 font-mono">{exp.period}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            custom={1}
          >
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-[#111]/30 font-bold mb-6">
              Skills
            </h2>
            <div className="flex flex-wrap gap-2">
              {[
                'Product Design', 'Industrial Design', 'Visual Identity',
                'UI/UX', '3D Modeling', 'Prototyping',
                'Rhino', 'KeyShot', 'Figma', 'Photoshop',
              ].map((skill) => (
                <span
                  key={skill}
                  className="text-[12px] text-[#111]/60 border border-[#111]/[0.1] rounded-full px-3 py-1.5 font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="max-w-[1200px] mx-auto px-6 md:px-16 lg:px-24">
        <div className="h-px bg-[#111]/[0.08]" />
      </div>

      {/* ── Contact & Socials ── */}
      <section className="w-full py-20 md:py-28 px-6 md:px-16 lg:px-24">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-16">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            custom={0}
          >
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-[#111]/30 font-bold mb-6">
              Contact
            </h2>
            <div className="space-y-4">
              <a
                href="mailto:ljwoong1104@gmail.com"
                className="block text-[14px] font-medium tracking-tight hover:opacity-50 transition-opacity"
              >
                ljwoong1104@gmail.com
              </a>
              <a
                href="tel:010-2380-9280"
                className="block text-[14px] font-medium tracking-tight hover:opacity-50 transition-opacity"
              >
                010-2380-9280
              </a>
            </div>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            custom={1}
          >
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-[#111]/30 font-bold mb-6">
              Social
            </h2>
            <div className="space-y-3">
              {[
                { label: 'Instagram', url: 'https://instagram.com/now_y_es', handle: '@now_y_es' },
              ].map((social) => (
                <a
                  key={social.label}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-baseline gap-3 text-[14px] font-medium tracking-tight hover:opacity-50 transition-opacity group"
                >
                  <span className="text-[10px] uppercase tracking-[0.15em] text-[#111]/30 font-bold w-[80px]">
                    {social.label}
                  </span>
                  <span>{social.handle}</span>
                </a>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="w-full py-8 px-6 md:px-16 lg:px-24 border-t border-[#111]/[0.06]">
        <div className="max-w-[1200px] mx-auto flex justify-between items-center">
          <span className="text-[11px] text-[#111]/25 font-medium">
            © {new Date().getFullYear()} Lee Jaewoong
          </span>
          <span
            className="text-[11px] text-[#111]/25 font-medium cursor-pointer hover:text-[#111]/50 transition-colors"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            Back to top ↑
          </span>
        </div>
      </footer>
    </div>
  );
}
