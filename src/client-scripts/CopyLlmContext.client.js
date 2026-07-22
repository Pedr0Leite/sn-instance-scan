function copyLlmContext() {
	// No GlideAjax round-trip: llm_context is already loaded on the form.
	var context = g_form.getValue('llm_context');

	if (!context) {
		g_form.addErrorMessage('No LLM context on this record. It is written during the scan — re-run the scan if this result predates that feature.');
		return;
	}

	// navigator.clipboard is unavailable on insecure origins and in some
	// embedded frames, and it rejects rather than throwing synchronously,
	// so handle both the missing-API and rejected-promise cases.
	if (!navigator.clipboard || !navigator.clipboard.writeText) {
		g_form.addErrorMessage('Clipboard access is unavailable in this browser context. Open the LLM Context field and copy it manually.');
		return;
	}

	navigator.clipboard.writeText(context).then(
		function() {
			g_form.addInfoMessage('LLM context copied to the clipboard (' + context.length + ' characters). Paste it into any LLM.');
		},
		function(err) {
			g_form.addErrorMessage('Could not copy to the clipboard: ' + (err && err.message ? err.message : 'permission denied') + '. Open the LLM Context field and copy it manually.');
		}
	);
}
