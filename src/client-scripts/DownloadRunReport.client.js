function downloadRunReport() {
	g_form.addInfoMessage('Generating report — this may take a few seconds for large runs.');

	// Scope-qualified API name — required for scoped client-callable SIs.
	var ga = new GlideAjax('x_335329_iscan.IscanReportGenerator');
	ga.addParam('sysparm_name', 'generateRunReportAjax');
	ga.addParam('sysparm_run_id', g_form.getUniqueValue());
	ga.getXMLAnswer(function(attachmentSysId) {
		if (!attachmentSysId) {
			g_form.addErrorMessage('Report generation failed. Check the system log for details.');
			return;
		}
		window.open('sys_attachment.do?sys_id=' + attachmentSysId, '_blank');
	});
}
