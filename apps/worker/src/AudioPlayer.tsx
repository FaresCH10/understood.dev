import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Language } from '@understood/shared';
import { Icon } from './icons';
import { t } from './i18n';

const BARS = [8, 15, 22, 12, 18, 27, 16, 23, 11, 20, 29, 14, 24, 17, 10, 21, 26, 13, 19, 11, 23, 16, 28, 12, 20, 15, 25, 10];

function clock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

export function AudioPlayer({ src, lang, playSignal }: { src: string; lang: Language; playSignal?: number }) {
  const strings = t(lang);
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setTime(0);
    setDuration(0);
  }, [src]);

  useEffect(() => {
    if (!playSignal) return;
    const audio = ref.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }, [playSignal]);

  function toggle() {
    const audio = ref.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      if (audio.ended) audio.currentTime = 0;
      void audio.play().catch(() => setPlaying(false));
    }
  }

  const shownDuration = duration || 0;
  const pct = shownDuration > 0 ? Math.min(100, Math.round((time / shownDuration) * 100)) : 0;

  return (
    <div className="w-audio">
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setTime(0);
        }}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
      />
      <button className={`w-play${playing ? ' is-playing' : ''}`} type="button" onClick={toggle} aria-label={playing ? strings.pause : strings.listen}>
        <Icon name={playing ? 'pause' : 'play'} />
      </button>
      <span className="a-label">{strings.listen}</span>
      <button type="button" className={`w-wave${playing ? ' is-live' : ''}`} onClick={toggle} aria-label={playing ? strings.pause : strings.listen}>
        {BARS.map((height, index) => (
          <i key={index} style={{ '--h': `${height}px`, '--i': index % 9 } as CSSProperties} />
        ))}
      </button>
      <div className="a-progress">
        <div className="a-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="a-time">
        {clock(time)} / {clock(shownDuration)}
      </div>
      <div className="a-note">{strings.tapPlay}</div>
    </div>
  );
}
