import { defineType, defineField } from 'sanity'

/** An emphasized pull quote with optional attribution. */
export const pullQuote = defineType({
  name: 'pullQuote',
  title: 'Pull quote',
  type: 'object',
  fields: [
    defineField({ name: 'quote', title: 'Quote', type: 'text', rows: 3, validation: (r) => r.required() }),
    defineField({ name: 'attribution', title: 'Attribution (optional)', type: 'string' }),
  ],
  preview: {
    select: { title: 'quote', subtitle: 'attribution' },
  },
})
