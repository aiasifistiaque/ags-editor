'use client';

import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import 'react-quill-new/dist/quill.core.css';

// Loaded client-side by SitePreview, so DOMPurify always has a browser document.
export default function RichTextPreview({ html, className = 'cms-rich-text ql-editor', inline = false }: { html: string; className?: string; inline?: boolean }) {
	const safeHtml = useMemo(() => DOMPurify.sanitize(html, {
		ALLOWED_TAGS: ['p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'sub', 'sup', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'img', 'a'],
		ALLOWED_ATTR: ['class', 'style', 'src', 'alt', 'width', 'height', 'data-list', 'data-language', 'dir'],
		ALLOW_DATA_ATTR: false,
	}), [html]);
	return inline ? <span className={className} dangerouslySetInnerHTML={{ __html: safeHtml }} /> : <div className={className} dangerouslySetInnerHTML={{ __html: safeHtml }} />;
}
