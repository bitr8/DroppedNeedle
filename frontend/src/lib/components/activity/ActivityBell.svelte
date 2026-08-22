<script lang="ts">
	import { Bell } from 'lucide-svelte';
	import { getActivityQuery } from '$lib/queries/activity/ActivityQuery.svelte';
	import ActivityDrawer from './ActivityDrawer.svelte';

	let open = $state(false);
	const query = getActivityQuery();

	const attention = $derived(query.data?.attention ?? []);
	const criticalCount = $derived(attention.filter((a) => a.tier === 'critical').length);
	const warningCount = $derived(attention.filter((a) => a.tier === 'warning').length);
</script>

<button
	type="button"
	class="relative flex h-12 w-12 items-center justify-center rounded-full text-fg-muted hover:bg-surface-hover hover:text-fg"
	onclick={() => (open = true)}
	aria-label="Activity"
>
	<Bell class="h-6 w-6" aria-hidden="true" />
	{#if criticalCount > 0}
		<span
			class="absolute top-1 right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-danger text-[0.65rem] font-bold text-accent-fg"
		>
			{criticalCount}
		</span>
	{:else if warningCount > 0}
		<span
			class="absolute top-1 right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-warning text-[0.65rem] font-bold text-accent-fg"
		>
			{warningCount}
		</span>
	{/if}
	{#if query.isError}
		<span
			class="absolute top-full left-1/2 mt-1 -translate-x-1/2 whitespace-nowrap rounded-control bg-surface-overlay px-1.5 py-0.5 text-[0.65rem] text-fg-subtle shadow-card"
		>
			reconnecting…
		</span>
	{/if}
</button>

<ActivityDrawer bind:open />
