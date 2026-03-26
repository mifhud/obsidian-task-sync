export type Priority = 'high' | 'medium' | 'low' | 'none';

export interface Task {
	description: string;
	dueDate: string | null;
	scheduledDate: string | null;
	startDate: string | null;
	createdDate: string | null;
	endTime: string | null;
	isDone: boolean;
	priority: Priority;
	filePath: string;
	lineNumber: number;
	rawLine: string;
	recurrence: string | null;
}
