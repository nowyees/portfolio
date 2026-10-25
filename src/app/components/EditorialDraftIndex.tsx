import { Link } from 'react-router';
import SiteShell from './SiteShell';
import { editorialDrafts } from '../../lib/projectStoryDrafts';
import { editorialDraftCatalog } from '../../lib/editorialDraftCatalog';

export default function EditorialDraftIndex() {
  return <SiteShell active="projects">
    <main className="editorial-draft-index" id="main-content">
      <header>
        <p className="draft-eyebrow">Local studies · Not published</p>
        <h1>Detail studies<span>12</span></h1>
        <p>나머지 9개를 포함한 전체 상세페이지 초안. 배포 중인 Lunaris는 그대로 유지했습니다.</p>
      </header>
      <div className="draft-index-grid">
        {editorialDraftCatalog.map((entry, i) => {
          const story = editorialDrafts[entry.key];
          return <Link className="draft-index-card" key={entry.id} to={`/project/portfolio/${entry.id}?draft=editorial`}>
            <div className="draft-index-meta"><span>{String(i + 1).padStart(2, '0')}</span><span>{entry.year}</span></div>
            <div className="draft-index-image"><img src={story.hero.src} alt={`${entry.title} preview`}
              width={story.hero.w} height={story.hero.h} loading={i < 4 ? 'eager' : 'lazy'} /></div>
            <h2>{entry.title}<span aria-hidden="true">↗</span></h2>
            <p>{story.discipline}</p>
          </Link>;
        })}
      </div>
      <footer><Link to="/project/portfolio/4">Lunaris — existing page ↗</Link></footer>
    </main>
  </SiteShell>;
}
