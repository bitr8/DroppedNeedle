<script lang="ts">
	import ConfirmModal from '$lib/components/kit/ConfirmModal.svelte';

	interface Props {
		open: boolean;
		playlistName: string;
		trackCount: number;
		pending?: boolean;
		onconfirm: () => void;
	}

	let {
		open = $bindable(false),
		playlistName,
		trackCount,
		pending = false,
		onconfirm
	}: Props = $props();
</script>

<ConfirmModal
	bind:open
	title="Detach “{playlistName}” from Spotify?"
	kicker="Stops syncing forever"
	confirmLabel="Detach"
	{pending}
	{onconfirm}
>
	“{playlistName}” will become a normal playlist. It will keep its {trackCount}
	{trackCount === 1 ? 'song' : 'songs'}, but it will stop following Spotify. This can't be re-linked
	— importing it again creates a separate, detached copy.
</ConfirmModal>
