function downloadResultReport() {
	g_form.addInfoMessage('Generating report...');

	// Scope-qualified API name — required for scoped client-callable SIs.
	var ga = new GlideAjax('x_nold_iscan.IscanReportGenerator');
	ga.addParam('sysparm_name', 'generateResultReportAjax');
	ga.addParam('sysparm_result_id', g_form.getUniqueValue());
	ga.getXMLAnswer(function(attachmentSysId) {
		if (!attachmentSysId) {
			g_form.addErrorMessage('Report generation failed. Check the system log for details.');
			return;
		}
		window.open('sys_attachment.do?sys_id=' + attachmentSysId, '_blank');
	});
}
