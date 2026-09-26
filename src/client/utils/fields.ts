// Field extraction for sysparm_display_value=all responses: reference/choice
// fields come back as {value, display_value} objects React cannot render.
export const display = (field: any): string => {
    if (typeof field === 'string') return field
    return field?.display_value || ''
}

export const value = (field: any): string => {
    if (typeof field === 'string') return field
    return field?.value || ''
}

// field_name -> "Field name". Used for RecordTable column headers and
// ResultSummary tile labels -- derived from the schema's own naming rather
// than a per-field label map, which could only ever drift from it.
export const humanizeField = (field: string): string => {
    const words = field.replace(/_/g, ' ')
    return words.charAt(0).toUpperCase() + words.slice(1)
}
