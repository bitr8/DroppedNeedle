import type { ComponentType } from 'svelte';
import { Music, HardDriveDownload, Waypoints, Users, Settings, Info } from 'lucide-svelte';

export interface SettingsSection {
	id: string;
	label: string;
}

export interface SettingsPageDef {
	id: string;
	label: string;
	icon: ComponentType;
	description: string;
	sections: SettingsSection[];
}

export const settingsPages: SettingsPageDef[] = [
	{
		id: 'library',
		label: 'Library',
		icon: Music,
		description: 'Roots, scanning schedule, management automation, MusicBrainz.',
		sections: [
			{ id: 'library', label: 'Library' },
			{ id: 'library-management', label: 'Management automation' },
			{ id: 'musicbrainz', label: 'MusicBrainz' }
		]
	},
	{
		id: 'downloads',
		label: 'Downloads',
		icon: HardDriveDownload,
		description: 'Download clients, indexers, free music, Lidarr import.',
		sections: [
			{ id: 'download-client', label: 'Download client' },
			{ id: 'indexers', label: 'Indexers' },
			{ id: 'free-music', label: 'Free music' },
			{ id: 'lidarr-import', label: 'Lidarr import' },
			{ id: 'get-it', label: 'Get it' }
		]
	},
	{
		id: 'integrations',
		label: 'Integrations',
		icon: Waypoints,
		description: 'Connected sources — status, account linking, service config.',
		sections: [
			{ id: 'jellyfin', label: 'Jellyfin' },
			{ id: 'navidrome', label: 'Navidrome' },
			{ id: 'plex', label: 'Plex' },
			{ id: 'youtube', label: 'YouTube' },
			{ id: 'lastfm', label: 'Last.fm' },
			{ id: 'spotify', label: 'Spotify' },
			{ id: 'music-assistant', label: 'Music Assistant' },
			{ id: 'connect-apps', label: 'Connect apps' },
			{ id: 'events', label: 'Live events' }
		]
	},
	{
		id: 'users-security',
		label: 'Users & Security',
		icon: Users,
		description: 'Accounts, roles, sessions, hardening.',
		sections: [
			{ id: 'users', label: 'Users' },
			{ id: 'security', label: 'Security' },
			{ id: 'wrapped', label: 'Wrapped API' }
		]
	},
	{
		id: 'system',
		label: 'System',
		icon: Settings,
		description: 'Cache, advanced internals, plugins.',
		sections: [
			{ id: 'cache', label: 'Cache' },
			{ id: 'advanced', label: 'Advanced' },
			{ id: 'plugins', label: 'Plugins' }
		]
	},
	{
		id: 'about',
		label: 'About',
		icon: Info,
		description: 'Version and release notes.',
		sections: [{ id: 'about', label: 'About' }]
	}
];

export const DEFAULT_SETTINGS_PAGE = 'library';

/**
 * Old `?tab=` ids -> where that content lives now. `'profile'` covers the UC-809
 * per-user page-preference cluster (home/discover/sidebar/settings/music-source),
 * which moved out of admin-gated Settings entirely.
 */
export const legacyTabMap: Record<string, { page: string; anchor: string } | 'profile'> = {
	library: { page: 'library', anchor: 'library' },
	musicbrainz: { page: 'library', anchor: 'musicbrainz' },
	'download-client': { page: 'downloads', anchor: 'download-client' },
	indexers: { page: 'downloads', anchor: 'indexers' },
	'free-music': { page: 'downloads', anchor: 'free-music' },
	'lidarr-import': { page: 'downloads', anchor: 'lidarr-import' },
	'get-it': { page: 'downloads', anchor: 'get-it' },
	jellyfin: { page: 'integrations', anchor: 'jellyfin' },
	navidrome: { page: 'integrations', anchor: 'navidrome' },
	plex: { page: 'integrations', anchor: 'plex' },
	youtube: { page: 'integrations', anchor: 'youtube' },
	lastfm: { page: 'integrations', anchor: 'lastfm' },
	spotify: { page: 'integrations', anchor: 'spotify' },
	'connect-apps': { page: 'integrations', anchor: 'connect-apps' },
	events: { page: 'integrations', anchor: 'events' },
	users: { page: 'users-security', anchor: 'users' },
	security: { page: 'users-security', anchor: 'security' },
	wrapped: { page: 'users-security', anchor: 'wrapped' },
	cache: { page: 'system', anchor: 'cache' },
	advanced: { page: 'system', anchor: 'advanced' },
	plugins: { page: 'system', anchor: 'plugins' },
	about: { page: 'about', anchor: 'about' },
	settings: 'profile',
	home: 'profile',
	discover: 'profile',
	sidebar: 'profile',
	'music-source': 'profile'
};

export function resolvePage(id: string | null): SettingsPageDef {
	return settingsPages.find((p) => p.id === id) ?? settingsPages[0];
}
