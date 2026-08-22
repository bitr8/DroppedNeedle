<script lang="ts">
	import Dashboard from '$lib/components/dashboard/Dashboard.svelte';
	import UserHome from '$lib/components/home/UserHome.svelte';
	import { authStore } from '$lib/stores/authStore.svelte';
</script>

{#if authStore.isAdmin}
	<Dashboard />
{:else}
	<UserHome />
{/if}
