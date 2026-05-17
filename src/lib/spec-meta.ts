import fs from 'node:fs/promises';
import path from 'node:path';

export const SPEC_MARKDOWN_FILE = 'authorization-spec.md';

export interface SpecMeta {
	title: string;
	titleLines: string[];
	subtitle: string;
	docMark: string;
	version: string;
	status: string;
	published: string;
	description: string;
}

export interface SpecDocument {
	meta: SpecMeta;
	body: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function parseFrontmatterBlock(yaml: string): Record<string, string> {
	const result: Record<string, string> = {};
	for (const line of yaml.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const colon = trimmed.indexOf(':');
		if (colon === -1) continue;
		const key = trimmed.slice(0, colon).trim();
		let value = trimmed.slice(colon + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		result[key] = value;
	}
	return result;
}

function parseTitleLines(raw: string | undefined, title: string): string[] {
	if (raw?.trim()) {
		return raw
			.split('|')
			.map((line) => line.trim())
			.filter(Boolean);
	}
	return [title];
}

function metaFromFrontmatter(fields: Record<string, string>): SpecMeta {
	const title = fields.title?.trim();
	if (!title) {
		throw new Error('Spec frontmatter must include "title".');
	}

	return {
		title,
		titleLines: parseTitleLines(fields.titleLines, title),
		subtitle: fields.subtitle?.trim() ?? '',
		docMark: fields.docMark?.trim() ?? 'Technical Specification',
		version: fields.version?.trim() ?? '',
		status: fields.status?.trim() ?? '',
		published: fields.published?.trim() ?? '',
		description: fields.description?.trim() ?? '',
	};
}

/** Parse legacy markdown header when no YAML frontmatter is present. */
function metaFromMarkdownHeader(body: string): { meta: SpecMeta; body: string } {
	const titleMatch = body.match(/^#\s+(.+?)\s*$/m);
	const subtitleMatch = body.match(/^\*([^*]+)\*\s*$/m);
	const versionMatch = body.match(/^\*\*Version\s+(.+?)\*\*\s*$/im);

	const title = titleMatch?.[1]?.trim() ?? 'Specification';
	let rest = body;

	if (titleMatch) {
		rest = rest.replace(/^#\s+.+?\s*$/m, '');
	}
	if (subtitleMatch) {
		rest = rest.replace(/^\*[^*]+\*\s*$/m, '');
	}
	if (versionMatch) {
		rest = rest.replace(/^\*\*Version\s+.+?\*\*\s*$/im, '');
	}
	rest = rest.replace(/^---\s*$/m, '').trimStart();

	const meta: SpecMeta = {
		title,
		titleLines: parseTitleLines(undefined, title),
		subtitle: subtitleMatch?.[1]?.trim() ?? '',
		docMark: 'Technical Specification',
		version: versionMatch?.[1]?.trim() ?? '',
		status: '',
		published: '',
		description: '',
	};

	return { meta, body: rest };
}

export function parseSpecDocument(content: string): SpecDocument {
	const match = content.match(FRONTMATTER_RE);
	if (!match) {
		const { meta, body } = metaFromMarkdownHeader(content);
		return { meta, body };
	}

	const fields = parseFrontmatterBlock(match[1]);
	const body = content.slice(match[0].length).trimStart();
	return {
		meta: metaFromFrontmatter(fields),
		body,
	};
}

export async function loadSpecDocument(
	cwd: string = process.cwd(),
	filename: string = SPEC_MARKDOWN_FILE,
): Promise<SpecDocument> {
	const markdownPath = path.resolve(cwd, filename);
	const content = await fs.readFile(markdownPath, 'utf8');
	return parseSpecDocument(content);
}
