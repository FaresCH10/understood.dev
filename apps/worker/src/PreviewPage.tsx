import { useEffect, useMemo, useState } from 'react';
import type { Language } from '@understood/shared';
import { ApiError, api } from './api';
import { AudioPlayer } from './AudioPlayer';
import { FONT_CLASS, LETTERS, metaOf, t } from './i18n';
import { Icon } from './icons';
import type { Content, MetaResponse } from './types';

interface PreviewResponse extends MetaResponse {
  language?: Language;
  content: Content;
}

export function PreviewPage({ token }: { token: string }) {
  const [data, setData] = useState<PreviewResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<PreviewResponse>(`/api/v1/w/preview/${encodeURIComponent(token)}`)
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiError || error instanceof Error) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const language = useMemo<Language>(() => {
    const candidate = data?.language ?? data?.availableLanguages[0] ?? 'en';
    return (data?.availableLanguages.includes(candidate) ? candidate : (data?.availableLanguages[0] ?? 'en')) as Language;
  }, [data]);
  const strings = t(language);
  const dir = metaOf(language).dir;

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
    document.title = data?.content.title ? `Preview — ${data.content.title}` : 'Preview — Understood';
  }, [language, dir, data]);

  if (failed) {
    return (
      <div className="w-app" dir="ltr">
        <div className="w-center">
          <span className="t-orb blue">
            <Icon name="eye" />
          </span>
          <h1 className="t-title">{strings.preview}</h1>
          <p className="t-sub">{strings.closedSub}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="w-app" dir="ltr">
        <div className="w-center">
          <span className="t-orb slate">
            <Icon name="refresh" />
          </span>
          <p className="t-sub">Loading…</p>
        </div>
      </div>
    );
  }

  const { content } = data;
  const title = content.title ?? data.instruction.title ?? '';

  return (
    <div className={`w-app ${FONT_CLASS[language]}`} dir={dir} lang={language}>
      <header className="w-head">
        <span className="w-org">{data.org.name}</span>
        <span className="w-lang-chip" aria-hidden="true">
          <Icon name="eye" />
          <bdi>{metaOf(language).nativeLabel}</bdi>
        </span>
      </header>
      <div className="w-banner blue">
        <Icon name="eye" />
        <span>{strings.preview}</span>
      </div>
      <div className="w-main w-instruction">
        <h1 className={`w-instr-title ${FONT_CLASS[language]}`} lang={language}>
          {title}
        </h1>
        {content.audioUrl ? <AudioPlayer src={content.audioUrl} lang={language} /> : null}
        {content.photoUrl ? (
          <figure className="w-photo-card">
            <img src={content.photoUrl} alt={title} />
          </figure>
        ) : null}
        {content.text ? (
          <div className="w-text-card">
            <p className={`w-instruction-text ${FONT_CLASS[language]}`} dir={dir} lang={language}>
              {content.text}
            </p>
            <div className="w-disclaimer">
              <Icon name="shield" />
              <span>{strings.disclaimer}</span>
            </div>
          </div>
        ) : null}
        {content.question ? (
          <section className="w-question" aria-labelledby="preview-q">
            <div className="q-head" id="preview-q">
              <Icon name="help" />
              {strings.quickCheck}
            </div>
            <p className={`q-text ${FONT_CLASS[language]}`} lang={language}>
              {content.question.text}
            </p>
            <p className="q-hint">{strings.questionHint}</p>
            <div className="q-options">
              {content.question.options.map((option, index) => (
                <button key={index} className="q-option" type="button" disabled>
                  <span className="letter" aria-hidden="true">
                    {(LETTERS[language] ?? LETTERS.en!)[index] ?? 'A'}
                  </span>
                  <span className={FONT_CLASS[language]} lang={language}>
                    {option}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

