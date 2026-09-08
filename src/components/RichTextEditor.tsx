'use client';

import { useMemo, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { MediaPicker } from './MediaPicker';

export default function RichTextEditor({ value, onChange, label }: {
	value: string;
	onChange: (html: string) => void;
	label: string;
}) {
	const editor = useRef<ReactQuill>(null);
	const imagePicker = useRef<HTMLDivElement>(null);
	const cursor = useRef(0);
	const modules = useMemo(() => ({
		toolbar: {
			container: [
				[{ header: [1, 2, 3, 4, 5, 6, false] }],
				['bold', 'italic', 'underline', 'strike'],
				[{ align: [] }],
				[{ script: 'sub' }, { script: 'super' }],
				[{ color: [] }, { background: [] }],
				['blockquote', 'code-block'],
				[{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
				['image', 'link', 'clean'],
			],
			handlers: { image: () => imagePicker.current?.querySelector('button')?.click() },
		},
	}), []);

	return <div className='rich-text-field' role='group' aria-label={`${label} rich text editor`}>
		<ReactQuill
			ref={editor}
			theme='snow'
			value={value}
			modules={modules}
			onChange={(html, _delta, source) => { if (source === 'user') onChange(html); }}
			onChangeSelection={(range) => { if (range) cursor.current = range.index; }}
		/>
		<div ref={imagePicker} className='rich-text-image-action'><MediaPicker label='Insert image from library' onSelect={(urls) => {
			const quill = editor.current?.getEditor();
			if (!quill) return;
			const index = Math.min(cursor.current, Math.max(0, quill.getLength() - 1));
			quill.insertEmbed(index, 'image', urls[0], 'user');
			quill.setSelection(index + 1, 0, 'silent');
		}} /></div>
	</div>;
}
