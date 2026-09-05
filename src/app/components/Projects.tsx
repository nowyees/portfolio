import React from 'react';
import { Link } from 'react-router';
import { usePortfolio, imageUrl } from '../../lib/usePortfolio';
import SiteShell from './SiteShell';

export default function Projects() {
  const projects = usePortfolio();
  return (
    <SiteShell active="projects">
      <main className="projects-page">
        <h1 className="gallery-intro"><span>A Curated Selection of</span> <em>Objects and Visual Experiences</em></h1>
        <section className="project-grid" aria-label="Selected projects">
          {projects.map(project => (
            <article className="project-tile" key={project.category + '-' + project.id}>
              <Link className="project-tile-image" to={'/project/' + project.category + '/' + project.id} aria-label={'View ' + project.title}>
                <img src={imageUrl(project.image, 1000)} alt={project.title} loading="lazy" />
                <span className="project-view">View ↗</span>
              </Link>
              <h2><Link to={'/project/' + project.category + '/' + project.id}>{project.title}</Link></h2>
              <p>{project.hashtags?.join(', ') || project.year}</p>
            </article>
          ))}
        </section>
        <footer className="gallery-footer"><Link to="/about">Lee Jae Woong</Link><Link to="/about#contact">Contact ↗</Link></footer>
      </main>
    </SiteShell>
  );
}
