import { useState } from 'react';
import { BsStars } from "react-icons/bs";
import { FaYoutube, FaFilter, FaPalette, FaVideo, FaLink } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { IoPaw } from "react-icons/io5";
import { worksData, IconType } from '../../../data/portfolio/works';

function Works() {
  const [filter, setFilter] = useState<'all' | 'illustration' | 'video' | 'other'>('all');

  const renderIcon = (iconType: IconType) => {
    switch (iconType) {
      case "x":
        return <FaXTwitter size={40} aria-hidden="true" />;
      case "youtube":
        return <FaYoutube size={40} aria-hidden="true" />;
      case "link":
      default:
        return <FaLink size={40} aria-hidden="true" />;
    }
  };

  const filteredWorks = worksData.filter(work => {
    if (filter === 'all') return true;
    return work.type === filter;
  });

  return (
    <div className="works">
      <title>Kiri487 | Works</title>
      <meta name="description" content="Browse Kiri's gallery of illustrations, videos, and other creative works." />

      <h2 className="title"><BsStars />Gallery</h2>

      <div className="filter-container">
        <button
          className={`filter-button ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
          aria-label="Show all works"
          aria-pressed={filter === 'all'}
        >
          <FaFilter aria-hidden="true"/> All
        </button>
        <button
          className={`filter-button ${filter === 'illustration' ? 'active' : ''}`}
          onClick={() => setFilter('illustration')}
          aria-label="Filter by illustrations"
          aria-pressed={filter === 'illustration'}
        >
          <FaPalette aria-hidden="true"/> Illustrations
        </button>
        <button
          className={`filter-button ${filter === 'video' ? 'active' : ''}`}
          onClick={() => setFilter('video')}
          aria-label="Filter by videos"
          aria-pressed={filter === 'video'}
        >
          <FaVideo aria-hidden="true"/> Videos
        </button>
        <button
          className={`filter-button ${filter === 'other' ? 'active' : ''}`}
          onClick={() => setFilter('other')}
          aria-label="Filter by other works"
          aria-pressed={filter === 'other'}
        >
          <IoPaw aria-hidden="true"/> Other
        </button>
      </div>

      <div className="masonry-container">
        {filteredWorks.map((work) => (
          <a
            key={work.thumbnail}
            href={work.url}
            target="_blank"
            rel="noopener noreferrer"
            className="gallery-item"
            aria-label={`View ${work.title}`}
          >
            <div className="gallery-img-wrapper">
              <img src={work.thumbnail} alt={work.title} loading="lazy" decoding="async" />
              <div className="gallery-overlay">
                <div className="overlay-icon">
                  {renderIcon(work.icon)}
                </div>
                <p className="overlay-title">{work.title}</p>
                <p className="overlay-date">{work.date}</p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default Works;
