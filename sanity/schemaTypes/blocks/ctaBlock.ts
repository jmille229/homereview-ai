import { defineType, defineField } from 'sanity'

/** An inline call-to-action card (e.g. "get your quote reviewed"). */
export const ctaBlock = defineType({
  name: 'ctaBlock',
  title: 'Call to action',
  type: 'object',
  fields: [
    defineField({ name: 'heading', title: 'Heading', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'body', title: 'Body', type: 'text', rows: 2 }),
    defineField({ name: 'buttonLabel', title: 'Button label', type: 'string', initialValue: 'Start your free preview →', validation: (r) => r.required() }),
    defineField({
      name: 'href',
      title: 'Button link',
      type: 'string',
      description: 'A path on this site (e.g. /intake) or a full URL.',
      initialValue: '/intake',
      validation: (r) => r.required(),
    }),
  ],
  preview: {
    select: { title: 'heading', subtitle: 'buttonLabel' },
  },
})
