import mysql from 'mysql2/promise';
import type { Task } from './types';
import type { TaskSyncSettings } from './settings';

export type Pool = mysql.Pool;

export function createPool(settings: TaskSyncSettings): Pool {
	return mysql.createPool({
		host: settings.mysqlHost,
		port: settings.mysqlPort,
		user: settings.mysqlUser,
		password: settings.mysqlPassword,
		database: settings.mysqlDatabase,
		waitForConnections: true,
		connectionLimit: 3,
		queueLimit: 0,
	});
}

export async function initTable(pool: Pool): Promise<void> {
	await pool.execute(`
		CREATE TABLE IF NOT EXISTS vault_tasks (
			id INT AUTO_INCREMENT PRIMARY KEY,
			file_path VARCHAR(1024) NOT NULL,
			line_number INT NOT NULL,
			raw_line TEXT NOT NULL,
			description TEXT NOT NULL,
			is_done TINYINT(1) NOT NULL DEFAULT 0,
			due_date DATE NULL,
			scheduled_date DATE NULL,
			start_date DATE NULL,
			created_date DATE NULL,
			end_time VARCHAR(5) NULL,
			priority ENUM('high','medium','low','none') NOT NULL DEFAULT 'none',
			recurrence VARCHAR(255) NULL,
			synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			UNIQUE KEY uq_file_line (file_path(500), line_number),
			INDEX idx_due_date (due_date),
			INDEX idx_scheduled_date (scheduled_date)
		)
	`);
}

export async function syncTasks(pool: Pool, tasks: Task[]): Promise<{ inserted: number }> {
	const conn = await pool.getConnection();
	try {
		// TRUNCATE resets AUTO_INCREMENT and cannot be rolled back (implicit commit),
		// so it runs outside the transaction before INSERT begins.
		await conn.execute('TRUNCATE TABLE vault_tasks');
		if (tasks.length > 0) {
			await conn.beginTransaction();
			try {
				const rows = tasks.map((t) => [
					t.filePath,
					t.lineNumber,
					t.rawLine,
					t.description,
					t.isDone ? 1 : 0,
					t.dueDate ?? null,
					t.scheduledDate ?? null,
					t.startDate ?? null,
					t.createdDate ?? null,
					t.endTime ?? null,
					t.priority,
					t.recurrence ?? null,
				]);
				await conn.query(
					`INSERT INTO vault_tasks
						(file_path, line_number, raw_line, description, is_done,
						due_date, scheduled_date, start_date, created_date, end_time,
						priority, recurrence)
					VALUES ?`,
					[rows]
				);
				await conn.commit();
			} catch (err) {
				await conn.rollback();
				throw err;
			}
		}
		return { inserted: tasks.length };
	} finally {
		conn.release();
	}
}

export async function testConnection(pool: Pool): Promise<boolean> {
	try {
		await pool.execute('SELECT 1');
		return true;
	} catch {
		return false;
	}
}
