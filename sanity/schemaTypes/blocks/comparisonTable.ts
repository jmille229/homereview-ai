import { defineType, defineField, defineArrayMember } from 'sanity'

/**
 * A simple comparison table: N column headers + rows of cells. Kept
 * intentionally flat (arrays of strings) so it's quick to author and easy to
 * render responsively.
 */
export const comparisonTable = defineType({
  name: 'comparisonTable',
  title: 'Comparison table',
  type: 'object',
  fields: [
    defineField({ name: 'caption', title: 'Caption (optional)', type: 'string' }),
    defineField({
      name: 'columns',
      title: 'Column headers',
      type: 'array',
      of: [{ type: 'string' }],
      validation: (r) => r.required().min(2).error('Add at least two columns.'),
    }),
    defineField({
      name: 'rows',
      title: 'Rows',
      type: 'array',
      of: [
        defineArrayMember({
          name: 'row',
          title: 'Row',
          type: 'object',
          fields: [
            defineField({
              name: 'cells',
              title: 'Cells',
              type: 'array',
              of: [{ type: 'string' }],
              validation: (r) => r.required().min(1),
            }),
          ],
          preview: {
            select: { cells: 'cells' },
            prepare: ({ cells }) => ({ title: Array.isArray(cells) ? cells.join(' · ') : 'Row' }),
          },
        }),
      ],
      validation: (r) => r.required().min(1),
    }),
  ],
  preview: {
    select: { caption: 'caption', columns: 'columns' },
    prepare: ({ caption, columns }) => ({
      title: caption || 'Comparison table',
      subtitle: Array.isArray(columns) ? columns.join(' · ') : '',
    }),
  },
})
