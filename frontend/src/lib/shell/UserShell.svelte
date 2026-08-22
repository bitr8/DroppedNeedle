<script lang="ts">
	import { page } from '$app/state';
	import { House, LibraryBig, ListMusic, Search, UserRound } from 'lucide-svelte';
	import { authStore } from '$lib/stores/authStore.svelte';
	import { playerStore } from '$lib/stores/player.svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const NAV = [
		{ href: '/', label: 'Home', icon: House },
		{ href: '/search', label: 'Search', icon: Search },
		{ href: '/library', label: 'Library', icon: LibraryBig },
		{ href: '/playlists', label: 'Playlists', icon: ListMusic }
	];

	const path = $derived(page.url.pathname);
	const isActive = (href: string) =>
		href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
</script>

<header
	class="droppedneedle-topbar sticky top-0 z-50 flex items-center gap-4 border-b border-border bg-surface/95 px-4 backdrop-blur"
>
	<a href="/" aria-label="Home" class="shrink-0">
		<img src="/logo_wide.png" alt="DroppedNeedle" class="hidden h-7 md:block" />
		<img src="/logo_icon.png" alt="DroppedNeedle" class="h-7 md:hidden" />
	</a>
	<nav class="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
		{#each NAV as item (item.href)}
			<a
				href={item.href}
				aria-current={isActive(item.href) ? 'page' : undefined}
				class="rounded-control px-3 py-2 text-sm font-semibold text-fg-muted hover:text-fg aria-[current=page]:bg-accent/10 aria-[current=page]:text-accent"
			>
				{item.label}
			</a>
		{/each}
	</nav>
	<a
		href="/profile"
		aria-label="Profile"
		aria-current={isActive('/profile') ? 'page' : undefined}
		class="ml-auto grid size-9 place-items-center rounded-full text-fg-muted hover:bg-surface-hover hover:text-fg aria-[current=page]:text-accent"
	>
		{#if authStore.user?.avatar_url}
			<img src={authStore.user.avatar_url} alt="" class="size-7 rounded-full object-cover" />
		{:else}
			<UserRound class="size-6" aria-hidden="true" />
		{/if}
	</a>
</header>

<div
	class="droppedneedle-main-content flex-1"
	class:droppedneedle-player-visible={playerStore.isPlayerVisible}
>
	{@render children()}
</div>

<nav class="droppedneedle-bottom-nav md:hidden" aria-label="Primary navigation">
	{#each NAV as item (item.href)}
		{@const Icon = item.icon}
		<a
			href={item.href}
			class="droppedneedle-bottom-nav__item"
			class:active={isActive(item.href)}
			aria-current={isActive(item.href) ? 'page' : undefined}
		>
			<Icon aria-hidden="true" />
			<span>{item.label}</span>
		</a>
	{/each}
</nav>
