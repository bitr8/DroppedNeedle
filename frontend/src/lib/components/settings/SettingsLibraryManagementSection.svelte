<script lang="ts">
	import SettingsLibraryManagement from './SettingsLibraryManagement.svelte';
	import { authStore } from '$lib/stores/authStore.svelte';
	import { getTargetLibrarySettingsQuery } from '$lib/queries/library/LibraryPolicyQueries.svelte';

	const settingsQuery = getTargetLibrarySettingsQuery(() => authStore.isAdmin);
	const roots = $derived(settingsQuery.data?.library_roots ?? []);
	const policyRevision = $derived(settingsQuery.data?.policy_revision ?? '');
</script>

{#if authStore.isAdmin}
	<SettingsLibraryManagement {roots} {policyRevision} />
{/if}
