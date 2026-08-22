export interface ReasonOption {
	code: string;
	label: string;
}

export const REASON_OPTIONS: ReasonOption[] = [
	{ code: 'NO_CANDIDATE', label: 'No candidates found' },
	{ code: 'AMBIGUOUS', label: 'Multiple likely releases' },
	{ code: 'CONTRADICTORY', label: 'Conflicting evidence' },
	{ code: 'RELEASE_TYPE_REQUIRES_CONFIRMATION', label: 'Needs confirmation' },
	{ code: 'MAX_DEFERRALS_EXCEEDED', label: 'Repeated failures' },
	{ code: 'SUBJECT_NOT_AVAILABLE', label: 'Album unavailable' }
];

export function reasonLabel(code: string): string {
	if (code === 'NO_CANDIDATE') return 'No candidates found';
	if (code === 'AMBIGUOUS') return 'Multiple likely releases';
	if (code === 'CONTRADICTORY') return 'Conflicting evidence';
	if (code === 'RELEASE_TYPE_REQUIRES_CONFIRMATION' || code === 'UNSAFE_RELEASE_TYPE') {
		return 'Needs confirmation';
	}
	if (code === 'MAX_DEFERRALS_EXCEEDED') return 'Repeated failures';
	if (code === 'SUBJECT_NOT_AVAILABLE') return 'Album unavailable';
	return code.replaceAll('_', ' ').toLowerCase();
}
