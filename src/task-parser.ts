import type { Task, Priority } from './types';

const TASK_LINE_REGEX = /^(\s*[-*]|\d+\.)\s+\[([ xX/])\]\s+(.+)$/;

const DATE_PATTERNS = {
	due: /📅\s*(\d{4}-\d{2}-\d{2})/,
	scheduled: /⏳\s*(\d{4}-\d{2}-\d{2})/,
	start: /🛫\s*(\d{4}-\d{2}-\d{2})/,
	created: /➕\s*(\d{4}-\d{2}-\d{2})/,
	done: /✅\s*(\d{4}-\d{2}-\d{2})/,
};

const DATAVIEW_DATE_PATTERNS = {
	due: /\[due::\s*(\d{4}-\d{2}-\d{2})\]/,
	scheduled: /\[scheduled::\s*(\d{4}-\d{2}-\d{2})\]/,
	start: /\[start::\s*(\d{4}-\d{2}-\d{2})\]/,
	created: /\[created::\s*(\d{4}-\d{2}-\d{2})\]/,
	endTime: /\[endTime::\s*(\d{2}:\d{2})\]/,
};

const PRIORITY_PATTERNS: Record<string, Priority> = {
	'⏫': 'high',
	'🔼': 'medium',
	'🔽': 'low',
};

const RECURRENCE_REGEX = /🔁\s*([^\s📅⏳🛫➕✅⏫🔼🔽]+(?:\s+[^\s📅⏳🛫➕✅⏫🔼🔽]+)*)/;

function extractDate(line: string, pattern: RegExp): string | null {
	const match = line.match(pattern);
	return match ? (match[1] ?? null) : null;
}

function extractPriority(line: string): Priority {
	for (const [emoji, priority] of Object.entries(PRIORITY_PATTERNS)) {
		if (line.includes(emoji)) {
			return priority;
		}
	}
	return 'none';
}

function extractRecurrence(line: string): string | null {
	const match = line.match(RECURRENCE_REGEX);
	return match ? (match[1]?.trim() ?? null) : null;
}

function cleanDescription(description: string): string {
	return description
		.replace(/[📅⏳🛫➕✅]\s*\d{4}-\d{2}-\d{2}/g, '')
		.replace(/[⏫🔼🔽]/g, '')
		.replace(/🔁\s*[^\s📅⏳🛫➕✅⏫🔼🔽]+(?:\s+[^\s📅⏳🛫➕✅⏫🔼🔽]+)*/g, '')
		.replace(/\[\w+::\s*[^\]]+\]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

export function parseTaskLine(
	line: string,
	filePath: string,
	lineNumber: number,
	useDataview: boolean
): Task | null {
	const match = line.match(TASK_LINE_REGEX);
	if (!match) {
		return null;
	}

	const checkboxContent = match[2] ?? '';
	const restOfLine = match[3] ?? '';

	// [x] and [X] are done; [ ] and [/] are not done
	const isDone = checkboxContent === 'x' || checkboxContent === 'X';

	let dueDate = extractDate(restOfLine, DATE_PATTERNS.due);
	let scheduledDate = extractDate(restOfLine, DATE_PATTERNS.scheduled);
	let startDate = extractDate(restOfLine, DATE_PATTERNS.start);
	let createdDate = extractDate(restOfLine, DATE_PATTERNS.created);
	const endTime = extractDate(restOfLine, DATAVIEW_DATE_PATTERNS.endTime);

	if (useDataview) {
		if (!dueDate) dueDate = extractDate(restOfLine, DATAVIEW_DATE_PATTERNS.due);
		if (!scheduledDate) scheduledDate = extractDate(restOfLine, DATAVIEW_DATE_PATTERNS.scheduled);
		if (!startDate) startDate = extractDate(restOfLine, DATAVIEW_DATE_PATTERNS.start);
		if (!createdDate) createdDate = extractDate(restOfLine, DATAVIEW_DATE_PATTERNS.created);
	}

	const priority = extractPriority(restOfLine);
	const recurrence = extractRecurrence(restOfLine);
	const description = cleanDescription(restOfLine);

	return {
		description,
		dueDate,
		scheduledDate,
		startDate,
		createdDate,
		endTime,
		isDone,
		priority,
		filePath,
		lineNumber,
		rawLine: line,
		recurrence,
	};
}

export function shouldExclude(filePath: string, excludeFolders: string[]): boolean {
	const pathParts = filePath.split('/');
	return excludeFolders.some((folder) => pathParts.includes(folder));
}
