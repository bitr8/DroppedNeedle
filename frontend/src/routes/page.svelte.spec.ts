import { beforeEach, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const h = vi.hoisted(() => ({
	isAdmin: false,
	dashboardView: vi.fn(),
	userHomeView: vi.fn()
}));

vi.mock('$lib/stores/authStore.svelte', () => ({
	authStore: {
		get isAdmin() {
			return h.isAdmin;
		}
	}
}));

vi.mock('$lib/components/dashboard/Dashboard.svelte', () => {
	const Component = function () {
		h.dashboardView();
	};
	Component.prototype = {};
	return { default: Component };
});

vi.mock('$lib/components/home/UserHome.svelte', () => {
	const Component = function () {
		h.userHomeView();
	};
	Component.prototype = {};
	return { default: Component };
});

import Page from './+page.svelte';

beforeEach(() => {
	vi.clearAllMocks();
	h.isAdmin = false;
});

it('renders the admin Dashboard for admin users', async () => {
	h.isAdmin = true;
	render(Page);

	expect(h.dashboardView).toHaveBeenCalled();
	expect(h.userHomeView).not.toHaveBeenCalled();
});

it('renders UserHome for non-admin users', async () => {
	h.isAdmin = false;
	render(Page);

	expect(h.userHomeView).toHaveBeenCalled();
	expect(h.dashboardView).not.toHaveBeenCalled();
});
