import React from 'react'
import Dialog from './Dialog'
import RecordFields from './RecordFields'
import { ActionButton } from './ui'

/* Our own preview, opened from our own row click. Replaces both the platform
   Modal and the platform row "i" preview -- that one was never ours to resize
   (it ships inside NowRecordListConnected's shadow root with no size prop and
   no readable source), which is what put this component here in the first
   place. */
export default function RecordPreviewModal({
    table,
    sysId,
    onClose,
    onOpenFull,
}: {
    table: string
    sysId: string
    onClose: () => void
    onOpenFull: () => void
}) {
    return (
        <Dialog
            wide
            title="Record preview"
            onClose={onClose}
            footer={
                <>
                    <ActionButton label="Close" variant="secondary" onClick={onClose} />
                    <ActionButton label="Open full record" variant="primary" onClick={onOpenFull} />
                </>
            }
        >
            <RecordFields table={table} sysId={sysId} />
        </Dialog>
    )
}
