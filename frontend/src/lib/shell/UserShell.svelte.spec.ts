import { page } from '@vitest/browser/context';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';

const { routeState } = vi.hoisted(() => ({
	routeState: { pathname: '/' }
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

import UserShell from './UserShell.svelte';
import { authStore, type AuthUser } from '$lib/stores/authStore.svelte';

const childrenSnippet = createRawSnippet(() => ({
	render: () => '<div data-testid="page-content">Page</div>'
}));

function renderShell() {
	return render(UserShell, {
		props: { children: childrenSnippet } as Record<string, unknown>
	} as Parameters<typeof render<typeof UserShell>>[1]);
}

// The header logo is also an <a href="/" aria-label="Home">, so an unscoped
// getByRole('link', { name: 'Home' }) can match the logo instead of the nav item.
const primaryNav = () => page.getByRole('navigation', { name: 'Primary navigation' }).first();

function testUser(role: AuthUser['role'] = 'trusted'): AuthUser {
	return {
		id: 'user-1',
		display_name: 'Test User',
		role,
		email: null,
		avatar_url: null,
		username: 'testuser',
		username_display: 'testuser',
		providers: ['local']
	};
}

const DESTINATIONS: Array<[string, string]> = [
	['Home', '/'],
	['Search', '/search'],
	['Library', '/library'],
	['Playlists', '/playlists']
];

// Anything from AdminShell's chrome must never surface here — this shell is "never rendered", not hidden.
const FORBIDDEN_NAME =
	/settings|log out|discover|downloads|requests|approvals|library management|activity/i;

describe('UserShell', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		routeState.pathname = '/';
		authStore.clear();
	});

	it('renders exactly the four destinations as nav links, nothing else', async () => {
		renderShell();
		for (const [label] of DESTINATIONS) {
			await expect.element(page.getByRole('link', { name: label }).first()).toBeInTheDocument();
		}
		const navHrefs = new Set(
			Array.from(document.querySelectorAll('nav a')).map((a) => a.getAttribute('href'))
		);
		expect(navHrefs).toEqual(new Set(DESTINATIONS.map(([, href]) => href)));
	});

	it('marks Home aria-current="page" only at the exact root path', async () => {
		routeState.pathname = '/';
		renderShell();
		await expect
			.element(primaryNav().getByRole('link', { name: 'Home' }))
			.toHaveAttribute('aria-current', 'page');
		await expect
			.element(page.getByRole('link', { name: 'Library' }).first())
			.not.toHaveAttribute('aria-current');
	});

	it('marks Library aria-current="page" for a nested library route', async () => {
		routeState.pathname = '/library/foo';
		renderShell();
		await expect
			.element(page.getByRole('link', { name: 'Library' }).first())
			.toHaveAttribute('aria-current', 'page');
		await expect
			.element(primaryNav().getByRole('link', { name: 'Home' }))
			.not.toHaveAttribute('aria-current');
	});

	it('does not treat "/" as active once the route has moved on', async () => {
		routeState.pathname = '/search';
		renderShell();
		await expect
			.element(primaryNav().getByRole('link', { name: 'Home' }))
			.not.toHaveAttribute('aria-current');
		await expect
			.element(page.getByRole('link', { name: 'Search' }).first())
			.toHaveAttribute('aria-current', 'page');
	});

	it('renders a profile link', async () => {
		renderShell();
		await expect.element(page.getByRole('link', { name: 'Profile' })).toBeInTheDocument();
	});

	it('exposes no admin chrome and no drawer sidebar', async () => {
		authStore.setUser(testUser('trusted'));
		renderShell();
		await expect.element(page.getByRole('link', { name: FORBIDDEN_NAME })).not.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: FORBIDDEN_NAME }))
			.not.toBeInTheDocument();
		expect(document.querySelector('.drawer-side')).toBeNull();
	});
});
