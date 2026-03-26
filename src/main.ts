import { Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, TaskSyncSettings, TaskSyncSettingTab } from './settings';
import { parseTaskLine, shouldExclude } from './task-parser';
import { createPool, initTable, syncTasks, testConnection, Pool } from './db';
import type { Task } from './types';

export default class TaskSyncPlugin extends Plugin {
	settings: TaskSyncSettings;
	pool: Pool | null = null;
	private syncing = false;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new TaskSyncSettingTab(this.app, this));

		this.addRibbonIcon('refresh-cw', 'Sync tasks to MySQL', () => {
			this.runSync();
		});

		this.addCommand({
			id: 'sync-now',
			name: 'Sync tasks to MySQL now',
			callback: () => {
				this.runSync();
			},
		});

		try {
			await this.connectDb();
		} catch (err) {
			new Notice(`Task Sync: failed to connect to database — ${(err as Error).message}`);
		}

		this.scheduleSyncInterval();

		try {
			await this.runSync();
		} catch (err) {
			new Notice(`Task Sync: initial sync failed — ${(err as Error).message}`);
		}
	}

	async onunload() {
		if (this.pool) {
			this.pool.end();
		}
	}

	async connectDb() {
		if (this.pool) {
			await this.pool.end();
			this.pool = null;
		}
		const pool = createPool(this.settings);
		try {
			await initTable(pool);
		} catch (err) {
			await pool.end();
			throw err;
		}
		this.pool = pool;
	}

	async runSync() {
		if (this.syncing) return;

		if (!this.pool) {
			new Notice('Task Sync: database not connected');
			return;
		}

		this.syncing = true;
		try {
			if (!(await testConnection(this.pool))) {
				await this.connectDb();
			}

			const files = this.app.vault.getMarkdownFiles();
			const excludeList = this.settings.excludeFolders
				.split(',')
				.map((s) => s.trim())
				.filter((s): s is string => s.length > 0);

			const tasks: Task[] = [];
			for (const file of files) {
				if (shouldExclude(file.path, excludeList)) continue;
				const content = await this.app.vault.cachedRead(file);
				const lines = content.split('\n');
				for (const [i, line] of lines.entries()) {
					const task = parseTaskLine(line, file.path, i + 1, this.settings.dataviewFormat);
					if (task && !task.isDone) {
						tasks.push(task);
					}
				}
			}

			const result = await syncTasks(this.pool, tasks);
			new Notice(`Task Sync: synced ${result.inserted} tasks`);
		} catch (err) {
			new Notice(`Task Sync: sync failed — ${(err as Error).message}`);
		} finally {
			this.syncing = false;
		}
	}

	private scheduleSyncInterval() {
		const ms = this.settings.syncIntervalMinutes * 60 * 1000;
		this.registerInterval(window.setInterval(() => this.runSync(), ms));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<TaskSyncSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
