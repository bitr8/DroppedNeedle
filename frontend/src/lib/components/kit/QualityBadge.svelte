<script lang="ts">
	interface Props {
		format: string;
		bitDepth?: number;
		sampleRate?: number;
		bitrate?: number;
	}

	let { format, bitDepth, sampleRate, bitrate }: Props = $props();

	const LOSSLESS = new Set(['FLAC', 'ALAC', 'WAV', 'AIFF']);
	const lossless = $derived(LOSSLESS.has(format.toUpperCase()));

	const detail = $derived(
		bitDepth && sampleRate
			? `${bitDepth}/${Math.round(sampleRate / 1000)}`
			: bitrate
				? `${bitrate}`
				: null
	);
</script>

<span
	class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs font-semibold whitespace-nowrap {lossless
		? 'bg-success/15 text-success'
		: 'bg-fg/10 text-fg-muted'}"
	data-format={format}
>
	{format.toUpperCase()}{#if detail}<span class="opacity-80">{detail}</span>{/if}
</span>
