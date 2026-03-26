import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type TaskSyncPlugin from './main';

export interface TaskSyncSettings {
	mysqlHost: string;
	mysqlPort: number;
	mysqlUser: string;
	mysqlPassword: string;
	mysqlDatabase: string;
	syncIntervalMinutes: number;
	excludeFolders: string;
	dataviewFormat: boolean;
	includeScheduled: boolean;
}

export const DEFAULT_SETTINGS: TaskSyncSettings = {
	mysqlHost: 'localhost',
	mysqlPort: 3306,
	mysqlUser: '',
	mysqlPassword: '',
	mysqlDatabase: '',
	syncIntervalMinutes: 3,
	excludeFolders: '.obsidian, .trash, templates, archive, archives',
	dataviewFormat: true,
	includeScheduled: true,
};

export class TaskSyncSettingTab extends PluginSettingTab {
	plugin: TaskSyncPlugin;

	constructor(app: App, plugin: TaskSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'MySQL Connection' });

		new Setting(containerEl)
			.setName('Host')
			.setDesc('MySQL server hostname')
			.addText((text) =>
				text
					.setPlaceholder('localhost')
					.setValue(this.plugin.settings.mysqlHost)
					.onChange(async (value) => {
						this.plugin.settings.mysqlHost = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Port')
			.setDesc('MySQL server port')
			.addText((text) =>
				text
					.setPlaceholder('3306')
					.setValue(String(this.plugin.settings.mysqlPort))
					.onChange(async (value) => {
						const port = parseInt(value, 10);
						if (!isNaN(port)) {
							this.plugin.settings.mysqlPort = port;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName('User')
			.setDesc('MySQL username')
			.addText((text) =>
				text
					.setPlaceholder('username')
					.setValue(this.plugin.settings.mysqlUser)
					.onChange(async (value) => {
						this.plugin.settings.mysqlUser = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Password')
			.setDesc('MySQL password')
			.addText((text) => {
				text
					.setPlaceholder('password')
					.setValue(this.plugin.settings.mysqlPassword)
					.onChange(async (value) => {
						this.plugin.settings.mysqlPassword = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.type = 'password';
			});

		new Setting(containerEl)
			.setName('Database')
			.setDesc('MySQL database name')
			.addText((text) =>
				text
					.setPlaceholder('database')
					.setValue(this.plugin.settings.mysqlDatabase)
					.onChange(async (value) => {
						this.plugin.settings.mysqlDatabase = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Save & Connect')
			.setDesc('Apply current settings and connect to MySQL')
			.addButton((btn) =>
				btn.setButtonText('Save & Connect').onClick(async () => {
					try {
						await this.plugin.connectDb();
						new Notice('Connection successful! Database connected.');
					} catch (err) {
						new Notice(`Connection failed: ${(err as Error).message}`);
					}
				})
			);

		containerEl.createEl('h2', { text: 'Sync Settings' });

		new Setting(containerEl)
			.setName('Sync interval (minutes)')
			.setDesc('How often to sync tasks to MySQL')
			.addText((text) =>
				text
					.setPlaceholder('3')
					.setValue(String(this.plugin.settings.syncIntervalMinutes))
					.onChange(async (value) => {
						const minutes = parseInt(value, 10);
						if (!isNaN(minutes) && minutes > 0) {
							this.plugin.settings.syncIntervalMinutes = minutes;
							await this.plugin.saveSettings();
							this.plugin.scheduleSyncInterval();
						}
					})
			);

		new Setting(containerEl)
			.setName('Exclude folders')
			.setDesc('Comma-separated list of folder names to exclude from scanning')
			.addText((text) =>
				text
					.setPlaceholder('.obsidian, .trash, templates, archive')
					.setValue(this.plugin.settings.excludeFolders)
					.onChange(async (value) => {
						this.plugin.settings.excludeFolders = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Dataview format')
			.setDesc('Parse Dataview inline fields like [due:: 2024-01-01]')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.dataviewFormat).onChange(async (value) => {
					this.plugin.settings.dataviewFormat = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Include scheduled dates')
			.setDesc('Sync tasks with scheduled dates in addition to due dates')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.includeScheduled).onChange(async (value) => {
					this.plugin.settings.includeScheduled = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Sync now')
			.setDesc('Manually trigger a sync to MySQL')
			.addButton((btn) =>
				btn.setButtonText('Sync Now').onClick(() => {
					this.plugin.runSync();
				})
			);
	}
}
