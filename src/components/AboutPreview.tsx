'use client';

/* eslint-disable @next/next/no-img-element -- Preview the CMS image URL without rewriting it. */
import dynamic from 'next/dynamic';
import type { EditorRecord } from '@/lib/resources';

const RichText = dynamic(() => import('./RichTextPreview'), { ssr: false });

// Mirrors the frontend AboutSection: the first HTML list becomes checkmarked
// benefits, while the remaining HTML retains its original paragraph formatting.
export function AboutPreview({ record }: { record: EditorRecord }) {
	const html = String(record.description || '');
	const listHtml = html.match(/<(ol|ul)[^>]*>[\s\S]*?<\/\1>/)?.[0] || '';
	const paragraphs = listHtml ? html.replace(listHtml, '') : html;
	const items = listHtml ? Array.from(listHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g), (match) => match[1]) : [];
	const cards = Array.isArray(record.card) ? record.card as Array<Record<string, unknown>> : [];
	return <section className='frontend-about'>
		<div className='frontend-about-container'><div className='frontend-about-grid'>
			<div className='frontend-about-copy'>
				<p className='frontend-about-eyebrow'>{String(record.section || '')}</p>
				<h2>{String(record.content || '').split('\n').map((line, index, lines) => <span key={index}>{line}{index < lines.length - 1 ? <br /> : null}</span>)}</h2>
				<RichText html={paragraphs} className='frontend-about-description' />
				{items.length ? <ul className='frontend-about-benefits'>{items.map((item, index) => <li key={index}>
					<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'><circle cx='12' cy='12' r='10' /><path d='m9 12 2 2 4-4' /></svg>
					<RichText html={item} inline className='frontend-about-benefit-text' />
				</li>)}</ul> : null}
				<button type='button' className='frontend-about-link'>{String(record.btnText || '')}<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'><path d='M5 12h14m-6-6 6 6-6 6' /></svg></button>
			</div>
			<div className='frontend-about-visual'>
				<div className='frontend-about-image'><img src={String(record.image || '')} alt={String(record.content || '')} /><div /></div>
				<div className='frontend-about-stats'>{cards.map((card, index) => <div className='frontend-about-stat' key={String(card._id || index)}>{index > 0 ? <i /> : null}<div><p>{String(card.title || '')}</p><small>{String(card.description || '')}</small></div></div>)}</div>
				<div className='frontend-about-year'>{String(record.subContent || '')}</div>
			</div>
		</div></div>
	</section>;
}
