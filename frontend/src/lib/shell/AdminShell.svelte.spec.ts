import { page } from '@vitest/browser/context';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';

const { routeState, integrationState } = vi.hoisted(() => ({
	routeState: { pathname: '/' },
	integrationState: {
		download_client: false,
		library: true,
		jellyfin: false,
		navidrome: false,
		plex: false,
		youtube: false,
		youtube_api: false,
		localfiles: false,
		loaded: true
	}
}));

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({
	resolve: vi.fn((route: string) => route),
	resolveRoute: vi.fn((route: string) => route)
}));
vi.mock('$app/state', () => ({
	page: {
		get url() {
			return new URL(routeState.pathname, 'http://localhost');
		}
	}
}));
vi.mock('$lib/stores/player.svelte', () => ({
	playerStore: {
		isPlayerVisible: false
	}
}));
vi.mock('$lib/stores/integration', () => ({
	integrationStore: {
		subscribe: vi.fn((cb: (v: unknown) => void) => {
			cb(integrationState);
			return () => {};
		})
	}
}));
vi.mock('$lib/stores/syncStatus.svelte', () => ({
	syncStatus: { isActive: false }
}));
vi.mock('$lib/utils/logout', () => ({ logout: vi.fn() }));

function emptyComponent() {
	const Comp = function () {};
	Comp.prototype = {};
	return { default: Comp };
}
vi.mock('$lib/components/activity/ActivityBell.svelte', () => emptyComponent());
vi.mock('$lib/components/ConcertsNavBadge.svelte', () => emptyComponent());
vi.mock('$lib/components/DegradedBanner.svelte', () => emptyComponent());
vi.mock('$lib/components/DownloadsNavBadge.svelte', () => emptyComponent());
vi.mock('$lib/components/Footer.svelte', () => emptyComponent());
vi.mock('$lib/components/NewReleasesNavBadge.svelte', () => emptyComponent());
vi.mock('$lib/components/PendingApprovalNavBadge.svelte', () => emptyComponent());
vi.mock('$lib/components/SearchSuggestions.svelte', () => emptyComponent());
vi.mock('$lib/components/ServiceHealthIndicator.svelte', () => emptyComponent());
vi.mock('$lib/components/SidebarServices.svelte', () => emptyComponent());
vi.mock('$lib/components/VersionOverlays.svelte', () => emptyComponent());

import AdminShell from './AdminShell.svelte';
import { authStore } from '$lib/stores/authStore.svelte';

const childrenSnippet = createRawSnippet(() => ({
	render: () => '<div data-testid="page-content">Page</div>'
}));

function renderShell() {
	return render(AdminShell, {
		props: { children: childrenSnippet } as Record<string, unknown>
	} as Parameters<typeof render<typeof AdminShell>>[1]);
}

describe('AdminShell', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		routeState.pathname = '/';
		Object.assign(integrationState, {
			download_client: false,
			library: true,
			jellyfin: false,
			navidrome: false,
			plex: false,
			youtube: false,
			youtube_api: false,
			localfiles: false,
			loaded: true
		});
		authStore.clear();
	});

	it('renders the sidebar destinations', async () => {
		renderShell();
		for (const label of ['Home', 'Discover', 'Library', 'Downloads', 'Following', 'Playlists']) {
			await expect.element(page.getByRole('link', { name: label }).first()).toBeInTheDocument();
		}
	});

	it('groups Library Management and Approvals under an Admin section', async () => {
		renderShell();
		await expect.element(page.getByText('Admin', { exact: true })).toBeInTheDocument();

		const management = page.getByRole('link', { name: 'Library Management' });
		await expect.element(management).toBeInTheDocument();
		expect(management.element().getAttribute('href')).toBe('/library/management');

		const approvals = page.getByRole('link', { name: 'Approvals' });
		await expect.element(approvals).toBeInTheDocument();
		expect(approvals.element().getAttribute('href')).toBe('/requests?tab=approvals');
	});

	it('exposes a Settings link labelled for assistive tech', async () => {
		renderShell();
		const settings = page.getByRole('link', { name: 'Settings' }).first();
		await expect.element(settings).toBeInTheDocument();
		expect(settings.element().getAttribute('aria-label')).toBe('Settings');
	});

	it('exposes a Log out button', async () => {
		renderShell();
		await expect.element(page.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
	});

	it('opens the search dialog from the Search button', async () => {
		renderShell();
		const dialog = document.getElementById('search_modal') as HTMLDialogElement | null;
		expect(dialog).not.toBeNull();
		expect(dialog!.open).toBe(false);

		await page.getByRole('button', { name: 'Search' }).first().click();

		expect(dialog!.open).toBe(true);
	});

	it('marks the active sidebar route with aria-current="page"', async () => {
		routeState.pathname = '/following';
		renderShell();
		await expect
			.element(page.getByRole('link', { name: 'Following' }).first())
			.toHaveAttribute('aria-current', 'page');
		await expect
			.element(page.getByRole('link', { name: 'Home' }).first())
			.not.toHaveAttribute('aria-current');
	});

	it('does not mark Library active while viewing Library Management', async () => {
		routeState.pathname = '/library/management';
		renderShell();
		await expect
			.element(page.getByRole('link', { name: 'Library Management' }))
			.toHaveAttribute('aria-current', 'page');
		await expect
			.element(page.getByRole('link', { name: 'Library' }).first())
			.not.toHaveAttribute('aria-current');
	});
});
